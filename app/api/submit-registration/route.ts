import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getRegistrationLimitByConference } from '@/lib/config';
import { getConferenceByDomain, getConferenceCode } from '@/lib/conference';
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

// Function to generate random numeric string
// If prefix is provided, it will be prepended to the generated string
// Total length will be: prefix.length + randomLength
// Returns: prefix + numeric_id (e.g., "MGC001234")
function generateRegId(prefix: string | null = null, randomLength: number = 6): string {
  const chars = '0123456789'; // Only numbers
  let result = '';
  
  // Generate random numeric part
  for (let i = 0; i < randomLength; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Prepend prefix if provided
  if (prefix && prefix.trim() !== '') {
    return prefix.trim().toUpperCase() + result;
  }
  
  return result;
}

// Function to generate unique REGID that doesn't exist in database
// Format: [PREFIX][NUMERIC_ID] (e.g., "MGC001234")
// Prefix from conference table will be prepended if available
// The numeric ID part uses only numbers (0-9)
async function generateUniqueRegId(prefix: string | null = null): Promise<string> {
  let regId: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop

  while (!isUnique && attempts < maxAttempts) {
    regId = generateRegId(prefix);
    
    // Check if REGID already exists
    const { data, error } = await supabase
      .from('regh')
      .select('regid')
      .eq('regid', regId)
      .limit(1);
    
    if (error) {
      throw new Error(`Failed to check regid uniqueness: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      isUnique = true;
    } else {
      attempts++;
    }
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique regid after multiple attempts');
  }

  return regId!;
}

export async function POST(request: Request) {
  try {
    // Detect conference from domain at the start
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const conference = await getConferenceByDomain(hostname || undefined);

    if (!conference) {
      return NextResponse.json(
        { error: 'Conference not found for this domain. Please check your configuration.' },
        { status: 400 }
      );
    }

    const confcode = conference.confcode;
    // console.log(`=== Submitting Registration for Conference: ${confcode} (${conference.name}) ===`);

    const formData: RegistrationData = await request.json();
    
    // Check registration count - filter by conference
    // Note: regd table now uses regid (not regnum) as foreign key to regh
    const { data: regdData, error: regdError } = await supabase
      .from('regd')
      .select(`
        regid,
        confcode,
        regh!left(regid, status, confcode)
      `)
      .eq('confcode', confcode); // Add conference filter

    // console.log('=== Registration Count Check (Submit) ===');
    // console.log('Conference:', confcode);
    // console.log('regdData length:', regdData?.length || 0);
    // console.log('regdError:', regdError);

    if (regdError) {
      console.error('Database error:', regdError);
      return NextResponse.json(
        { error: 'Failed to check registration status' },
        { status: 500 }
      );
    }

    // Filter records where status is PENDING or APPROVED and same conference
    const validRecords = (regdData || []).filter((record: any) => {
      if (record.confcode !== confcode) {
        return false;
      }
      const regh = Array.isArray(record.regh) ? record.regh[0] : record.regh;
      // Only count records that have a regh record with status
      if (!regh) {
        return false;
      }
      if (regh.confcode && regh.confcode !== confcode) {
        return false;
      }
      const status = (regh.status || '').toString().toUpperCase().trim();
      return status === 'PENDING' || status === 'APPROVED';
    });

    const regcount = validRecords.length;
    const limit = await getRegistrationLimitByConference(confcode);

    // console.log(`Total regd records: ${regdData?.length || 0}`);
    // console.log(`Valid records (PENDING/APPROVED only): ${regcount}`);
    // console.log(`Registration Count: ${regcount}`);
    // console.log(`Registration Limit: ${limit}`);
    // console.log('==========================================');

    // Check if registration is open (registration closes when count >= limit)
    if (regcount >= limit) {
      // console.log(
      //   `Registration closed: current count=${regcount}, limit=${limit}`
      // );
      return NextResponse.json(
        { 
          error: 'Registration is already closed',
          currentCount: regcount,
          limit: limit
        },
        { status: 400 }
      );
    }

    const province = formData.PROVINCE.toUpperCase();
    const lgu = formData.LGU.toUpperCase();

    const contactperson = formData.CONTACTPERSON.toUpperCase();
    const contactnum = formData.CONTACTNUMBER.toUpperCase();
    const email = formData.EMAILADDRESS.toLowerCase();
    const detailcount = parseInt(formData.DETAILCOUNT);

    // Check for duplicate participants (same last name, first name, middle initial in same province and LGU)
    // console.log('=== Checking for Duplicate Participants ===');
    // console.log(`Province: ${province}, LGU: ${lgu}, Conference: ${confcode}, Participant Count: ${detailcount}`);
    
    for (let i = 0; i < detailcount; i++) {
      const lastname = (formData[`LASTNAME|${i}`] || '').toUpperCase().trim();
      const firstname = (formData[`FIRSTNAME|${i}`] || '').toUpperCase().trim();
      const middleinit = (formData[`MI|${i}`] || '').toUpperCase().trim();
      
      if (!lastname || !firstname || !middleinit) {
        continue; // Skip validation if required fields are empty (handled by client-side validation)
      }
      
      // Get participant's LGU (use participant LGU if provided, otherwise use header LGU)
      const participantLgu = (formData[`LGU|${i}`] || lgu).toUpperCase().trim();
      
      // Query existing participants in the same province and LGU with matching name
      const { data: existingParticipants, error: duplicateError } = await supabase
        .from('regd')
        .select(`
          regid,
          confcode,
          province,
          lgu,
          lastname,
          firstname,
          middleinit,
          regh!left(regid, status, confcode)
        `)
        .eq('confcode', confcode)
        .eq('province', province)
        .eq('lgu', participantLgu)
        .eq('lastname', lastname)
        .eq('firstname', firstname)
        .eq('middleinit', middleinit);
      
      if (duplicateError) {
        console.error('Error checking for duplicates:', duplicateError);
        return NextResponse.json(
          { error: 'Failed to validate registration data' },
          { status: 500 }
        );
      }
      
      // Filter to only include records with PENDING or APPROVED status (or NULL status)
      const validDuplicates = (existingParticipants || []).filter((record: any) => {
        const regh = Array.isArray(record.regh) ? record.regh[0] : record.regh;
        if (!regh) {
          return true; // Include records with NULL status
        }
        if (regh.confcode && regh.confcode !== confcode) {
          return false;
        }
        const status = (regh.status || '').toString().toUpperCase().trim();
        return !status || status === 'PENDING' || status === 'APPROVED';
      });
      
      if (validDuplicates.length > 0) {
        // console.log(`Duplicate found: ${firstname} ${middleinit} ${lastname} in ${province} - ${participantLgu}`);
        return NextResponse.json(
          { 
            error: `Participant "${firstname} ${middleinit} ${lastname}" already exists in ${province} - ${participantLgu}. Each participant can only register once.`,
            duplicateParticipant: `${firstname} ${middleinit} ${lastname}`,
            province: province,
            lgu: participantLgu
          },
          { status: 400 }
        );
      }
    }
    
    // console.log('✓ No duplicate participants found');

    // Generate unique REGID with conference prefix
    const prefix = conference.prefix || null;
    const regId = await generateUniqueRegId(prefix);
    
    // console.log(`Generated REGID with prefix: ${prefix || 'none'} -> ${regId}`);

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

    // Insert header - REGID is the only identifier needed (REGNUM has been removed)
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
        regid: regId,
        status: 'PENDING' // Set status to PENDING for new registrations
        // Note: REGID is the only identifier needed (REGNUM has been removed)
      })
      .select('regid')
      .single();

    if (headerError) {
      console.error('Header insert error:', headerError);
      return NextResponse.json(
        { error: 'Failed to create registration header' },
        { status: 500 }
      );
    }

    const regidFromHeader = headerData.regid || regId; // Use regid from header or fallback to generated regId

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

      // Get participant's LGU (use participant LGU if provided, otherwise use header LGU)
      const participantLguForRecord = (formData[`LGU|${i}`] || lgu).toUpperCase();
      
      // Note: regd table now uses regid (not regnum) as foreign key to regh
      detailRecords.push({
        confcode: confcode,
        regid: regidFromHeader, // Use regid as foreign key (regnum column removed from regd)
        linenum: i + 1, // Line numbers start at 1
        lastname: lastname,
        firstname: firstname,
        middleinit: middleinit,
        designation: designation,
        brgy: brgy,
        lgu: participantLguForRecord, // Use participant's LGU if different from header
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
      // Attempt to rollback header insert using regid
      await supabase.from('regh').delete().eq('regid', regidFromHeader);
      return NextResponse.json(
        { error: 'Failed to submit registration details' },
        { status: 500 }
      );
    }

    // Send confirmation email (non-blocking - registration succeeds even if email fails)
    try {
      const emailResult = await sendRegistrationConfirmation({
        transId: regId, // Use regId but keep parameter name as transId for backward compatibility
        email: email,
        contactPerson: contactperson,
        province: province,
        lgu: lgu,
        contactNumber: contactnum,
        regdate: regdate,
        participantCount: detailcount,
        viewUrl: process.env.NEXT_PUBLIC_APP_URL 
          ? `${process.env.NEXT_PUBLIC_APP_URL}/view/${regId}`
          : undefined,
        conferenceName: conference.name || undefined,
        confcode: confcode
      });

      if (emailResult.success) {
        // console.log('Confirmation email sent successfully to:', email);
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
      message: `Your registration was successful. Your Registration ID is ${regId}.`,
      transId: regId, // Keep as transId for backward compatibility with frontend
      regId: regId, // Also include as regId for new code
      conference: {
        confcode: confcode,
        name: conference.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to submit registration' },
      { status: 500 }
    );
  }
}

