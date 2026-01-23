import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lgu = searchParams.get('lgu');
    const psgc = searchParams.get('psgc'); // Accept PSGC code directly

    // console.log('=== Fetching Barangays ===');
    // console.log('LGU selected:', lgu);
    // console.log('PSGC code:', psgc);

    let lguPsgc: string | null = null;

    // If PSGC is provided, use it directly
    if (psgc && psgc.trim() !== '') {
      lguPsgc = psgc.trim();
      // console.log('Using provided PSGC code:', lguPsgc);
    } else if (lgu) {
      // Fallback: Get PSGC for the LGU (must have geolevel = 'MUN' or 'CITY')
      // Using ilike for case-insensitive matching of LGU name
      const { data: lguPsgcData, error: lguPsgcError } = await supabase
        .from('lgus')
        .select('psgc, lguname, geolevel')
        .ilike('lguname', lgu.trim())
        .in('geolevel', ['MUN', 'CITY'])
        .limit(1);

      if (lguPsgcError) {
        console.error('Database error fetching LGU PSGC:', lguPsgcError);
        return NextResponse.json(
          { error: 'Failed to fetch barangays' },
          { status: 500 }
        );
      }

      if (!lguPsgcData || lguPsgcData.length === 0) {
        // console.log(`No LGU found with name: ${lgu} and geolevel=MUN or CITY`);
        return NextResponse.json([]);
      }

      lguPsgc = lguPsgcData[0].psgc;
    } else {
      return NextResponse.json(
        { error: 'LGU or PSGC parameter is required' },
        { status: 400 }
      );
    }

    // console.log('LGU PSGC to use:', lguPsgc);

    if (!lguPsgc || lguPsgc.length < 7) {
      console.error('Invalid PSGC - must be at least 7 characters:', lguPsgc);
      return NextResponse.json([]);
    }

    // Get first 7 digits of the LGU PSGC
    const firstSevenDigits = lguPsgc.substring(0, 7);
    const psgcPrefix = `${firstSevenDigits}%`;
    
    // console.log('First 7 digits of LGU PSGC:', firstSevenDigits);
    // console.log('PSGC prefix pattern:', psgcPrefix);

    // Get barangays where PSGC starts with first 7 digits and geolevel is BGY
    // Using ilike for case-insensitive matching (though PSGC is typically numeric)
    const { data: barangayData, error: barangayError } = await supabase
      .from('lgus')
      .select('lguname, psgc, geolevel')
      .ilike('psgc', psgcPrefix)
      .eq('geolevel', 'BGY')
      .order('lguname', { ascending: true });

    if (barangayError) {
      console.error('Database error fetching barangays:', barangayError);
      return NextResponse.json(
        { error: 'Failed to fetch barangays' },
        { status: 500 }
      );
    }

    // console.log(`Found ${barangayData?.length || 0} barangays with PSGC starting with ${firstSevenDigits}`);
    
    // if (barangayData && barangayData.length > 0) {
    //   console.log('Barangays found (first 10):', barangayData.slice(0, 10).map(b => ({ name: b.lguname, psgc: b.psgc, geolevel: b.geolevel })));
    // }

    const data = barangayData?.map((row) => row.lguname) || [];
    
    // console.log('=== Final Barangays List ===');
    // console.log('Total barangays:', data.length);
    // console.log('Barangays (first 20):', data.slice(0, 20));
    // console.log('===========================');

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('=== API Error Fetching Barangays ===');
    console.error('Error:', error);
    console.error('Error message:', error?.message);
    console.error('===================================');
    return NextResponse.json(
      { error: 'Failed to fetch barangays', details: error?.message },
      { status: 500 }
    );
  }
}
