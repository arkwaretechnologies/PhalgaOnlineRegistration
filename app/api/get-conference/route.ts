import { NextResponse } from 'next/server';
import { getConferenceByDomain, getConferenceByConfcode } from '@/lib/conference';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const confcode = searchParams.get('confcode');

    if (confcode && confcode.trim()) {
      const conference = await getConferenceByConfcode(confcode.trim());
      if (!conference) {
        return NextResponse.json(
          { error: 'Conference not found for this confcode' },
          { status: 404 }
        );
      }
      return NextResponse.json(conference, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }

    const hostname =
      domain ||
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      'localhost';

    const conference = await getConferenceByDomain(hostname);

    if (!conference) {
      return NextResponse.json(
        { error: 'Conference not found for this domain' },
        { status: 404 }
      );
    }

    return NextResponse.json(conference, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('API error getting conference:', error);
    return NextResponse.json(
      { error: 'Failed to get conference information', details: error?.message },
      { status: 500 }
    );
  }
}
