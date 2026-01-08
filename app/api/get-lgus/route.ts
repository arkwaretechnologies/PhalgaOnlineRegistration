import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const province = searchParams.get('province');

    if (!province) {
      return NextResponse.json(
        { error: 'Province parameter is required' },
        { status: 400 }
      );
    }

    const db = getDbConnection();
    
    // Get PSGC for the province
    const [psgcRows] = await db.execute(
      "SELECT PSGC FROM LGUS WHERE LGUNAME = ?",
      [province]
    );

    if (!Array.isArray(psgcRows) || psgcRows.length === 0) {
      return NextResponse.json([]);
    }

    const psgc = (psgcRows[0] as { PSGC: string }).PSGC;
    const subgeo = psgc.substring(0, 5) + '%';

    // Get LGUs in the province
    const [lguRows] = await db.execute(
      "SELECT LGUNAME FROM LGUS WHERE PSGC LIKE ? AND (GEOLEVEL = 'MUN' OR GEOLEVEL = 'CITY') ORDER BY LGUNAME",
      [subgeo]
    );

    const data = Array.isArray(lguRows)
      ? lguRows.map((row: any) => row.LGUNAME)
      : [];

    return NextResponse.json(data);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LGUs' },
      { status: 500 }
    );
  }
}

