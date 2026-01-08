import { NextResponse } from 'next/server';
import { getDbConnection } from '@/lib/db';

interface RegistrationData {
  CONFERENCE: string;
  PROVINCE: string;
  LGU: string;
  CONTACTPERSON: string;
  CONTACTNUMBER: string;
  EMAILADDRESS: string;
  DETAILCOUNT: string;
  [key: string]: string; // For dynamic participant fields
}

export async function POST(request: Request) {
  try {
    const formData: RegistrationData = await request.json();
    
    const db = getDbConnection();

    // Check registration count
    const [countRows] = await db.execute('SELECT COUNT(*) AS C FROM regd');
    const regcount = Array.isArray(countRows) && countRows.length > 0 
      ? (countRows[0] as { C: number }).C 
      : 0;

    if (regcount > 50) {
      return NextResponse.json(
        { error: 'Registration is already closed' },
        { status: 400 }
      );
    }

    const confcode = '2026-GCMIN';
    const province = formData.PROVINCE.toUpperCase();
    const lgu = formData.LGU.toUpperCase();
    const contactperson = formData.CONTACTPERSON.toUpperCase();
    const contactnum = formData.CONTACTNUMBER.toUpperCase();
    const email = formData.EMAILADDRESS.toLowerCase();

    // Insert header
    const regdate = new Date();
    const [headerResult] = await db.execute(
      `INSERT INTO REGH (CONFCODE, PROVINCE, LGU, CONTACTPERSON, CONTACTNUM, EMAIL, REGDATE) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        confcode,
        province,
        lgu,
        contactperson,
        contactnum,
        email,
        regdate
      ]
    );

    const regnum = (headerResult as any).insertId;
    const detailcount = parseInt(formData.DETAILCOUNT);

    // Insert details
    for (let i = 0; i < detailcount; i++) {
      const lastname = (formData[`LASTNAME|${i}`] || '').toUpperCase();
      const firstname = (formData[`FIRSTNAME|${i}`] || '').toUpperCase();
      const middleinit = (formData[`MI|${i}`] || '').toUpperCase();
      const designation = (formData[`DESIGNATION|${i}`] || '').toUpperCase();
      const brgy = (formData[`BRGY|${i}`] || '').toUpperCase();
      const tshirtsize = (formData[`TSHIRTSIZE|${i}`] || '').toUpperCase();
      const contactnumDetail = (formData[`CONTACTNUMBER|${i}`] || '').toUpperCase();
      const prcnum = (formData[`PRCNUM|${i}`] || '').toUpperCase();
      const expirydateStr = (formData[`EXPIRYDATE|${i}`] || '').trim();
      const emailDetail = (formData[`EMAIL|${i}`] || '').toLowerCase();

      // Convert expiry date string to Date object or null
      let expirydate: Date | null = null;
      if (expirydateStr) {
        const dateObj = new Date(expirydateStr);
        if (!isNaN(dateObj.getTime())) {
          expirydate = dateObj;
        }
      }

      await db.execute(
        `INSERT INTO regd (CONFCODE, REGNUM, LINENUM, LASTNAME, FIRSTNAME, MIDDLEINIT, DESIGNATION, BRGY, LGU, PROVINCE, TSHIRTSIZE, CONTACTNUM, PRCNUM, EXPIRYDATE, EMAIL) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          confcode,
          regnum,
          i,
          lastname,
          firstname,
          middleinit,
          designation,
          brgy,
          lgu,
          province,
          tshirtsize,
          contactnumDetail,
          prcnum,
          expirydate,
          emailDetail
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Your registration was successful. Your registration number is ${regnum}.`,
      regnum
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to submit registration' },
      { status: 500 }
    );
  }
}

