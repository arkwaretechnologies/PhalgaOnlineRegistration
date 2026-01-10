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
      console.error('=== Fetch Provinces Error: Conference not found ===');
      return NextResponse.json(
        { error: 'Conference not found for this domain' },
        { status: 404 }
      );
    }

    console.log('=== Fetching Provinces ===');
    console.log('Conference:', conference.confcode);
    console.log('Conference Name:', conference.name);
    console.log('Conference PSGC filter:', conference.psgc || 'none');

    // If no PSGC filter is set, return all provinces
    if (!conference.psgc || conference.psgc.trim() === '') {
      console.log('No PSGC filter set - fetching all provinces with geolevel=PROV');
      // Return all provinces (geolevel = 'PROV')
      const { data: allProvinces, error: allError } = await supabase
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

      const provinces = allProvinces?.map((row) => row.lguname) || [];
      
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
      
      console.log(`Fetched ${provinces.length} provinces (all provinces):`);
      console.log(`Fixed city class provinces: ${fixedCityClasses.length}`);
      console.log(`Total provinces: ${finalProvinces.length}`);
      console.log('Provinces list:', finalProvinces);
      console.log('========================');
      
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

    console.log('PSGC Prefixes parsed:', psgcPrefixes);

    if (psgcPrefixes.length === 0) {
      console.log('No valid PSGC prefixes found - returning empty array');
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
      console.log(`Querying provinces for PSGC prefix: "${prefix}"`);
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

      console.log(`  Found ${data?.length || 0} raw records for prefix "${prefix}"`);

      if (data && data.length > 0) {
        console.log(`  Raw data for prefix "${prefix}":`, JSON.stringify(data, null, 2));
      }

      if (data) {
        for (const row of data) {
          // Check if PSGC starts with the prefix (to handle partial matches correctly)
          if (row.psgc && row.psgc.startsWith(prefix) && row.lguname) {
            if (!seenProvinces.has(row.lguname)) {
              seenProvinces.add(row.lguname);
              allProvinces.push(row.lguname);
              console.log(`  ✓ Added province: "${row.lguname}" (PSGC: ${row.psgc})`);
            } else {
              console.log(`  ⊗ Skipped duplicate province: "${row.lguname}"`);
            }
          } else {
            console.log(`  ⊗ Filtered out: "${row.lguname || 'NO NAME'}" (PSGC: ${row.psgc || 'NO PSGC'}) - doesn't match criteria`);
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

    console.log(`=== Final Result ===`);
    console.log(`Fixed city class provinces: ${fixedCityClasses.length}`);
    console.log(`Regular provinces fetched: ${allProvinces.length}`);
    console.log(`Total provinces: ${finalProvinces.length}`);
    console.log('Provinces list:', finalProvinces);
    console.log('===================');

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
