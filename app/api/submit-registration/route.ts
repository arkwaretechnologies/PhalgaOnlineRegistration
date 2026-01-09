import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { isRegistrationOpen, getRegistrationLimit } from '@/lib/config';
import { sendRegistrationConfirmation } from '@/lib/email';

// Disable caching for this route to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      .from('regh')
      .select('transid')
      .eq('transid', transId)
      .limit(1);
    
    if (error) {
      throw new Error(`Failed to check transid uniqueness: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      isUnique = true;
    } else {
      attempts++;
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique transid after multiple attempts');
  }

  return transId!;
}

export async function POST(request: Request) {
  try {
    const formData: RegistrationData = await request.json();
    
    // Check registration count - use direct SELECT query matching the SQL:
    // SELECT COUNT(*) FROM "regd" d LEFT JOIN "regh" h ON d."regnum" = h."regnum"
    // WHERE h."status" IS NULL OR UPPER(TRIM(h."status")) = 'PENDING' OR UPPER(TRIM(h."status")) = 'APPROVED'
    
    const { data: regdData, error: regdError } = await supabase
      .from('regd')
      .select(`
        regnum,
        regh!left(regnum, status)
      `);

    console.log('=== Registration Count Check (Submit) ===');
    console.log('regdData length:', regdData?.length || 0);
    console.log('regdError:', regdError);

    if (regdError) {
      console.error('Database error:', regdError);
      return NextResponse.json(
        { error: 'Failed to check registration status' },
        { status: 500 }
      );
    }

    // Filter records where status is NULL, PENDING, or APPROVED (case-insensitive)
    const validRecords = (regdData || []).filter((record: any) => {
      const regh = Array.isArray(record.regh) ? record.regh[0] : record.regh;
      if (!regh) {
        // If no regh record, include it (matches LEFT JOIN behavior with NULL status)
        return true;
      }
      const status = (regh.status || '').toString().toUpperCase().trim();
      return !status || status === 'PENDING' || status === 'APPROVED';
    });

    const regcount = validRecords.length;
    const limit = getRegistrationLimit();

    console.log(`Total regd records: ${regdData?.length || 0}`);
    console.log(`Valid records (PENDING/APPROVED/NULL): ${regcount}`);
    console.log(`Registration Count: ${regcount}`);
    console.log(`Registration Limit: ${limit}`);
    console.log('==========================================');

    // Check if registration is open (registration closes when count >= limit)
    if (!isRegistrationOpen(regcount)) {
      console.log(
        `Registration closed: current count=${regcount}, limit=${limit}`
      );
      return NextResponse.json(
        { 
          error: 'Registration is already closed',
          currentCount: regcount,
          limit: limit
        },
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

    // Get current time in Manila timezone (UTC+8)
    const getManilaTime = (): string => {
      const now = new Date();
      // Manila is UTC+8
      const manilaOffset = 8 * 60; // 8 hours in minutes
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const manilaTime = new Date(utc + (manilaOffset * 60000));
      
      // Format as YYYY-MM-DD HH:MM:SS for PostgreSQL TIMESTAMP
      const year = manilaTime.getFullYear();
      const month = String(manilaTime.getMonth() + 1).padStart(2, '0');
      const day = String(manilaTime.getDate()).padStart(2, '0');
      const hours = String(manilaTime.getHours()).padStart(2, '0');
      const minutes = String(manilaTime.getMinutes()).padStart(2, '0');
      const seconds = String(manilaTime.getSeconds()).padStart(2, '0');
      
      // Return in PostgreSQL TIMESTAMP format: YYYY-MM-DD HH:MM:SS
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    // Insert header (REGNUM will be auto-generated by the database)
    // REGDATE now includes date and time in Manila timezone (UTC+8)
    const regdate = getManilaTime();
    const { data: headerData, error: headerError } = await supabase
      .from('regh')
      .insert({
        confcode: confcode,
        province: province,
        lgu: lgu,
        contactperson: contactperson,
        contactnum: contactnum,
        email: email,
        regdate: regdate,
        transid: transId,
        status: 'PENDING' // Set status to PENDING for new registrations
        // Note: REGNUM is not included - it will be auto-generated by the database sequence
      })
      .select('regnum')
      .single();

    if (headerError) {
      console.error('Header insert error:', headerError);
      return NextResponse.json(
        { error: 'Failed to create registration header' },
        { status: 500 }
      );
    }

    const regnum = headerData.regnum;
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
        confcode: confcode,
        regnum: regnum,
        linenum: i,
        lastname: lastname,
        firstname: firstname,
        middleinit: middleinit,
        designation: designation,
        brgy: brgy,
        lgu: lgu,
        province: province,
        tshirtsize: tshirtsize,
        contactnum: contactnumDetail,
        prcnum: prcnum,
        expirydate: expirydate,
        email: emailDetail
      });
    }

    // Insert all detail records
    const { error: detailError } = await supabase
      .from('regd')
      .insert(detailRecords);

    if (detailError) {
      console.error('Detail insert error:', detailError);
      // Attempt to rollback header insert
      await supabase.from('regh').delete().eq('regnum', regnum);
      return NextResponse.json(
        { error: 'Failed to submit registration details' },
        { status: 500 }
      );
    }

    // Send confirmation email (non-blocking - registration succeeds even if email fails)
    try {
      const emailResult = await sendRegistrationConfirmation({
        transId: transId,
        email: email,
        contactPerson: contactperson,
        province: province,
        lgu: lgu,
        contactNumber: contactnum,
        regdate: regdate,
        participantCount: detailcount,
        viewUrl: process.env.NEXT_PUBLIC_APP_URL 
          ? `${process.env.NEXT_PUBLIC_APP_URL}/view/${transId}`
          : undefined
      });

      if (emailResult.success) {
        console.log('Confirmation email sent successfully to:', email);
      } else {
        console.warn('Failed to send confirmation email:', emailResult.error);
        // Don't fail registration if email fails
      }
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Don't fail registration if email fails
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

