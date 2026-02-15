import { NextResponse } from 'next/server';
import { getConferencesByDomain } from '@/lib/conference';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * List all conferences (venues) for the current domain.
 * When conference table has multiple rows with same domain, landing page uses this to show venue selection.
 */
export async function GET(request: Request) {
  try {
    const hostname =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      'localhost';

    const venues = await getConferencesByDomain(hostname);

    return NextResponse.json(venues, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('API error getting venues:', error);
    return NextResponse.json(
      { error: 'Failed to get venues', details: error?.message },
      { status: 500 }
    );
  }
}
