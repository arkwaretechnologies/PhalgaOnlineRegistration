import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * API route to verify if the payment-proofs storage bucket exists
 * This can be used for debugging storage setup issues
 */
export async function GET() {
  try {
    // Try to list files in the bucket (this will fail if bucket doesn't exist)
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .list('', { limit: 1 });

    if (error) {
      if (error.message.includes('not found') || error.message.includes('Bucket not found')) {
        return NextResponse.json({
          exists: false,
          error: 'Bucket "payment-proofs" does not exist',
          message: 'Please run the storage migration: supabase/migrations/20260113000001_setup_payment_proofs_storage.sql'
        }, { status: 404 });
      }
      
      return NextResponse.json({
        exists: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      exists: true,
      message: 'Storage bucket "payment-proofs" is configured correctly',
      fileCount: data?.length || 0
    });
  } catch (error: any) {
    console.error('Storage verification error:', error);
    return NextResponse.json({
      exists: false,
      error: error?.message || 'Unknown error'
    }, { status: 500 });
  }
}
