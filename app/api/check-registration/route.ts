import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getConferenceCode, getConferenceByDomain, getConferenceByConfcode } from '@/lib/conference';
import { getRegistrationLimitByConference } from '@/lib/config';
import { createTimeout, withTimeout } from '@/lib/security';

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  // Create timeout for request (10 seconds for read operations)
  const { abortController, timeoutId, timeoutPromise } = createTimeout(10000);

  try {
    const { searchParams } = new URL(request.url);
    const confcodeParam = searchParams.get('confcode')?.trim();
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');

    let confcode: string;
    let conference = null;
    if (confcodeParam) {
      conference = await getConferenceByConfcode(confcodeParam);
      if (!conference) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: 'Conference not found for this confcode' },
          { status: 404 }
        );
      }
      confcode = conference.confcode;
    } else {
      confcode = await getConferenceCode(hostname || undefined);
      conference = await getConferenceByDomain(hostname || undefined);
    }
    
    // console.log(`[check-registration] Hostname: ${hostname}`);
    // console.log(`[check-registration] Detected confcode: "${confcode}"`);
    // console.log(`[check-registration] Comparing regh.confcode to: "${confcode}"`);
    
    // Step 1: Get all regd rows (no filter - EXISTS query checks all regd)
    // SQL equivalent: SELECT COUNT(*) FROM regd WHERE EXISTS(...)
    // Fetch all rows using pagination (Supabase defaults to 1000 rows)
    let allRegdData: any[] = [];
    let regdPage = 0;
    const regdPageSize = 1000;
    let hasMoreRegd = true;

    while (hasMoreRegd) {
      const { data: regdPageData, error: regdError } = await withTimeout(
        supabase
          .from('regd')
          .select('regid')
          .range(regdPage * regdPageSize, (regdPage + 1) * regdPageSize - 1),
        timeoutPromise
      ) as { data: any[] | null; error: any };

      if (regdError) {
        console.error('Database error fetching regd:', regdError);
        clearTimeout(timeoutId);
        return NextResponse.json(
          { 
            error: 'Failed to check registration status', 
            details: regdError.message
          },
          { status: 500 }
        );
      }

      if (regdPageData && regdPageData.length > 0) {
        allRegdData = allRegdData.concat(regdPageData);
        hasMoreRegd = regdPageData.length === regdPageSize;
        regdPage++;
      } else {
        hasMoreRegd = false;
      }
    }

    // console.log(`[check-registration] Fetched ${allRegdData.length} regd rows (across ${regdPage} pages)`);

    // Step 2: Get ALL regh rows (no filter) to check EXISTS condition
    // The EXISTS query checks confcode in the condition, not in the fetch
    // Fetch all rows using pagination
    let reghData: any[] = [];
    let reghPage = 0;
    const reghPageSize = 1000;
    let hasMoreRegh = true;

    while (hasMoreRegh) {
      const { data: reghPageData, error: reghError } = await withTimeout(
        supabase
          .from('regh')
          .select('regid, confcode, status')
          .range(reghPage * reghPageSize, (reghPage + 1) * reghPageSize - 1),
        timeoutPromise
      ) as { data: any[] | null; error: any };

      if (reghError) {
        console.error('Database error fetching regh:', reghError);
        clearTimeout(timeoutId);
        return NextResponse.json(
          { 
            error: 'Failed to check registration status', 
            details: reghError.message
          },
          { status: 500 }
        );
      }

      if (reghPageData && reghPageData.length > 0) {
        reghData = reghData.concat(reghPageData);
        hasMoreRegh = reghPageData.length === reghPageSize;
        reghPage++;
      } else {
        hasMoreRegh = false;
      }
    }

    // console.log(`[check-registration] Fetched ${reghData.length} regh rows (across ${reghPage} pages)`);

    // Build a map of regh by regid for quick EXISTS lookup
    // Key: regid, Value: array of ALL regh records (confcode check happens in EXISTS condition)
    const reghByRegid = new Map<number, any[]>();
    (reghData || []).forEach((regh: any) => {
      if (!reghByRegid.has(regh.regid)) {
        reghByRegid.set(regh.regid, []);
      }
      reghByRegid.get(regh.regid)!.push(regh);
    });

    // Log sample confcode values from regh for debugging
    // const sampleReghConfcodes = Array.from(new Set((reghData || []).slice(0, 10).map((r: any) => r.confcode)));
    // console.log(`[check-registration] Sample regh.confcode values found: ${JSON.stringify(sampleReghConfcodes)}`);
    // console.log(`[check-registration] Comparing regh.confcode === "${confcode}"`);

    // Step 3: Count ALL regd rows (not regh rows) using EXISTS logic
    // SQL: SELECT COUNT(*) FROM regd WHERE EXISTS(SELECT * FROM regh WHERE regid=regd.regid AND confcode='...' AND status='PENDING')
    // SQL: SELECT COUNT(*) FROM regd WHERE EXISTS(SELECT * FROM regh WHERE regid=regd.regid AND confcode='...' AND status='APPROVED')
    // COUNT(*) counts all regd rows, not distinct regid values
    let pendingCount = 0;
    let approvedCount = 0;

    // console.log(`[check-registration] Total regd rows to check: ${allRegdData?.length || 0}`);
    // console.log(`[check-registration] Total regh rows for conference ${confcode}: ${reghData?.length || 0}`);

    (allRegdData || []).forEach((regd: any) => {
      const regdRegid = regd.regid;
      const reghRecords = reghByRegid.get(regdRegid) || [];
      
      // Check EXISTS for PENDING: EXISTS regh where regid=regd.regid and confcode=confcode and status='PENDING'
      // Count this regd row if EXISTS condition is true
      const hasPending = reghRecords.some((regh: any) => {
        const reghConfcode = (regh.confcode || '').toString().trim();
        const status = (regh.status || '').toString().toUpperCase().trim();
        const matches = reghConfcode === confcode && status === 'PENDING';
        return matches;
      });
      
      if (hasPending) {
        pendingCount++;
      }

      // Check EXISTS for APPROVED: EXISTS regh where regid=regd.regid and confcode=confcode and status='APPROVED'
      // Count this regd row if EXISTS condition is true
      const hasApproved = reghRecords.some((regh: any) => {
        const reghConfcode = (regh.confcode || '').toString().trim();
        const status = (regh.status || '').toString().toUpperCase().trim();
        const matches = reghConfcode === confcode && status === 'APPROVED';
        return matches;
      });
      
      if (hasApproved) {
        approvedCount++;
      }
    });
    
    // Count is the total number of regd rows that match the EXISTS condition (matches SQL COUNT(*))
    const registrationCount = pendingCount + approvedCount;
    
    // Log individual counts and total with SQL equivalent
    // console.log(`[check-registration] ========================================`);
    // console.log(`[check-registration] SQL Query 1:`);
    // console.log(`[check-registration]   SELECT COUNT(*) FROM regd WHERE EXISTS(SELECT * FROM regh WHERE regid=regd.regid AND confcode='${confcode}' AND status='PENDING')`);
    // console.log(`[check-registration]   Expected result: 2832`);
    // console.log(`[check-registration]   Actual result: ${pendingCount}`);
    // console.log(`[check-registration] SQL Query 2:`);
    // console.log(`[check-registration]   SELECT COUNT(*) FROM regd WHERE EXISTS(SELECT * FROM regh WHERE regid=regd.regid AND confcode='${confcode}' AND status='APPROVED')`);
    // console.log(`[check-registration]   Expected result: 3237`);
    // console.log(`[check-registration]   Actual result: ${approvedCount}`);
    // console.log(`[check-registration] Total (PENDING + APPROVED): ${registrationCount}`);
    // console.log(`[check-registration] ========================================`);
    
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
    
    // conference already resolved at top (by confcode param or domain)
    
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

