import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getConferenceByDomain } from '@/lib/conference';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    // Detect conference from domain
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const conference = await getConferenceByDomain(hostname || undefined);

    if (!conference) {
      return NextResponse.json(
        { error: 'Conference not found for this domain. Please check your configuration.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const province = searchParams.get('province');

    // console.log('=== Fetching LGUs ===');
    // console.log('Conference:', conference.confcode);
    // console.log('Province selected:', province);

    if (!province) {
      return NextResponse.json(
        { error: 'Province parameter is required' },
        { status: 400 }
      );
    }

    const provinceUpper = province.trim().toUpperCase();

    // Check if it's one of the special city class provinces
    let cityClass: string | null = null;
    if (provinceUpper === 'HIGHLY URBANIZED CITY') {
      cityClass = 'HUC';
    } else if (provinceUpper === 'INDEPENDENT COMPONENT CITY') {
      cityClass = 'ICC';
    } else if (provinceUpper === 'COMPONENT CITY') {
      cityClass = 'CC';
    }

    // If it's a city class selection, filter by city_class AND PSGC prefix
    if (cityClass) {
      // console.log(`Fetching LGUs by city_class: ${cityClass}`);
      // console.log('Conference PSGC filter:', conference.psgc || 'none');

      let allLGUs: Array<{ name: string; psgc: string }> = [];
      const seenLGUs = new Set<string>();

      // If no PSGC filter is set, return all LGUs with the city class
      if (!conference.psgc || conference.psgc.trim() === '') {
        // console.log('No PSGC filter set - fetching all LGUs with city_class');
        const { data: lguData, error: lguError } = await supabase
          .from('lgus')
          .select('lguname, psgc, geolevel, city_class')
          .eq('city_class', cityClass)
          .in('geolevel', ['MUN', 'CITY'])
          .order('lguname', { ascending: true });

        if (lguError) {
          console.error('Database error fetching LGUs by city_class:', lguError);
          return NextResponse.json(
            { error: 'Failed to fetch LGUs' },
            { status: 500 }
          );
        }

        allLGUs = lguData?.map((row) => ({ name: row.lguname, psgc: row.psgc })) || [];
      } else {
        // Parse comma-separated PSGC prefixes
        const psgcPrefixes = conference.psgc
          .split(',')
          .map(p => p.trim())
          .filter(p => p !== '');

        // console.log('PSGC Prefixes parsed:', psgcPrefixes);

        // Query for each PSGC prefix
        for (const prefix of psgcPrefixes) {
          // console.log(`Querying LGUs for PSGC prefix: "${prefix}" with city_class=${cityClass}`);
          const { data: lguData, error: lguError } = await supabase
            .from('lgus')
            .select('lguname, psgc, geolevel, city_class')
            .eq('city_class', cityClass)
            .in('geolevel', ['MUN', 'CITY'])
            .ilike('psgc', `${prefix}%`)
            .order('lguname', { ascending: true });

          if (lguError) {
            console.error(`Database error fetching LGUs for PSGC prefix ${prefix}:`, lguError);
            continue; // Skip this prefix if there's an error
          }

          if (lguData) {
            for (const row of lguData) {
              // Check if PSGC starts with the prefix and has matching city_class
              if (row.psgc && row.psgc.startsWith(prefix) && row.lguname) {
                const lguKey = `${row.lguname}|${row.psgc}`;
                if (!seenLGUs.has(lguKey)) {
                  seenLGUs.add(lguKey);
                  allLGUs.push({ name: row.lguname, psgc: row.psgc });
                  // console.log(`  ✓ Added LGU: "${row.lguname}" (PSGC: ${row.psgc}, city_class: ${row.city_class})`);
                }
              }
            }
          }
        }

        // Sort LGUs alphabetically by name
        allLGUs.sort((a, b) => a.name.localeCompare(b.name));
      }

      // console.log(`Found ${allLGUs.length} LGUs with city_class=${cityClass}`);
      
      // if (allLGUs.length > 0) {
      //   console.log('LGUs (first 20):', allLGUs.slice(0, 20));
      // }

      // console.log('=== Final LGUs List ===');
      // console.log('Total LGUs:', allLGUs.length);
      // console.log('======================');

      return NextResponse.json(allLGUs, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Otherwise, use the normal province-based filtering
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
      // console.log(`No province found with name: ${province} and geolevel=PROV`);
      return NextResponse.json([]);
    }

    const provincePsgc = psgcData[0].psgc;
    // console.log('Province PSGC found:', provincePsgc);

    if (!provincePsgc || provincePsgc.length < 5) {
      console.error('Invalid PSGC - must be at least 5 characters:', provincePsgc);
      return NextResponse.json([]);
    }

    // Get first 5 digits of the province PSGC
    const firstFiveDigits = provincePsgc.substring(0, 5);
    const psgcPrefix = `${firstFiveDigits}%`;
    
    // console.log('First 5 digits of PSGC:', firstFiveDigits);
    // console.log('PSGC prefix pattern:', psgcPrefix);

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

    // console.log(`Found ${lguData?.length || 0} LGUs with PSGC starting with ${firstFiveDigits}`);
    
    // if (lguData && lguData.length > 0) {
    //   console.log('LGUs found:', lguData.map(l => ({ name: l.lguname, psgc: l.psgc, geolevel: l.geolevel })));
    // }

    const data = lguData?.map((row) => ({ name: row.lguname, psgc: row.psgc })) || [];
    
    // console.log('=== Final LGUs List ===');
    // console.log('Total LGUs:', data.length);
    // console.log('LGUs:', data);
    // console.log('======================');

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

