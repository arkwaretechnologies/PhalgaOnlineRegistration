import { NextResponse } from 'next/server';
import { isConferenceOnMaintenance } from '@/lib/conference';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Check if the conference for the current domain is on maintenance.
 * Used by client-side MaintenanceGuard and middleware.
 */
export async function GET(request: Request) {
  try {
    // Allow middleware to pass the original host for maintenance check
    const hostname =
      request.headers.get('x-maintenance-check-host') ||
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      'localhost';

    const { onMaintenance, conference } = await isConferenceOnMaintenance(hostname);

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
