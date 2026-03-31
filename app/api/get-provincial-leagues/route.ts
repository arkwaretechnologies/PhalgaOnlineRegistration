import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getConferenceByDomain, getConferenceByConfcode } from '@/lib/conference';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const confcodeParam = searchParams.get('confcode')?.trim();
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');

    const conference = confcodeParam
      ? await getConferenceByConfcode(confcodeParam)
      : await getConferenceByDomain(hostname || undefined);

    if (!conference) {
      return NextResponse.json(
        { error: 'Conference not found for this domain. Please check your configuration.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('provincial_leagues')
      .select('acronym, name')
      .order('acronym', { ascending: true });

    if (error) {
      console.error('Database error fetching provincial leagues:', error);
      return NextResponse.json(
        { error: 'Failed to fetch provincial leagues' },
        { status: 500 }
      );
    }

    const leagues = (data || [])
      .filter(row => row.acronym || row.name)
      .map(row => {
        const acronym = (row.acronym || '').toString().trim();
        const name = (row.name || '').toString().trim();
        const label = [acronym, name].filter(Boolean).join(' - ');
        return {
          acronym,
          name,
          label,
        };
      })
      .filter(row => row.label)
      .sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json(leagues, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err) {
    console.error('Unexpected error fetching provincial leagues:', err);
    return NextResponse.json(
      { error: 'Failed to fetch provincial leagues' },
      { status: 500 }
    );
  }
}

