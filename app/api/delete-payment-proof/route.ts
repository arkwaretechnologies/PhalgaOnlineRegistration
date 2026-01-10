import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id'); // ID from regdep table
    const regId = searchParams.get('regId') || searchParams.get('transId');

    if (!id) {
      return NextResponse.json(
        { error: 'Payment proof ID is required' },
        { status: 400 }
      );
    }

    if (!regId) {
      return NextResponse.json(
        { error: 'Registration ID is required' },
        { status: 400 }
      );
    }

    const regIdString = regId.toUpperCase().trim();

    console.log(`Deleting payment proof with ID: ${id} for regid: ${regIdString}`);

    // Verify the payment proof belongs to this registration before deleting
    const { data: existingProof, error: verifyError } = await supabase
      .from('regdep')
      .select('*')
      .eq('id', id)
      .eq('regid', regIdString)
      .single();

    if (verifyError || !existingProof) {
      console.error('Verify error:', verifyError);
      return NextResponse.json(
        { error: 'Payment proof not found or does not belong to this registration' },
        { status: 404 }
      );
    }

    // Extract filename from URL for storage deletion
    // URL format: https://[project-ref].supabase.co/storage/v1/object/public/payment-proofs/[filename]
    const urlParts = existingProof.payment_proof_url.split('/');
    const filename = urlParts[urlParts.length - 1];

    if (!filename) {
      console.error('Invalid payment proof URL:', existingProof.payment_proof_url);
      return NextResponse.json(
        { error: 'Invalid payment proof URL format' },
        { status: 400 }
      );
    }

    // Delete from Supabase Storage first
    const { error: storageError } = await supabase.storage
      .from('payment-proofs')
      .remove([filename]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      // Continue with database deletion even if storage delete fails
      // (file might already be deleted)
    } else {
      console.log('File deleted from storage:', filename);
    }

    // Delete from regdep table using ID
    const { error: deleteError } = await supabase
      .from('regdep')
      .delete()
      .eq('id', id)
      .eq('regid', regIdString); // Double-check regid for security

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete payment proof from database' },
        { status: 500 }
      );
    }

    console.log('Payment proof deleted successfully:', { id, regId: regIdString, filename });

    return NextResponse.json({
      success: true,
      message: 'Payment proof deleted successfully'
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment proof: ' + (error?.message || 'Unknown error') },
      { status: 500 }
    );
  }
}
