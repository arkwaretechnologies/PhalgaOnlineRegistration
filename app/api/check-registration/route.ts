import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET() {
  try {
    const db = getDbConnection();
    const [rows] = await db.execute('SELECT COUNT(*) AS C FROM regd');
    const count = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { C: number }).C : 0;
    
    return NextResponse.json({ 
      count,
      isOpen: count < 6
    });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to check registration status' },
      { status: 500 }
    );
  }
}

