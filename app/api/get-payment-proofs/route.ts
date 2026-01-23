import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const regId = searchParams.get('transId') || searchParams.get('regId'); // Support both for backward compatibility

    if (!regId) {
      return NextResponse.json(
        { error: 'Registration ID parameter is required' },
        { status: 400 }
      );
    }

    const regIdString = regId.toUpperCase().trim();

    // Get all payment proofs for this registration
    const { data: paymentProofs, error: paymentProofsError } = await supabase
      .from('regdep')
      .select('*')
      .eq('regid', regIdString)
      .order('linenum', { ascending: true }); // Order by line number

    if (paymentProofsError) {
      console.error('Error fetching payment proofs:', paymentProofsError);
      return NextResponse.json(
        { error: 'Failed to fetch payment proofs' },
        { status: 500 }
      );
    }

    // console.log(`Fetched ${paymentProofs?.length || 0} payment proofs for regid: ${regIdString}`);

    // Return response with no-cache headers to ensure fresh data
    return NextResponse.json(
      {
        paymentProofs: paymentProofs || [],
        count: paymentProofs?.length || 0
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error) {
    console.error('API error fetching payment proofs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment proofs' },
      { status: 500 }
    );
  }
}
