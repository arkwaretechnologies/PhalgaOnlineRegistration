import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getRegistrationLimitByConference } from '@/lib/config';
import { getConferenceByDomain, getConferenceCode } from '@/lib/conference';
import { sendRegistrationConfirmation } from '@/lib/email';
import {
  validateRequestSize,
  validateContentType,
  createTimeout,
  withTimeout,
} from '@/lib/security';

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
  // Create timeout for request (30 seconds)
  const { abortController, timeoutId, timeoutPromise } = createTimeout(30000);

  try {
    // Validate Content-Type
    const contentTypeCheck = validateContentType(request, ['application/json']);
    if (!contentTypeCheck.isValid) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: contentTypeCheck.error },
        { status: 400 }
      );
    }

    // Validate request size (max 100KB for JSON payload)
    const sizeCheck = validateRequestSize(request, 100 * 1024); // 100KB
    if (!sizeCheck.isValid) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: sizeCheck.error },
        { status: 413 }
      );
    }

    // Detect conference from domain at the start
    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const conference = await getConferenceByDomain(hostname || undefined);

    if (!conference) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Conference not found for this domain. Please check your configuration.' },
        { status: 400 }
      );
    }

    const confcode = conference.confcode;
    // console.log(`=== Submitting Registration for Conference: ${confcode} (${conference.name}) ===`);

    // Parse request body
    const formData: RegistrationData = await request.json();
    
    // Check registration count - filter by conference
    // Note: regd table now uses regid (not regnum) as foreign key to regh
    const { data: regdData, error: regdError } = await withTimeout(
      supabase
        .from('regd')
        .select(`
          regid,
          confcode,
          regh!left(regid, status, confcode)
        `)
        .eq('confcode', confcode),
      timeoutPromise
    ) as { data: any[] | null; error: any };

    // console.log('=== Registration Count Check (Submit) ===');
    // console.log('Conference:', confcode);
    // console.log('regdData length:', regdData?.length || 0);
    // console.log('regdError:', regdError);

    if (regdError) {
      console.error('Database error:', regdError);
      clearTimeout(timeoutId);
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
      clearTimeout(timeoutId);
      return NextResponse.json(
        { 
          error: 'Registration is already closed',
          currentCount: regcount,
          limit: limit
        },
        { status: 400 }
      );
    }

    const province = (formData.PROVINCE || '').toString().trim().toUpperCase();
    const lgu = (formData.LGU || '').toString().trim().toUpperCase();

    const contactperson = (formData.CONTACTPERSON || '').toString().trim().toUpperCase();
    const contactnum = (formData.CONTACTNUMBER || '').toString().trim().toUpperCase();
    const email = (formData.EMAILADDRESS || '').toString().trim().toLowerCase();
    const detailcount = parseInt(formData.DETAILCOUNT);

    // Check for duplicate participants based on position level:
    // - If position LVL = 'BGY': compare Province, LGU, and Barangay
    // - Otherwise: compare Province and LGU only
    // console.log('=== Checking for Duplicate Participants ===');
    // console.log(`Province: ${province}, LGU: ${lgu}, Conference: ${confcode}, Participant Count: ${detailcount}`);
    
    for (let i = 0; i < detailcount; i++) {
      const lastname = (formData[`LASTNAME|${i}`] || '').toUpperCase().trim();
      const firstname = (formData[`FIRSTNAME|${i}`] || '').toUpperCase().trim();
      const middleinit = (formData[`MI|${i}`] || '').toUpperCase().trim();
      
      if (!lastname || !firstname || !middleinit) {
        continue; // Skip validation if required fields are empty (handled by client-side validation)
      }
      
      // Get participant's position and barangay
      const positionName = (formData[`DESIGNATION|${i}`] || '').toString().trim();
      const participantLgu = (formData[`LGU|${i}`] || lgu).toUpperCase().trim();
      const participantBarangay = (formData[`BRGY|${i}`] || '').toString().trim().toUpperCase();
      
      // Get position LVL from positions table
      let positionLvl: string | null = null;
      if (positionName) {
        const { data: positionData, error: positionError } = await withTimeout(
          supabase
            .from('positions')
            .select('lvl')
            .eq('name', positionName)
            .single(),
          timeoutPromise
        ) as { data: { lvl: string | null } | null; error: any };
        
        if (!positionError && positionData) {
          positionLvl = positionData.lvl;
        }
      }
      
      // Build query based on position level
      let duplicateQuery = supabase
        .from('regd')
        .select(`
          regid,
          confcode,
          province,
          lgu,
          brgy,
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
      
      // If position LVL = 'BGY', also check barangay
      if (positionLvl === 'BGY' && participantBarangay) {
        duplicateQuery = duplicateQuery.eq('brgy', participantBarangay);
      }
      
      // Query existing participants
      const { data: existingParticipants, error: duplicateError } = await withTimeout(
        duplicateQuery,
        timeoutPromise
      ) as { data: any[] | null; error: any };
      
      if (duplicateError) {
        console.error('Error checking for duplicates:', duplicateError);
        clearTimeout(timeoutId);
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
        // Build error message based on position level
        let errorMessage = `Participant "${firstname} ${middleinit} ${lastname}" already exists`;
        if (positionLvl === 'BGY' && participantBarangay) {
          errorMessage += ` in ${province} - ${participantLgu} - ${participantBarangay}`;
        } else {
          errorMessage += ` in ${province} - ${participantLgu}`;
        }
        errorMessage += `. Each participant can only register once.`;
        
        // console.log(`Duplicate found: ${firstname} ${middleinit} ${lastname}`);
        clearTimeout(timeoutId);
        return NextResponse.json(
          { 
            error: errorMessage,
            duplicateParticipant: `${firstname} ${middleinit} ${lastname}`,
            province: province,
            lgu: participantLgu,
            barangay: positionLvl === 'BGY' ? participantBarangay : undefined
          },
          { status: 400 }
        );
      }
    }
    
    // console.log('✓ No duplicate participants found');

    // Generate unique REGID with conference prefix
    const prefix = conference.prefix || null;
    // Wrap generateUniqueRegId with timeout
    const regId = await Promise.race([
      generateUniqueRegId(prefix),
      timeoutPromise
    ]) as string;
    
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
    const { data: headerData, error: headerError } = await withTimeout(
      supabase
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
        .single(),
      timeoutPromise
    ) as { data: { regid: string } | null; error: any };

    if (headerError || !headerData) {
      console.error('Header insert error:', headerError);
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Failed to create registration header' },
        { status: 500 }
      );
    }

    const regidFromHeader = headerData.regid || regId; // Use regid from header or fallback to generated regId

    // Prepare detail records
    const detailRecords = [];
    for (let i = 0; i < detailcount; i++) {
      const lastname = (formData[`LASTNAME|${i}`] || '').toString().trim().toUpperCase();
      const firstname = (formData[`FIRSTNAME|${i}`] || '').toString().trim().toUpperCase();
      const middleinit = (formData[`MI|${i}`] || '').toString().trim().toUpperCase();
      const suffix = (formData[`SUFFIX|${i}`] || '').toString().trim().toUpperCase();
      const designation = (formData[`DESIGNATION|${i}`] || '').toString().trim().toUpperCase();
      const brgy = (formData[`BRGY|${i}`] || '').toString().trim().toUpperCase();
      const tshirtsize = (formData[`TSHIRTSIZE|${i}`] || '').toString().trim().toUpperCase();
      const contactnumDetail = (formData[`CONTACTNUMBER|${i}`] || '').toString().trim().toUpperCase();
      const prcnum = (formData[`PRCNUM|${i}`] || '').toString().trim().toUpperCase();
      const expirydateStr = (formData[`EXPIRYDATE|${i}`] || '').toString().trim();
      const emailDetail = (formData[`EMAIL|${i}`] || '').toString().trim().toLowerCase();

      // Convert expiry date string to Date string or null
      let expirydate: string | null = null;
      if (expirydateStr) {
        const dateObj = new Date(expirydateStr);
        if (!isNaN(dateObj.getTime())) {
          expirydate = dateObj.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        }
      }

      // Get participant's LGU (use participant LGU if provided, otherwise use header LGU)
      const participantLguForRecord = (formData[`LGU|${i}`] || lgu).toString().trim().toUpperCase();
      
      // Note: regd table now uses regid (not regnum) as foreign key to regh
      detailRecords.push({
        confcode: confcode,
        regid: regidFromHeader, // Use regid as foreign key (regnum column removed from regd)
        linenum: i + 1, // Line numbers start at 1
        lastname: lastname,
        firstname: firstname,
        middleinit: middleinit,
        suffix: suffix || null, // Save suffix, use null if empty
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
    const result = await withTimeout(
      supabase
        .from('regd')
        .insert(detailRecords),
      timeoutPromise
    ) as { error: any };
    const { error: detailError } = result;

    if (detailError) {
      console.error('Detail insert error:', detailError);
      clearTimeout(timeoutId);
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

    clearTimeout(timeoutId);
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
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Handle timeout/abort errors
    if (error.name === 'AbortError' || abortController.signal.aborted) {
      console.error('Request timeout:', error);
      return NextResponse.json(
        { error: 'Request timeout. Please try again.' },
        { status: 408 }
      );
    }

    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Failed to submit registration' },
      { status: 500 }
    );
  }
}

