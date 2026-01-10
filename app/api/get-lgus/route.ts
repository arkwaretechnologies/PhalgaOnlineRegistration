import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get('province');

    console.log('=== Fetching LGUs ===');
    console.log('Province selected:', province);

    if (!province) {
      return NextResponse.json(
        { error: 'Province parameter is required' },
        { status: 400 }
      );
    }

    // Get PSGC for the province (must have geolevel = 'PROV')
    // Using ilike for case-insensitive matching of province name
    const { data: psgcData, error: psgcError } = await supabase
      .from('lgus')
      .select('psgc, lguname, geolevel')
      .ilike('lguname', province.trim())
      .eq('geolevel', 'PROV')
      .limit(1);

    if (psgcError) {
      console.error('Database error fetching province PSGC:', psgcError);
      return NextResponse.json(
        { error: 'Failed to fetch LGUs' },
        { status: 500 }
      );
    }

    if (!psgcData || psgcData.length === 0) {
      console.log(`No province found with name: ${province} and geolevel=PROV`);
      return NextResponse.json([]);
    }

    const provincePsgc = psgcData[0].psgc;
    console.log('Province PSGC found:', provincePsgc);

    if (!provincePsgc || provincePsgc.length < 5) {
      console.error('Invalid PSGC - must be at least 5 characters:', provincePsgc);
      return NextResponse.json([]);
    }

    // Get first 5 digits of the province PSGC
    const firstFiveDigits = provincePsgc.substring(0, 5);
    const psgcPrefix = `${firstFiveDigits}%`;
    
    console.log('First 5 digits of PSGC:', firstFiveDigits);
    console.log('PSGC prefix pattern:', psgcPrefix);

    // Get LGUs where PSGC starts with first 5 digits and geolevel is MUN or CITY
    // Using ilike for case-insensitive matching (though PSGC is typically numeric)
    const { data: lguData, error: lguError } = await supabase
      .from('lgus')
      .select('lguname, psgc, geolevel')
      .ilike('psgc', psgcPrefix)
      .in('geolevel', ['MUN', 'CITY'])
      .order('lguname', { ascending: true });

    if (lguError) {
      console.error('Database error fetching LGUs:', lguError);
      return NextResponse.json(
        { error: 'Failed to fetch LGUs' },
        { status: 500 }
      );
    }

    console.log(`Found ${lguData?.length || 0} LGUs with PSGC starting with ${firstFiveDigits}`);
    
    if (lguData && lguData.length > 0) {
      console.log('LGUs found:', lguData.map(l => ({ name: l.lguname, psgc: l.psgc, geolevel: l.geolevel })));
    }

    const data = lguData?.map((row) => row.lguname) || [];
    
    console.log('=== Final LGUs List ===');
    console.log('Total LGUs:', data.length);
    console.log('LGUs:', data);
    console.log('======================');

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('=== API Error Fetching LGUs ===');
    console.error('Error:', error);
    console.error('Error message:', error?.message);
    console.error('===============================');
    return NextResponse.json(
      { error: 'Failed to fetch LGUs', details: error?.message },
      { status: 500 }
    );
  }
}

