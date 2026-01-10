import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { isRegistrationOpen, getRegistrationLimit } from '@/lib/config';

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Use direct SELECT query matching the SQL:
    // SELECT COUNT(*) FROM "regd" d LEFT JOIN "regh" h ON d."regnum" = h."regnum"
    // WHERE h."status" IS NULL OR UPPER(TRIM(h."status")) = 'PENDING' OR UPPER(TRIM(h."status")) = 'APPROVED'
    
    // Step 1: Get all regd records with their regh data
    const { data: regdData, error: regdError } = await supabase
      .from('regd')
      .select(`
        regnum,
        regh!left(regnum, status)
      `);
    
    console.log('=== Direct Query Result ===');
    console.log('regdData length:', regdData?.length || 0);
    console.log('regdError:', regdError);
    
    if (regdError) {
      console.error('Database error with direct query:', regdError);
      return NextResponse.json(
        { 
          error: 'Failed to check registration status', 
          details: regdError.message
        },
        { status: 500 }
      );
    }
    
    // Step 2: Filter records where status is NULL, PENDING, or APPROVED (case-insensitive)
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
    
    console.log('=== Registration Count Check ===');
    console.log(`Total regd records: ${regdData?.length || 0}`);
    console.log(`Valid records (PENDING/APPROVED/NULL): ${registrationCount}`);
    console.log('Sample records:', regdData?.slice(0, 3).map((r: any) => ({
      regnum: r.regnum,
      regh_status: Array.isArray(r.regh) ? r.regh[0]?.status : r.regh?.status
    })));
    
    const limit = await getRegistrationLimit();
    const isOpen = await isRegistrationOpen(registrationCount);
    
    console.log(`Registration Count: ${registrationCount}`);
    console.log(`Registration Limit: ${limit}`);
    console.log(`Is Open: ${isOpen}`);
    console.log('================================');
    
    // Return response with no-cache headers to ensure fresh data
    return NextResponse.json(
      { 
        count: registrationCount,
        limit: limit,
        isOpen: isOpen
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
    console.error('API error checking registration:', error);
    return NextResponse.json(
      { error: 'Failed to check registration status', details: error?.message },
      { status: 500 }
    );
  }
}

