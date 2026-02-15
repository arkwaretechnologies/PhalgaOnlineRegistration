import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getConferenceByDomain, getConferenceByConfcode, getConferencesByDomain } from '@/lib/conference';
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
    const regId = searchParams.get('transId') || searchParams.get('regId');
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');

    if (!regId) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Registration ID parameter is required' },
        { status: 400 }
      );
    }

    const regIdUpper = regId.toUpperCase();
    let conference: Awaited<ReturnType<typeof getConferenceByDomain>> = null;
    let headerData: any = null;
    let headerError: any = null;

    if (confcodeParam) {
      conference = await getConferenceByConfcode(confcodeParam);
      if (!conference) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: 'Conference not found for this confcode' },
          { status: 404 }
        );
      }
      const res = await withTimeout(
        supabase
          .from('regh')
          .select('*')
          .eq('regid', regIdUpper)
          .eq('confcode', conference.confcode)
          .single(),
        timeoutPromise
      ) as { data: any | null; error: any };
      headerData = res.data;
      headerError = res.error;
    } else {
      const venues = await getConferencesByDomain(hostname || undefined);
      for (const v of venues) {
        const res = await withTimeout(
          supabase
            .from('regh')
            .select('*')
            .eq('regid', regIdUpper)
            .eq('confcode', v.confcode)
            .maybeSingle(),
          timeoutPromise
        ) as { data: any | null; error: any };
        if (!res.error && res.data) {
          headerData = res.data;
          conference = v;
          break;
        }
      }
      if (!conference) {
        conference = await getConferenceByDomain(hostname || undefined);
        if (conference) {
          const res = await withTimeout(
            supabase
              .from('regh')
              .select('*')
              .eq('regid', regIdUpper)
              .eq('confcode', conference.confcode)
              .single(),
            timeoutPromise
          ) as { data: any | null; error: any };
          headerData = res.data;
          headerError = res.error;
        }
      }
    }

    if (!conference) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Conference not found for this domain. Please check your configuration.' },
        { status: 400 }
      );
    }

    const confcode = conference.confcode;

    if (headerError || !headerData) {
      clearTimeout(timeoutId);
      if (headerError?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Registration ID not found for this conference' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Registration ID not found' },
        { status: 404 }
      );
    }

    // Get registration details - filter by both regid and confcode
    // Note: regd table now uses regid (not regnum) as foreign key to regh
    const { data: detailData, error: detailError } = await withTimeout(
      supabase
        .from('regd')
        .select('*')
        .eq('regid', headerData.regid)
        .eq('confcode', confcode)
        .order('linenum', { ascending: true }),
      timeoutPromise
    ) as { data: any[] | null; error: any };

    if (detailError) {
      console.error('Detail fetch error:', detailError);
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Failed to fetch registration details' },
        { status: 500 }
      );
    }

    clearTimeout(timeoutId);
    
    // Return response with no-cache headers to ensure fresh data (batchnum comes from regh column)
    return NextResponse.json(
      {
        header: headerData,
        details: detailData || []
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
    clearTimeout(timeoutId);
    
    // Handle timeout/abort errors
    if (error.name === 'AbortError' || abortController.signal.aborted) {
      console.error('Request timeout:', error);
      return NextResponse.json(
        { error: 'Request timeout. Please try again.' },
        { status: 408 }
      );
    }

    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registration' },
      { status: 500 }
    );
  }
}
