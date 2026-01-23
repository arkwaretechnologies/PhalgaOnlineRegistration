import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getConferenceByDomain } from '@/lib/conference';

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    // Detect conference from domain
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const conference = await getConferenceByDomain(hostname || undefined);

    if (!conference) {
      return NextResponse.json(
        { error: 'Conference not found for this domain. Please check your configuration.' },
        { status: 400 }
      );
    }

    const confcode = conference.confcode;
    // console.log(`=== Getting Registration for Conference: ${confcode} (${conference.name}) ===`);

    const { searchParams } = new URL(request.url);
    const regId = searchParams.get('transId') || searchParams.get('regId'); // Support both for backward compatibility

    if (!regId) {
      return NextResponse.json(
        { error: 'Registration ID parameter is required' },
        { status: 400 }
      );
    }

    // Get registration header - filter by both regid and confcode
    const { data: headerData, error: headerError } = await supabase
      .from('regh')
      .select('*')
      .eq('regid', regId.toUpperCase())
      .eq('confcode', confcode)
      .single();

    // console.log('=== Get Registration Debug ===');
    // console.log('Conference:', confcode);
    // console.log('regId:', regId);
    // console.log('headerData:', JSON.stringify(headerData, null, 2));
    // console.log('headerError:', headerError);

    if (headerError || !headerData) {
      // Check if it's a "not found" error or if confcode doesn't match
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

    // Double-check that the registration belongs to the current conference
    if (headerData.confcode && headerData.confcode !== confcode) {
      console.warn(`Registration ${regId} belongs to conference ${headerData.confcode}, but current conference is ${confcode}`);
      return NextResponse.json(
        { error: 'Registration ID not found for this conference' },
        { status: 404 }
      );
    }

    // Get registration details - filter by both regid and confcode
    // Note: regd table now uses regid (not regnum) as foreign key to regh
    const { data: detailData, error: detailError } = await supabase
      .from('regd')
      .select('*')
      .eq('regid', headerData.regid)
      .eq('confcode', confcode)
      .order('linenum', { ascending: true });

    if (detailError) {
      console.error('Detail fetch error:', detailError);
      return NextResponse.json(
        { error: 'Failed to fetch registration details' },
        { status: 500 }
      );
    }

    // Return response with no-cache headers to ensure fresh data
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
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registration' },
      { status: 500 }
    );
  }
}
