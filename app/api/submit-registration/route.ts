import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

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

// Function to generate random 6-character alphanumeric string
function generateTransId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to generate unique TRANSID that doesn't exist in database
async function generateUniqueTransId(): Promise<string> {
  let transId: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop

  while (!isUnique && attempts < maxAttempts) {
    transId = generateTransId();
    
    // Check if TRANSID already exists
    const { data, error } = await supabase
      .from('REGH')
      .select('TRANSID')
      .eq('TRANSID', transId)
      .limit(1);
    
    if (error) {
      throw new Error(`Failed to check TRANSID uniqueness: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      isUnique = true;
    } else {
      attempts++;
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique TRANSID after multiple attempts');
  }

  return transId!;
}

export async function POST(request: Request) {
  try {
    const formData: RegistrationData = await request.json();
    
    // Check registration count
    const { count: regcount, error: countError } = await supabase
      .from('regd')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Database error:', countError);
      return NextResponse.json(
        { error: 'Failed to check registration status' },
        { status: 500 }
      );
    }

    if ((regcount || 0) > 50) {
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

    // Generate unique TRANSID
    const transId = await generateUniqueTransId();

    // Insert header
    const regdate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
    const { data: headerData, error: headerError } = await supabase
      .from('REGH')
      .insert({
        CONFCODE: confcode,
        PROVINCE: province,
        LGU: lgu,
        CONTACTPERSON: contactperson,
        CONTACTNUM: contactnum,
        EMAIL: email,
        REGDATE: regdate,
        TRANSID: transId
      })
      .select('REGNUM')
      .single();

    if (headerError) {
      console.error('Header insert error:', headerError);
      return NextResponse.json(
        { error: 'Failed to create registration header' },
        { status: 500 }
      );
    }

    const regnum = headerData.REGNUM;
    const transNo = regnum; // REGNUM is the transaction number
    const detailcount = parseInt(formData.DETAILCOUNT);

    // Prepare detail records
    const detailRecords = [];
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

      // Convert expiry date string to Date string or null
      let expirydate: string | null = null;
      if (expirydateStr) {
        const dateObj = new Date(expirydateStr);
        if (!isNaN(dateObj.getTime())) {
          expirydate = dateObj.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        }
      }

      detailRecords.push({
        CONFCODE: confcode,
        REGNUM: regnum,
        LINENUM: i,
        LASTNAME: lastname,
        FIRSTNAME: firstname,
        MIDDLEINIT: middleinit,
        DESIGNATION: designation,
        BRGY: brgy,
        LGU: lgu,
        PROVINCE: province,
        TSHIRTSIZE: tshirtsize,
        CONTACTNUM: contactnumDetail,
        PRCNUM: prcnum,
        EXPIRYDATE: expirydate,
        EMAIL: emailDetail
      });
    }

    // Insert all detail records
    const { error: detailError } = await supabase
      .from('regd')
      .insert(detailRecords);

    if (detailError) {
      console.error('Detail insert error:', detailError);
      // Attempt to rollback header insert
      await supabase.from('REGH').delete().eq('REGNUM', regnum);
      return NextResponse.json(
        { error: 'Failed to submit registration details' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Your registration was successful. Your transaction ID is ${transId}.`,
      transId,
      transNo,
      regnum // Keep for backward compatibility
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to submit registration' },
      { status: 500 }
    );
  }
}

