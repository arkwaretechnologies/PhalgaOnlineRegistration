import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
// @ts-ignore - sharp has built-in types but TypeScript may not recognize them in some environments
import sharp from 'sharp';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const transIdValue = formData.get('transId');
    const regIdValue = formData.get('regId');
    // Support both 'transId' and 'regId' for backward compatibility
    const regId = (typeof transIdValue === 'string' ? transIdValue : null) || 
                  (typeof regIdValue === 'string' ? regIdValue : null);

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!regId) {
      return NextResponse.json(
        { error: 'Registration ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image (JPEG, PNG, GIF) or PDF file.' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB.' },
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
    const { data: headerData, error: headerError } = await supabase
      .from('regh')
      .select('confcode')
      .eq('regid', regIdString)
      .single();

    if (headerError || !headerData) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
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
        
        console.log(`Image optimized: Original size: ${file.size} bytes, Optimized size: ${buffer.length} bytes, Reduction: ${((1 - buffer.length / file.size) * 100).toFixed(1)}%`);
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
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filename, buffer, {
        contentType: optimizedMimeType,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Supabase storage error:', uploadError);
      
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
    
    console.log('Generated file URL:', fileUrl);

    // Insert payment proof into regdep table
    const { error: insertError } = await supabase
      .from('regdep')
      .insert({
        regid: regIdString,
        confcode: headerData.confcode || null,
        payment_proof_url: fileUrl
      });

    if (insertError) {
      console.error('Database insert error:', insertError);
      // Try to delete uploaded file if database insert fails
      try {
        await supabase.storage.from('payment-proofs').remove([filename]);
      } catch (deleteError) {
        console.error('Failed to delete uploaded file:', deleteError);
      }
      return NextResponse.json(
        { error: 'Failed to save payment proof to database' },
        { status: 500 }
      );
    }

    console.log('Payment proof uploaded successfully:', { regId, confcode: headerData.confcode, filename, fileUrl });

    return NextResponse.json({
      success: true,
      url: fileUrl,
      message: 'Payment proof uploaded successfully'
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload payment proof: ' + (error?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
