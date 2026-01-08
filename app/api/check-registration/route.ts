import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function GET() {
  try {
    // Primary method: Fetch data and count manually
    // This method works reliably with RLS policies
    const { data, error } = await supabase
      .from('regd')
      .select('regnum, linenum');
    
    if (error) {
      console.error('Database error checking registration count:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      return NextResponse.json(
        { 
          error: 'Failed to check registration status', 
          details: error.message
        },
        { status: 500 }
      );
    }
    
    // Count total rows (participants)
    const registrationCount = data?.length || 0;
    
    // Registration closes when count >= 3 (matches submit-registration logic)
    // So isOpen = true when count < 3, false when count >= 3
    const isOpen = registrationCount <= 3;
    
    // Log for debugging
    console.log(`Registration check: count=${registrationCount}, isOpen=${isOpen}, records=${data?.length || 0}`);
    
    return NextResponse.json({ 
      count: registrationCount,
      isOpen: isOpen
    });
  } catch (error: any) {
    console.error('API error checking registration:', error);
    return NextResponse.json(
      { error: 'Failed to check registration status', details: error?.message },
      { status: 500 }
    );
  }
}

