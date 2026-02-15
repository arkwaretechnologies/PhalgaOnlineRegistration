import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getConferenceByDomain, getConferenceByConfcode } from '@/lib/conference';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const confcodeParam = searchParams.get('confcode')?.trim();
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');

    const conference = confcodeParam
      ? await getConferenceByConfcode(confcodeParam)
      : await getConferenceByDomain(hostname || undefined);

    if (!conference) {
      console.error('=== Fetch Provinces Error: Conference not found ===');
      return NextResponse.json(
        { error: 'Conference not found for this domain' },
        { status: 404 }
      );
    }

    // console.log('=== Fetching Provinces ===');
    // console.log('Conference:', conference.confcode);
    // console.log('Conference Name:', conference.name);
    // console.log('Conference PSGC filter:', conference.psgc || 'none');
    // console.log('Conference include_psgc filter:', conference.include_psgc || 'none');

    // exclude_psgc applies only to LGU-level codes (MUN, CITY, HUC) in get-lgus — not to provinces

    // When include_psgc is set: (1) For psgc 2-digit codes that do NOT exist in include_psgc first 2 digits,
    // show all provinces under that 2-digit. (2) For psgc 2-digit codes that DO exist in include_psgc,
    // show only provinces from include_psgc first 5 digits.
    const includePsgcRaw = conference.include_psgc;
    const psgcRaw = conference.psgc;
    if (includePsgcRaw && includePsgcRaw.trim() !== '' && psgcRaw && psgcRaw.trim() !== '') {
      const firstTwoFromInclude = new Set<string>();
      const firstTwoFromPsgc = new Set<string>();
      includePsgcRaw.split(',').map(p => p.trim()).filter(p => p !== '' && p.length >= 2).forEach(c => firstTwoFromInclude.add(c.substring(0, 2)));
      psgcRaw.split(',').map(p => p.trim()).filter(p => p !== '' && p.length >= 2).forEach(c => firstTwoFromPsgc.add(c.substring(0, 2)));

      const allProvinces: string[] = [];
      const seenProvinces = new Set<string>();

      // (1) Psgc 2-digit codes that do NOT exist in include_psgc first 2 digits: show all their provinces
      for (const d2 of Array.from(firstTwoFromPsgc)) {
        if (firstTwoFromInclude.has(d2)) continue;
        const { data, error } = await supabase
          .from('lgus')
          .select('lguname, psgc')
          .eq('geolevel', 'PROV')
          .ilike('psgc', `${d2}%`)
          .order('lguname', { ascending: true });
        if (error) {
          console.error(`Database error fetching provinces for PSGC 2-digit ${d2}:`, error);
          continue;
        }
if (data) {
        for (const row of data) {
            if (row.psgc && row.psgc.startsWith(d2) && row.lguname && !seenProvinces.has(row.lguname)) {
              seenProvinces.add(row.lguname);
              allProvinces.push(row.lguname);
            }
          }
        }
      }

      // (2) Psgc 2-digit codes that DO exist in include_psgc: show only provinces from include_psgc first 5 digits
      const existsOnPsgc = Array.from(firstTwoFromInclude).some(d2 => firstTwoFromPsgc.has(d2));
      if (existsOnPsgc) {
        const firstFiveDigitSet = new Set(
          includePsgcRaw.split(',').map(p => p.trim()).filter(p => p.length >= 5).map(p => p.substring(0, 5))
        );
        for (const prefix of Array.from(firstFiveDigitSet)) {
          const { data, error } = await supabase
            .from('lgus')
            .select('lguname, psgc')
            .eq('geolevel', 'PROV')
            .ilike('psgc', `${prefix}%`)
            .order('lguname', { ascending: true });
          if (error) {
            console.error(`Database error fetching provinces for PSGC prefix ${prefix}:`, error);
            continue;
          }
          if (data) {
            for (const row of data) {
              if (row.psgc && row.psgc.length >= 5 && firstFiveDigitSet.has(row.psgc.substring(0, 5)) && row.lguname) {
                if (!seenProvinces.has(row.lguname)) {
                  seenProvinces.add(row.lguname);
                  allProvinces.push(row.lguname);
                }
              }
            }
          }
        }
      }

      if (allProvinces.length > 0) {
        allProvinces.sort((a, b) => a.localeCompare(b));
        const fixedCityClasses = [
          'HIGHLY URBANIZED CITY',
          'INDEPENDENT COMPONENT CITY',
          'COMPONENT CITY'
        ];
        const finalProvinces = [...fixedCityClasses, ...allProvinces];
        return NextResponse.json(finalProvinces, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
      }
    }

    // No include_psgc "exists on psgc", or no include_psgc: use psgc for provinces (or all)
    if (!conference.psgc || conference.psgc.trim() === '') {
      // console.log('No PSGC filter set - fetching all provinces with geolevel=PROV');
      // Return all provinces (geolevel = 'PROV')
      const { data: allProvincesData, error: allError } = await supabase
        .from('lgus')
        .select('lguname')
        .eq('geolevel', 'PROV')
        .order('lguname', { ascending: true });

      if (allError) {
        console.error('Database error fetching all provinces:', allError);
        return NextResponse.json(
          { error: 'Failed to fetch provinces' },
          { status: 500 }
        );
      }

      const provinces = allProvincesData?.map((row) => row.lguname) ?? [];
      
      // Add fixed city class provinces at the top
      const fixedCityClasses = [
        'HIGHLY URBANIZED CITY',
        'INDEPENDENT COMPONENT CITY',
        'COMPONENT CITY'
      ];
      
      // Sort provinces alphabetically
      provinces.sort((a, b) => a.localeCompare(b));
      
      // Combine fixed provinces at the top with fetched provinces
      const finalProvinces = [...fixedCityClasses, ...provinces];
      
      // console.log(`Fetched ${provinces.length} provinces (all provinces):`);
      // console.log(`Fixed city class provinces: ${fixedCityClasses.length}`);
      // console.log(`Total provinces: ${finalProvinces.length}`);
      // console.log('Provinces list:', finalProvinces);
      // console.log('========================');
      
      return NextResponse.json(finalProvinces, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Parse comma-separated PSGC prefixes
    const psgcPrefixes = conference.psgc
      .split(',')
      .map(p => p.trim())
      .filter(p => p !== '');

    // console.log('PSGC Prefixes parsed:', psgcPrefixes);

    if (psgcPrefixes.length === 0) {
      // console.log('No valid PSGC prefixes found - returning empty array');
      return NextResponse.json([], {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Build query to filter provinces by PSGC prefixes
    // PSGC in lgus table should start with one of the prefixes, and geolevel = 'PROV'
    const allProvinces: string[] = [];
    const seenProvinces = new Set<string>();

    // Query for each PSGC prefix
    for (const prefix of psgcPrefixes) {
      // console.log(`Querying provinces for PSGC prefix: "${prefix}"`);
      const { data, error } = await supabase
        .from('lgus')
        .select('lguname, psgc')
        .eq('geolevel', 'PROV')
        .ilike('psgc', `${prefix}%`)
        .order('lguname', { ascending: true });

      if (error) {
        console.error(`Database error fetching provinces for PSGC prefix ${prefix}:`, error);
        continue; // Skip this prefix if there's an error
      }

      // console.log(`  Found ${data?.length || 0} raw records for prefix "${prefix}"`);

      // if (data && data.length > 0) {
      //   console.log(`  Raw data for prefix "${prefix}":`, JSON.stringify(data, null, 2));
      // }

      if (data) {
        for (const row of data) {
          // Check if PSGC starts with the prefix (to handle partial matches correctly); exclude exclude_psgc
          if (row.psgc && row.psgc.startsWith(prefix) && row.lguname) {
            if (!seenProvinces.has(row.lguname)) {
              seenProvinces.add(row.lguname);
              allProvinces.push(row.lguname);
              // console.log(`  ✓ Added province: "${row.lguname}" (PSGC: ${row.psgc})`);
            } else {
              // console.log(`  ⊗ Skipped duplicate province: "${row.lguname}"`);
            }
          } else {
            // console.log(`  ⊗ Filtered out: "${row.lguname || 'NO NAME'}" (PSGC: ${row.psgc || 'NO PSGC'}) - doesn't match criteria`);
          }
        }
      }
    }

    // Sort provinces alphabetically
    allProvinces.sort((a, b) => a.localeCompare(b));

    // Add fixed city class provinces at the top
    const fixedCityClasses = [
      'HIGHLY URBANIZED CITY',
      'INDEPENDENT COMPONENT CITY',
      'COMPONENT CITY'
    ];
    
    // Combine fixed provinces at the top with fetched provinces
    const finalProvinces = [...fixedCityClasses, ...allProvinces];

    // console.log(`=== Final Result ===`);
    // console.log(`Fixed city class provinces: ${fixedCityClasses.length}`);
    // console.log(`Regular provinces fetched: ${allProvinces.length}`);
    // console.log(`Total provinces: ${finalProvinces.length}`);
    // console.log('Provinces list:', finalProvinces);
    // console.log('===================');

    return NextResponse.json(finalProvinces, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('=== API Error Fetching Provinces ===');
    console.error('Error:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('====================================');
    return NextResponse.json(
      { error: 'Failed to fetch provinces', details: error?.message },
      { status: 500 }
    );
  }
}
