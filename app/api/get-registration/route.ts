import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const transId = searchParams.get('transId');

    if (!transId) {
      return NextResponse.json(
        { error: 'Transaction ID parameter is required' },
        { status: 400 }
      );
    }

    // Get registration header - ensure fresh data with no caching
    const { data: headerData, error: headerError } = await supabase
      .from('regh')
      .select('*')
      .eq('transid', transId.toUpperCase())
      .single();

    console.log('=== Get Registration Debug ===');
    console.log('transId:', transId);
    console.log('headerData:', JSON.stringify(headerData, null, 2));
    console.log('headerError:', headerError);

    if (headerError || !headerData) {
      return NextResponse.json(
        { error: 'Transaction ID not found' },
        { status: 404 }
      );
    }

    // Get registration details - ensure fresh data
    const { data: detailData, error: detailError } = await supabase
      .from('regd')
      .select('*')
      .eq('regnum', headerData.regnum)
      .order('linenum', { ascending: true });

    if (detailError) {
      console.error('Detail fetch error:', detailError);
      return NextResponse.json(
        { error: 'Failed to fetch registration details' },
        { status: 500 }
      );
    }

    // Return response with no-cache headers to ensure fresh data
    return NextResponse.json(
      {
        header: headerData,
        details: detailData || []
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
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registration' },
      { status: 500 }
    );
  }
}
