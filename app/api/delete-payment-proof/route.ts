import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const regId = searchParams.get('regId') || searchParams.get('transId');
    const confcode = searchParams.get('confcode');
    const linenumParam = searchParams.get('linenum');

    if (!regId) {
      return NextResponse.json(
        { error: 'Registration ID is required' },
        { status: 400 }
      );
    }

    if (!confcode) {
      return NextResponse.json(
        { error: 'Conference code is required' },
        { status: 400 }
      );
    }

    if (!linenumParam) {
      return NextResponse.json(
        { error: 'Line number is required' },
        { status: 400 }
      );
    }

    const regIdString = regId.toUpperCase().trim();
    const confcodeString = confcode.trim();
    const linenum = parseInt(linenumParam, 10);

    if (isNaN(linenum)) {
      return NextResponse.json(
        { error: 'Invalid line number' },
        { status: 400 }
      );
    }

    console.log(`Deleting payment proof for regid: ${regIdString}, confcode: ${confcodeString}, linenum: ${linenum}`);

    // Verify the payment proof exists before deleting (using composite primary key)
    const { data: existingProof, error: verifyError } = await supabase
      .from('regdep')
      .select('*')
      .eq('regid', regIdString)
      .eq('confcode', confcodeString)
      .eq('linenum', linenum)
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
    // or: https://[project-ref].supabase.co/storage/v1/object/public/payment-proofs/[path]/[filename]
    let filename: string | null = null;
    
    try {
      const url = existingProof.payment_proof_url;
      if (url && url.includes('payment-proofs')) {
        // Extract the part after 'payment-proofs/'
        const paymentProofsIndex = url.indexOf('payment-proofs/');
        if (paymentProofsIndex !== -1) {
          const pathAfterBucket = url.substring(paymentProofsIndex + 'payment-proofs/'.length);
          // Remove query parameters if any
          const pathWithoutQuery = pathAfterBucket.split('?')[0];
          filename = pathWithoutQuery;
        } else {
          // Fallback: try to get last part of URL
          const urlParts = url.split('/');
          filename = urlParts[urlParts.length - 1]?.split('?')[0] || null;
        }
      } else {
        // If URL doesn't contain 'payment-proofs', try to extract filename from end
        const urlParts = url.split('/');
        filename = urlParts[urlParts.length - 1]?.split('?')[0] || null;
      }
    } catch (urlError) {
      console.error('Error parsing payment proof URL:', urlError);
      filename = null;
    }

    // Delete from Supabase Storage first (if filename is valid)
    if (filename) {
      try {
        const { error: storageError, data: storageData } = await supabase.storage
          .from('payment-proofs')
          .remove([filename]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
          // Log but continue with database deletion
          // (file might already be deleted or not exist)
          console.warn(`Failed to delete file from storage: ${filename}. Continuing with database deletion.`);
        } else {
          console.log('File deleted from storage:', filename, storageData);
        }
      } catch (storageDeleteException) {
        console.error('Exception during storage delete:', storageDeleteException);
        // Continue with database deletion even if storage delete fails
      }
    } else {
      console.warn('Could not extract filename from URL:', existingProof.payment_proof_url);
      // Continue with database deletion even if filename extraction fails
    }

    // Delete from regdep table using composite primary key (regid, confcode, linenum)
    // Note: We already verified the record exists above, so proceed with deletion
    const { error: deleteError } = await supabase
      .from('regdep')
      .delete()
      .eq('regid', regIdString)
      .eq('confcode', confcodeString)
      .eq('linenum', linenum);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      console.error('Delete error details:', {
        regId: regIdString,
        confcode: confcodeString,
        linenum: linenum,
        errorCode: deleteError.code,
        errorMessage: deleteError.message,
        errorDetails: deleteError.details,
        errorHint: deleteError.hint
      });
      return NextResponse.json(
        { 
          error: 'Failed to delete payment proof from database',
          details: deleteError.message || 'Unknown database error. This might be a permissions issue.'
        },
        { status: 500 }
      );
    }

    console.log('Payment proof deleted successfully:', { regId: regIdString, confcode: confcodeString, linenum: linenum, filename });

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
