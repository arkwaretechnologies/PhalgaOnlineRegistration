import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get('province');

    if (!province) {
      return NextResponse.json(
        { error: 'Province parameter is required' },
        { status: 400 }
      );
    }

    // Get PSGC for the province
    const { data: psgcData, error: psgcError } = await supabase
      .from('lgus')
      .select('psgc')
      .eq('lguname', province)
      .limit(1);

    if (psgcError) {
      console.error('Database error:', psgcError);
      return NextResponse.json(
        { error: 'Failed to fetch LGUs' },
        { status: 500 }
      );
    }

    if (!psgcData || psgcData.length === 0) {
      return NextResponse.json([]);
    }

    const psgc = psgcData[0].psgc;
    const subgeo = psgc.substring(0, 5) + '%';

    // Get LGUs in the province
    const { data: lguData, error: lguError } = await supabase
      .from('lgus')
      .select('lguname')
      .like('psgc', subgeo)
      .in('geolevel', ['MUN', 'CITY'])
      .order('lguname', { ascending: true });

    if (lguError) {
      console.error('Database error:', lguError);
      return NextResponse.json(
        { error: 'Failed to fetch LGUs' },
        { status: 500 }
      );
    }

    const data = lguData?.map((row) => row.lguname) || [];

    return NextResponse.json(data);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LGUs' },
      { status: 500 }
    );
  }
}

