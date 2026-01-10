import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getConferenceCode, getConferenceByDomain } from '@/lib/conference';
import { getRegistrationLimitByConference } from '@/lib/config';

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    // Detect conference from domain
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const confcode = await getConferenceCode(hostname || undefined);
    
    console.log(`=== Registration Check for Conference: ${confcode} ===`);
    
    // Step 1: Get all regd records for this conference with their regh data
    // Note: regd table now uses regid (not regnum) as foreign key to regh
    const { data: regdData, error: regdError } = await supabase
      .from('regd')
      .select(`
        regid,
        confcode,
        regh!left(regid, status, confcode)
      `)
      .eq('confcode', confcode); // Filter by conference code
    
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
    // AND ensure the regh record belongs to the same conference
    const validRecords = (regdData || []).filter((record: any) => {
      // First check if regd belongs to this conference
      if (record.confcode !== confcode) {
        return false;
      }
      
      const regh = Array.isArray(record.regh) ? record.regh[0] : record.regh;
      if (!regh) {
        // If no regh record, include it (matches LEFT JOIN behavior with NULL status)
        return true;
      }
      
      // Double-check regh belongs to same conference (if confcode exists in regh)
      if (regh.confcode && regh.confcode !== confcode) {
        return false;
      }
      
      const status = (regh.status || '').toString().toUpperCase().trim();
      return !status || status === 'PENDING' || status === 'APPROVED';
    });
    
    const registrationCount = validRecords.length;
    
    console.log('=== Registration Count Check ===');
    console.log(`Conference: ${confcode}`);
    console.log(`Total regd records: ${regdData?.length || 0}`);
    console.log(`Valid records (PENDING/APPROVED/NULL): ${registrationCount}`);
    console.log('Sample records:', regdData?.slice(0, 3).map((r: any) => ({
      regid: r.regid,
      confcode: r.confcode,
      regh_status: Array.isArray(r.regh) ? r.regh[0]?.status : r.regh?.status,
      regh_confcode: Array.isArray(r.regh) ? r.regh[0]?.confcode : r.regh?.confcode
    })));
    
    // Get limit from conference table (falls back to config table)
    const limit = await getRegistrationLimitByConference(confcode);
    const isOpen = registrationCount < limit;
    
    // Get conference details for response
    const conference = await getConferenceByDomain(hostname || undefined);
    
    console.log(`Registration Count: ${registrationCount}`);
    console.log(`Registration Limit: ${limit}`);
    console.log(`Is Open: ${isOpen}`);
    console.log('================================');
    
    // Return response with no-cache headers to ensure fresh data
    return NextResponse.json(
      { 
        count: registrationCount,
        limit: limit,
        isOpen: isOpen,
        conference: {
          confcode: conference?.confcode || confcode,
          name: conference?.name || null
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
    console.error('API error checking registration:', error);
    return NextResponse.json(
      { error: 'Failed to check registration status', details: error?.message },
      { status: 500 }
    );
  }
}

