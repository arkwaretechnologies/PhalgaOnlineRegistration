import { NextResponse } from 'next/server';
import { isConferenceOnMaintenance, getConferenceByConfcode } from '@/lib/conference';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Check if the conference for the current domain (or confcode) is on maintenance.
 * Used by client-side MaintenanceGuard and middleware.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const confcodeParam = searchParams.get('confcode')?.trim();
    const hostname =
      request.headers.get('x-maintenance-check-host') ||
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      'localhost';

    let onMaintenance: boolean;
    let conference = null;
    if (confcodeParam) {
      conference = await getConferenceByConfcode(confcodeParam);
      onMaintenance = conference?.on_maintenance?.toUpperCase() === 'Y';
    } else {
      const result = await isConferenceOnMaintenance(hostname);
      onMaintenance = result.onMaintenance;
      conference = result.conference;
    }

    return NextResponse.json(
      {
        onMaintenance,
        conference: conference
          ? {
              confcode: conference.confcode,
              name: conference.name,
            }
          : null,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('check-maintenance API error:', message);
    return NextResponse.json(
      { onMaintenance: false, error: message },
      { status: 500 }
    );
  }
}
