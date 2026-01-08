import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('regd')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to check registration status' },
        { status: 500 }
      );
    }
    
    const registrationCount = count || 0;
    
    return NextResponse.json({ 
      count: registrationCount,
      isOpen: registrationCount < 6
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to check registration status' },
      { status: 500 }
    );
  }
}

