import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { isProvinceLguRegistrationOpen, getProvinceLguLimit } from '@/lib/config';

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

    // Get all regd records with matching province and lgu, joined with regh to check status
    // Count only records where status is NULL, PENDING, or APPROVED
    const { data: regdData, error: regdError } = await supabase
      .from('regd')
      .select(`
        regnum,
        province,
        lgu,
        regh!left(regnum, status)
      `)
      .eq('province', province.toUpperCase())
      .eq('lgu', lgu.toUpperCase());

    console.log('=== Province-LGU Count Check ===');
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

    // Filter records where status is NULL, PENDING, or APPROVED (case-insensitive)
    const validRecords = (regdData || []).filter((record: any) => {
      const regh = Array.isArray(record.regh) ? record.regh[0] : record.regh;
      if (!regh) {
        // If no regh record, include it (matches LEFT JOIN behavior with NULL status)
        return true;
      }
      const status = (regh.status || '').toString().toUpperCase().trim();
      return !status || status === 'PENDING' || status === 'APPROVED';
    });

    const registrationCount = validRecords.length;
    const limit = getProvinceLguLimit();
    const isOpen = isProvinceLguRegistrationOpen(registrationCount);

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
        lgu: lgu.toUpperCase()
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
