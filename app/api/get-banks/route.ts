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

    // console.log('=== Fetching Banks ===');
    // console.log('Conference code:', confcode);

    // Fetch banks from the banks table, filtered by confcode
    const { data: bankData, error: bankError } = await supabase
      .from('banks')
      .select('bank_name, acct_no, payee')
      .eq('confcode', confcode)
      .order('id', { ascending: true });

    if (bankError) {
      console.error('Database error fetching banks:', bankError);
      return NextResponse.json(
        { error: 'Failed to fetch banks' },
        { status: 500 }
      );
    }

    // console.log(`Found ${bankData?.length || 0} banks for conference ${confcode}`);

    return NextResponse.json(bankData || [], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    console.error('=== API Error Fetching Banks ===');
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch banks', details: error?.message },
      { status: 500 }
    );
  }
}