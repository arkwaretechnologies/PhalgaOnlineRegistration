import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getConferenceCode, getConferenceByDomain } from '@/lib/conference';
import { getRegistrationLimitByConference } from '@/lib/config';
import { createTimeout, withTimeout } from '@/lib/security';

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  // Create timeout for request (10 seconds for read operations)
  const { abortController, timeoutId, timeoutPromise } = createTimeout(10000);

  try {
    // Detect conference from domain
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const confcode = await getConferenceCode(hostname || undefined);
    
    // console.log(`=== Registration Check for Conference: ${confcode} ===`);
    
    // Step 1: Get all regd records for this conference with their regh data
    // Note: regd table now uses regid (not regnum) as foreign key to regh
    const { data: regdData, error: regdError } = await withTimeout(
      supabase
        .from('regd')
        .select(`
          regid,
          confcode,
          regh!left(regid, status, confcode)
        `)
        .eq('confcode', confcode),
      timeoutPromise
    ) as { data: any[] | null; error: any };
    
    // console.log('=== Direct Query Result ===');
    // console.log('regdData length:', regdData?.length || 0);
    // console.log('regdError:', regdError);
    
    if (regdError) {
      console.error('Database error with direct query:', regdError);
      clearTimeout(timeoutId);
      return NextResponse.json(
        { 
          error: 'Failed to check registration status', 
          details: regdError.message
        },
        { status: 500 }
      );
    }
    
    // Step 2: Filter records where status is PENDING or APPROVED (case-insensitive)
    // AND ensure the regh record belongs to the same conference
    const validRecords = (regdData || []).filter((record: any) => {
      // First check if regd belongs to this conference
      if (record.confcode !== confcode) {
        return false;
      }
      
      const regh = Array.isArray(record.regh) ? record.regh[0] : record.regh;
      // Only count records that have a regh record with status
      if (!regh) {
        return false;
      }
      
      // Double-check regh belongs to same conference (if confcode exists in regh)
      if (regh.confcode && regh.confcode !== confcode) {
        return false;
      }
      
      const status = (regh.status || '').toString().toUpperCase().trim();
      return status === 'PENDING' || status === 'APPROVED';
    });
    
    const registrationCount = validRecords.length;
    
    // console.log('=== Registration Count Check ===');
    // console.log(`Conference: ${confcode}`);
    // console.log(`Total regd records: ${regdData?.length || 0}`);
    // console.log(`Valid records (PENDING/APPROVED only): ${registrationCount}`);
    // console.log('Sample records:', regdData?.slice(0, 3).map((r: any) => ({
    //   regid: r.regid,
    //   confcode: r.confcode,
    //   regh_status: Array.isArray(r.regh) ? r.regh[0]?.status : r.regh?.status,
    //   regh_confcode: Array.isArray(r.regh) ? r.regh[0]?.confcode : r.regh?.confcode
    // })));
    
    // Get limit from conference table (falls back to config table)
    const limit = await getRegistrationLimitByConference(confcode);
    const isOpen = registrationCount < limit;
    
    // Get conference details for response
    const conference = await getConferenceByDomain(hostname || undefined);
    
    // console.log(`Registration Count: ${registrationCount}`);
    // console.log(`Registration Limit: ${limit}`);
    // console.log(`Is Open: ${isOpen}`);
    // console.log('================================');
    
    clearTimeout(timeoutId);
    
    // Return response with short cache (5 seconds) to reduce load while keeping data relatively fresh
    return NextResponse.json(
      { 
        count: registrationCount,
        limit: limit,
        isOpen: isOpen,
        regAlertCount: conference?.reg_alert_count || 100, // Default to 100 if not set
        conference: {
          confcode: conference?.confcode || confcode,
          name: conference?.name || null
        }
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
        }
      }
    );
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Handle timeout/abort errors
    if (error.name === 'AbortError' || abortController.signal.aborted) {
      console.error('Request timeout:', error);
      return NextResponse.json(
        { error: 'Request timeout. Please try again.' },
        { status: 408 }
      );
    }

    console.error('API error checking registration:', error);
    return NextResponse.json(
      { error: 'Failed to check registration status', details: error?.message },
      { status: 500 }
    );
  }
}

