import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const regId = formData.get('transId') || formData.get('regId') as string; // Support both for backward compatibility

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
    const buffer = Buffer.from(bytes);

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const timestamp = Date.now();
    const filename = `payment-proof-${regId.toUpperCase()}-${timestamp}.${fileExtension}`;

    // Upload to Supabase Storage
    // Use upsert: true to allow replacing existing files
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: true, // Allow replacing files with same name
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

    // Update registration header with payment proof URL
    const { error: updateError } = await supabase
      .from('regh')
      .update({ payment_proof_url: fileUrl })
      .eq('regid', regId.toUpperCase());

    if (updateError) {
      console.error('Database update error:', updateError);
      // Try to delete uploaded file if database update fails
      try {
        await supabase.storage.from('payment-proofs').remove([filename]);
      } catch (deleteError) {
        console.error('Failed to delete uploaded file:', deleteError);
      }
      return NextResponse.json(
        { error: 'Failed to update registration with payment proof' },
        { status: 500 }
      );
    }

    console.log('Payment proof uploaded successfully:', { regId, filename, fileUrl });

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
