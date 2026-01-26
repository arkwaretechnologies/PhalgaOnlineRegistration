import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
// @ts-ignore - sharp has built-in types but TypeScript may not recognize them in some environments
import sharp from 'sharp';
import {
  validateRequestSize,
  validateContentType,
  createTimeout,
  withTimeout,
} from '@/lib/security';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  // Create timeout for request (30 seconds)
  const { abortController, timeoutId, timeoutPromise } = createTimeout(30000);

  try {
    // Validate Content-Type (multipart/form-data)
    const contentTypeCheck = validateContentType(request, ['multipart/form-data']);
    if (!contentTypeCheck.isValid) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: contentTypeCheck.error },
        { status: 400 }
      );
    }

    // Validate request size (max 11MB to account for form fields + file)
    // File itself is limited to 10MB, but multipart encoding adds overhead
    const sizeCheck = validateRequestSize(request, 11 * 1024 * 1024); // 11MB
    if (!sizeCheck.isValid) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: sizeCheck.error },
        { status: 413 }
      );
    }

    // @ts-ignore - formData now takes no arguments as of standard fetch
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const transIdValue = formData.get('transId');
    const regIdValue = formData.get('regId');
    const linenumValue = formData.get('linenum');
    // Support both 'transId' and 'regId' for backward compatibility
    const regId = (typeof transIdValue === 'string' ? transIdValue : null) || 
                  (typeof regIdValue === 'string' ? regIdValue : null);
    // Parse linenum if provided (optional - for associating payment proof with specific participant)
    let linenum: number | null = null;
    if (linenumValue) {
      const parsed = parseInt(String(linenumValue), 10);
      linenum = isNaN(parsed) ? null : parsed;
    }

    if (!file) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!regId) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Registration ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image (JPEG, PNG, GIF) or PDF file.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'File size must be less than 10MB.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    let buffer: Buffer = Buffer.from(bytes);
    let optimizedMimeType = file.type;
    let fileExtension = file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');

    // Get registration header to get confcode
    const regIdString = regId.toUpperCase().trim();
    const { data: headerData, error: headerError } = await withTimeout(
      supabase
        .from('regh')
        .select('confcode')
        .eq('regid', regIdString)
        .single(),
      timeoutPromise
    ) as { data: { confcode: string } | null; error: any };

    if (headerError || !headerData) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    // Ensure confcode is available (required for composite primary key)
    if (!headerData.confcode) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Registration header is missing conference code. Cannot determine line number for payment proof.' },
        { status: 400 }
      );
    }

    // Get count of participants in regd for this regid and confcode
    // This determines the maximum number of payment proofs that can be uploaded
    const { count: participantCount, error: participantsError } = await withTimeout(
      supabase
        .from('regd')
        .select('*', { count: 'exact', head: true })
        .eq('regid', regIdString)
        .eq('confcode', headerData.confcode),
      timeoutPromise
    ) as { count: number | null; error: any };

    if (participantsError) {
      console.error('Error fetching participant count:', participantsError);
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Failed to verify registration participants. Please try again.' },
        { status: 500 }
      );
    }

    const maxUploads = participantCount || 0;

    if (maxUploads === 0) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'No participants found for this registration. Please register participants first before uploading payment proofs.' },
        { status: 400 }
      );
    }

    // console.log(`Registration has ${maxUploads} participant(s). Maximum ${maxUploads} payment proof(s) can be uploaded.`);

    // Get existing payment proofs count for this registration and conference
    const { count: existingProofsCount, error: existingProofsError } = await withTimeout(
      supabase
        .from('regdep')
        .select('*', { count: 'exact', head: true })
        .eq('regid', regIdString)
        .eq('confcode', headerData.confcode),
      timeoutPromise
    ) as { count: number | null; error: any };

    if (existingProofsError) {
      console.error('Error fetching existing payment proofs count:', existingProofsError);
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Failed to check existing payment proofs. Please try again.' },
        { status: 500 }
      );
    }

    const currentUploadCount = existingProofsCount || 0;
    // console.log(`Current payment proof uploads: ${currentUploadCount}/${maxUploads}`);

    // Check if max uploads limit has been reached
    if (currentUploadCount >= maxUploads) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: `Maximum upload limit reached. This registration has ${maxUploads} participant(s), and you have already uploaded ${currentUploadCount} payment proof(s).` },
        { status: 400 }
      );
    }

    // If linenum is not provided, determine it based on existing payment proofs
    // linenum is sequential (1, 2, 3, ...) and represents the upload sequence, not tied to participant linenum
    if (linenum === null || isNaN(linenum)) {
      // Get the max linenum from existing payment proofs
      const { data: existingProofsData, error: maxLinenumError } = await withTimeout(
        supabase
          .from('regdep')
          .select('linenum')
          .eq('regid', regIdString)
          .eq('confcode', headerData.confcode)
          .order('linenum', { ascending: false })
          .limit(1),
        timeoutPromise
      ) as { data: { linenum: number }[] | null; error: any };

      if (maxLinenumError) {
        console.error('Error fetching max linenum:', maxLinenumError);
        // Default to 1 if query fails
        linenum = 1;
      } else if (!existingProofsData || existingProofsData.length === 0) {
        // No existing payment proofs, start with 1
        linenum = 1;
        // console.log(`No existing payment proofs found for regid ${regIdString} and confcode ${headerData.confcode}, setting linenum to 1`);
      } else {
        // Get max linenum and add 1
        const maxLinenum = existingProofsData[0].linenum;
        linenum = maxLinenum + 1;
        // console.log(`Found existing payment proofs for regid ${regIdString} and confcode ${headerData.confcode}, max linenum is ${maxLinenum}, setting new linenum to ${linenum}`);
      }
    } else {
      // If linenum is provided, validate it doesn't exceed max uploads
      if (linenum > maxUploads) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: `Line number ${linenum} exceeds the maximum allowed uploads (${maxUploads} participant(s) in this registration).` },
          { status: 400 }
        );
      }
    }

    // Validate that linenum is a valid positive integer
    if (linenum === null || isNaN(linenum) || linenum < 1) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Invalid line number. Line number must be a positive integer.' },
        { status: 400 }
      );
    }

    // Optimize images without losing quality
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      try {
        let sharpImage = sharp(buffer);
        
        // Get image metadata to check dimensions
        const metadata = await sharpImage.metadata();
        const maxDimension = 2048; // Max width or height (maintains aspect ratio)
        
        // Resize if image is too large (but preserve quality)
        if (metadata.width && metadata.height) {
          if (metadata.width > maxDimension || metadata.height > maxDimension) {
            sharpImage = sharpImage.resize(maxDimension, maxDimension, {
              fit: 'inside',
              withoutEnlargement: true
            });
          }
        }
        
        // Optimize based on image type
        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          // JPEG: High quality (92) for minimal quality loss, progressive for web optimization
          buffer = await sharpImage
            .jpeg({ 
              quality: 92, 
              progressive: true,
              mozjpeg: true // Use mozjpeg for better compression
            })
            .toBuffer() as Buffer;
          optimizedMimeType = 'image/jpeg';
          fileExtension = 'jpg';
        } else if (file.type === 'image/png') {
          // PNG: Use compression level 9 (maximum) with adaptive filtering
          buffer = await sharpImage
            .png({ 
              compressionLevel: 9,
              adaptiveFiltering: true,
              palette: metadata.channels === 4 || metadata.channels === 3 // Use palette for images with transparency (RGBA or RGB)
            })
            .toBuffer() as Buffer;
          optimizedMimeType = 'image/png';
          fileExtension = 'png';
        } else if (file.type === 'image/gif') {
          // GIF: Convert to PNG for better quality and smaller size (unless it's animated)
          // For animated GIFs, we keep them as is, but for static GIFs, convert to PNG
          if (!metadata.pages || metadata.pages === 1) {
            // Static GIF - convert to PNG for better compression
            buffer = await sharpImage
              .png({ 
                compressionLevel: 9,
                adaptiveFiltering: true
              })
              .toBuffer() as Buffer;
            optimizedMimeType = 'image/png';
            fileExtension = 'png';
          }
          // If animated, keep as GIF (but could be optimized further with gifsicle if needed)
        }
        
        // console.log(`Image optimized: Original size: ${file.size} bytes, Optimized size: ${buffer.length} bytes, Reduction: ${((1 - buffer.length / file.size) * 100).toFixed(1)}%`);
      } catch (optimizationError) {
        console.error('Image optimization error:', optimizationError);
        // If optimization fails, use original buffer and preserve original file extension/mime type
        // Don't fail the upload, just log the error
        buffer = Buffer.from(bytes);
        optimizedMimeType = file.type;
        fileExtension = file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
      }
    }
    // Note: PDF optimization can be added here if needed using pdf-lib or similar

    // Generate unique filename (each file should be unique, no upsert)
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9); // Add random suffix for uniqueness
    const filename = `payment-proof-${regIdString}-${timestamp}-${randomSuffix}.${fileExtension}`;

    // Upload to Supabase Storage
    // Each file should be unique - no upsert
    // Use optimized mime type
    const { data: uploadData, error: uploadError } = await withTimeout(
      supabase.storage
        .from('payment-proofs')
        .upload(filename, buffer, {
          contentType: optimizedMimeType,
          cacheControl: '3600'
        }),
      timeoutPromise
    ) as { data: { path: string } | null; error: any };

    if (uploadError) {
      console.error('Supabase storage error:', uploadError);
      clearTimeout(timeoutId);
      
      // If bucket doesn't exist, provide helpful error message
      if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Storage bucket not configured. Please run the storage migration: supabase/migrations/20260113000001_setup_payment_proofs_storage.sql' },
          { status: 500 }
        );
      }
      
      // If RLS policy error, provide helpful message
      if (uploadError.message.includes('row-level security') || uploadError.message.includes('RLS') || uploadError.message.includes('policy')) {
        return NextResponse.json(
          { error: 'Storage RLS policy error. Please run the storage migration to set up policies: supabase/migrations/20260113000001_setup_payment_proofs_storage.sql' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to upload file to storage: ' + uploadError.message },
        { status: 500 }
      );
    }

    // Get public URL
    // Note: getPublicUrl doesn't verify bucket exists, it just constructs the URL
    // The URL format is: https://[project-ref].supabase.co/storage/v1/object/public/[bucket]/[path]
    const { data: urlData } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(filename);

    const fileUrl = urlData.publicUrl;
    
    // Verify the URL is valid
    if (!fileUrl || fileUrl.includes('undefined')) {
      console.error('Failed to generate public URL:', urlData);
      clearTimeout(timeoutId);
      // Try to delete uploaded file
      try {
        await supabase.storage.from('payment-proofs').remove([filename]);
      } catch (deleteError) {
        console.error('Failed to delete uploaded file:', deleteError);
      }
      return NextResponse.json(
        { error: 'Failed to generate file URL. Please ensure the storage bucket exists.' },
        { status: 500 }
      );
    }
    
    // console.log('Generated file URL:', fileUrl);

    // Insert payment proof into regdep table
    // linenum is now guaranteed to be a valid number (either provided and validated, or auto-generated and validated)
    // confcode and linenum are part of the composite primary key and must NOT be NULL
    // Note: confcode check is already done above, and linenum is validated against regd above
    if (linenum === null || isNaN(linenum)) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Invalid line number. Cannot save payment proof.' },
        { status: 400 }
      );
    }

    const result = await withTimeout(
      supabase
        .from('regdep')
        .insert({
          regid: regIdString,
          confcode: headerData.confcode, // NOT NULL - part of composite primary key
          payment_proof_url: fileUrl,
          linenum: linenum // NOT NULL - part of composite primary key
        }),
      timeoutPromise
    ) as { error: any };
    const { error: insertError } = result;

    if (insertError) {
      console.error('Database insert error:', insertError);
      console.error('Insert error details:', {
        regId: regIdString,
        confcode: headerData.confcode,
        linenum: linenum,
        errorCode: insertError.code,
        errorMessage: insertError.message,
        errorDetails: insertError.details,
        errorHint: insertError.hint
      });
      
      // Try to delete uploaded file if database insert fails
      try {
        await supabase.storage.from('payment-proofs').remove([filename]);
      } catch (deleteError) {
        console.error('Failed to delete uploaded file:', deleteError);
      }
      
      clearTimeout(timeoutId);
      
      // Handle duplicate key violation (23505) - payment proof already exists for this participant
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: `Payment proof already exists for participant line number ${linenum}. Please delete the existing payment proof first or choose a different participant.` },
          { status: 409 } // 409 Conflict
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to save payment proof to database: ' + (insertError.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // console.log('Payment proof uploaded successfully:', { regId, confcode: headerData.confcode, filename, fileUrl });

    clearTimeout(timeoutId);
    return NextResponse.json({
      success: true,
      url: fileUrl,
      message: 'Payment proof uploaded successfully'
    });
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Handle timeout/abort errors
    if (error.name === 'AbortError' || abortController.signal.aborted) {
      console.error('Request timeout:', error);
      return NextResponse.json(
        { error: 'Request timeout. Please try again.' },
        { status: 408 }
      );
    }

    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload payment proof: ' + (error?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
