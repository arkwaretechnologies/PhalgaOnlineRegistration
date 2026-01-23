import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const confcode = searchParams.get('confcode');

    if (!confcode) {
      return NextResponse.json(
        { error: 'Conference code is required' },
        { status: 400 }
      );
    }

    // console.log('=== Fetching Contacts ===');
    // console.log('Conference code:', confcode);

    // Fetch contacts from the contacts table, filtered by confcode
    const { data: contactData, error: contactError } = await supabase
      .from('contacts')
      .select('contact_no')
      .eq('confcode', confcode)
      .order('id', { ascending: true });

    if (contactError) {
      console.error('Database error fetching contacts:', contactError);
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      );
    }

    // console.log(`Found ${contactData?.length || 0} contacts for conference ${confcode}`);

    return NextResponse.json(contactData || [], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('=== API Error Fetching Contacts ===');
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts', details: error?.message },
      { status: 500 }
    );
  }
}