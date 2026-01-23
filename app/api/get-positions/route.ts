import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    // console.log('=== Fetching Positions ===');

    // Fetch positions from the positions table, ordered by name
    const { data: positionData, error: positionError } = await supabase
      .from('positions')
      .select('name, lvl')
      .order('name', { ascending: true });

    if (positionError) {
      console.error('Database error fetching positions:', positionError);
      return NextResponse.json(
        { error: 'Failed to fetch positions' },
        { status: 500 }
      );
    }

    // console.log(`Found ${positionData?.length || 0} positions`);
    
    // if (positionData && positionData.length > 0) {
    //   console.log('Positions found (first 10):', positionData.slice(0, 10).map(p => ({ name: p.name, lvl: p.lvl })));
    // }

    const data = positionData?.map((row) => ({ name: row.name, lvl: row.lvl || null })) || [];
    
    // console.log('=== Final Positions List ===');
    // console.log('Total positions:', data.length);
    // console.log('Positions (first 20):', data.slice(0, 20));
    // console.log('===========================');

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('=== API Error Fetching Positions ===');
    console.error('Error:', error);
    console.error('Error message:', error?.message);
    console.error('===================================');
    return NextResponse.json(
      { error: 'Failed to fetch positions', details: error?.message },
      { status: 500 }
    );
  }
}
