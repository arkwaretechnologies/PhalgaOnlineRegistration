import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getProvinceLguLimit } from '@/lib/config';
import { getConferenceCode } from '@/lib/conference';

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get('province');
    const lgu = searchParams.get('lgu');

    if (!province || !lgu) {
      return NextResponse.json(
        { error: 'Province and LGU parameters are required' },
        { status: 400 }
      );
    }

    // Detect conference from domain
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const confcode = await getConferenceCode(hostname || undefined);

    // Get all regd records with matching province, lgu, and conference, joined with regh to check status
    // Count only records where status is NULL, PENDING, or APPROVED and same conference
    const { data: regdData, error: regdError } = await supabase
      .from('regd')
      .select(`
        regnum,
        confcode,
        province,
        lgu,
        regh!left(regnum, status, confcode)
      `)
      .eq('province', province.toUpperCase())
      .eq('lgu', lgu.toUpperCase())
      .eq('confcode', confcode); // Add conference filter

    console.log('=== Province-LGU Count Check ===');
    console.log(`Conference: ${confcode}`);
    console.log('Province:', province);
    console.log('LGU:', lgu);
    console.log('regdData length:', regdData?.length || 0);
    console.log('regdError:', regdError);

    if (regdError) {
      console.error('Database error:', regdError);
      return NextResponse.json(
        { 
          error: 'Failed to check Province-LGU registration status', 
          details: regdError.message
        },
        { status: 500 }
      );
    }

    // Filter records where status is NULL, PENDING, or APPROVED (case-insensitive) and same conference
    const validRecords = (regdData || []).filter((record: any) => {
      if (record.confcode !== confcode) {
        return false;
      }
      const regh = Array.isArray(record.regh) ? record.regh[0] : record.regh;
      if (!regh) {
        // If no regh record, include it (matches LEFT JOIN behavior with NULL status)
        return true;
      }
      if (regh.confcode && regh.confcode !== confcode) {
        return false;
      }
      const status = (regh.status || '').toString().toUpperCase().trim();
      return !status || status === 'PENDING' || status === 'APPROVED';
    });

    const registrationCount = validRecords.length;
    const limit = await getProvinceLguLimit();
    const isOpen = registrationCount < limit;

    console.log(`Province-LGU Registration Count: ${registrationCount}`);
    console.log(`Province-LGU Limit: ${limit}`);
    console.log(`Is Open: ${isOpen}`);
    console.log('================================');

    return NextResponse.json(
      { 
        count: registrationCount,
        limit: limit,
        isOpen: isOpen,
        province: province.toUpperCase(),
        lgu: lgu.toUpperCase(),
        conference: {
          confcode: confcode
        }
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error: any) {
    console.error('API error checking Province-LGU registration:', error);
    return NextResponse.json(
      { error: 'Failed to check Province-LGU registration status', details: error?.message },
      { status: 500 }
    );
  }
}
