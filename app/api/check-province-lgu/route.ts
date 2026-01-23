import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
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
    // Note: regd table now uses regid (not regnum) as foreign key to regh
    const { data: regdData, error: regdError } = await supabase
      .from('regd')
      .select(`
        regid,
        confcode,
        province,
        lgu,
        regh!left(regid, status, confcode)
      `)
      .eq('province', province.toUpperCase())
      .eq('lgu', lgu.toUpperCase())
      .eq('confcode', confcode); // Add conference filter

    // console.log('=== Province-LGU Count Check ===');
    // console.log(`Conference: ${confcode}`);
    // console.log('Province:', province);
    // console.log('LGU:', lgu);
    // console.log('regdData length:', regdData?.length || 0);
    // console.log('regdError:', regdError);

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

    // console.log(`Province-LGU Registration Count: ${registrationCount}`);
    // console.log('Note: Province-LGU limit checking has been removed');
    // console.log('================================');

    // Return count only (limit checking removed)
    return NextResponse.json(
      { 
        count: registrationCount,
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
