import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

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

    // Get registration header
    const { data: headerData, error: headerError } = await supabase
      .from('regh')
      .select('*')
      .eq('transid', transId.toUpperCase())
      .single();

    if (headerError || !headerData) {
      return NextResponse.json(
        { error: 'Transaction ID not found' },
        { status: 404 }
      );
    }

    // Get registration details
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

    return NextResponse.json({
      header: headerData,
      details: detailData || []
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registration' },
      { status: 500 }
    );
  }
}
