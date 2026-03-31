import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Health check: verifies app can reach the database.
 * Used by ConnectionGuard on every page. Does not expose any env variables.
 */
export async function GET() {
  try {
    const { error } = await supabase
      .from('conference')
      .select('confcode')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Health check DB error:', error.message);
      return NextResponse.json(
        { ok: false },
        { status: 503, headers: { 'Cache-Control': 'no-store, no-cache' } }
      );
    }

    return NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store, no-cache' } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('Health check error:', message);
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { 'Cache-Control': 'no-store, no-cache' } }
    );
  }
}
