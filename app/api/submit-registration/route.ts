import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { getRegistrationLimitByConference } from '@/lib/config';
import { getConferenceByDomain, getConferenceByConfcode, getConferenceCode } from '@/lib/conference';
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

    const hostname = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const { searchParams } = new URL(request.url);
    const confcodeParam = searchParams.get('confcode')?.trim();

    let conference = null;
    if (confcodeParam) {
      conference = await getConferenceByConfcode(confcodeParam);
    } else {
      conference = await getConferenceByDomain(hostname || undefined);
    }

    if (!conference) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Conference not found for this domain or confcode. Please check your configuration.' },
        { status: 400 }
      );
    }

    const confcode = conference.confcode;
    // console.log(`=== Submitting Registration for Conference: ${confcode} (${conference.name}) ===`);

    // Parse request body
    const formData: RegistrationData = await request.json();
    
    // Check registration count - filter by conference (paginate to count ALL records, not just first 1000)
    // Note: regd table now uses regid (not regnum) as foreign key to regh
    const regdPageSize = 1000;
    let regdData: any[] = [];
    let regdPage = 0;
    let hasMoreRegd = true;

    while (hasMoreRegd) {
      const { data: regdPageData, error: regdError } = await withTimeout(
        supabase
          .from('regd')
          .select(`
            regid,
            confcode,
            province,
            lgu,
            regh!left(regid, status, confcode)
          `)
          .eq('confcode', confcode)
          .range(regdPage * regdPageSize, (regdPage + 1) * regdPageSize - 1),
        timeoutPromise
      ) as { data: any[] | null; error: any };

      if (regdError) {
        console.error('Database error:', regdError);
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: 'Failed to check registration status' },
          { status: 500 }
        );
      }

      if (regdPageData && regdPageData.length > 0) {
        regdData = regdData.concat(regdPageData);
        hasMoreRegd = regdPageData.length === regdPageSize;
        regdPage++;
      } else {
        hasMoreRegd = false;
      }
    }

    // Filter records where status is PENDING or APPROVED and same conference
    const validRecords = regdData.filter((record: any) => {
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
    const detailcount = parseInt(String(formData.DETAILCOUNT || '0'), 10) || 0;

    // LGU/province registration limit from lgu_count_limit (by psgcode)
    // PROV: always use PSGC from PROVINCE field (resolve province name -> province PSGC from lgus). MUN/CITY/HUC: use LGU_PSGC from form.
    // validRecords above is built from paginated regd fetch, so it includes ALL records for this confcode
    const getRProvince = (r: any) => (r.province ?? r.PROVINCE ?? '').toString().trim().toUpperCase();
    const getRLgu = (r: any) => (r.lgu ?? r.LGU ?? '').toString().trim().toUpperCase();

    // 1) PROV limit: use PSGC from PROVINCE field only (resolve from lgus, geolevel PROV), not LGU_PSGC
    let provincePsgc: string | null = null;
    if (province) {
      const { data: provRow } = await withTimeout(
        supabase
          .from('lgus')
          .select('psgc')
          .eq('geolevel', 'PROV')
          .ilike('lguname', province)
          .limit(1)
          .maybeSingle(),
        timeoutPromise
      ) as { data: { psgc?: string } | null };
      if (provRow?.psgc) provincePsgc = String(provRow.psgc).trim();
    }
    if (provincePsgc) {
      const { data: provLimitRow, error: provLimitError } = await withTimeout(
        supabase
          .from('lgu_count_limit')
          .select('geolevel, reg_limit')
          .eq('confcode', confcode)
          .eq('psgcode', provincePsgc)
          .maybeSingle(),
        timeoutPromise
      ) as { data: { geolevel?: string; reg_limit?: number | null } | null; error: any };
      if (!provLimitError && provLimitRow && (provLimitRow.geolevel || '').toString().toUpperCase().trim() === 'PROV' && provLimitRow.reg_limit != null) {
        const lguRegLimit = Number(provLimitRow.reg_limit);
        if (!isNaN(lguRegLimit) && lguRegLimit >= 0) {
          const lguCount = validRecords.filter((r: any) => getRProvince(r) === province).length;
          if (lguCount + detailcount > lguRegLimit) {
            const availableSlots = Math.max(0, lguRegLimit - lguCount);
            clearTimeout(timeoutId);
            return NextResponse.json(
              availableSlots > 0
                ? {
                    error: `Not enough slots available. Available slots: ${availableSlots}.`,
                    availableSlots,
                  }
                : { error: 'Thank you for your interest. All slots are fully taken.' },
              { status: 400 }
            );
          }
        }
      }
    }

    // 2) LGU limit (MUN/CITY/HUC): use LGU_PSGC from form only
    const lguPsgc = String(formData.LGU_PSGC || formData.PSGC || '').trim();
    if (lguPsgc) {
      const { data: lguLimitRow, error: lguLimitError } = await withTimeout(
        supabase
          .from('lgu_count_limit')
          .select('geolevel, reg_limit')
          .eq('confcode', confcode)
          .eq('psgcode', lguPsgc)
          .maybeSingle(),
        timeoutPromise
      ) as { data: { geolevel?: string; reg_limit?: number | null } | null; error: any };
      const geolevel = (lguLimitRow?.geolevel || '').toString().toUpperCase().trim();
      if (!lguLimitError && lguLimitRow && (geolevel === 'MUN' || geolevel === 'CITY' || geolevel === 'HUC') && lguLimitRow.reg_limit != null) {
        const lguRegLimit = Number(lguLimitRow.reg_limit);
        if (!isNaN(lguRegLimit) && lguRegLimit >= 0) {
          const lguCount = validRecords.filter((r: any) => getRProvince(r) === province && getRLgu(r) === lgu).length;
          if (lguCount + detailcount > lguRegLimit) {
            const availableSlots = Math.max(0, lguRegLimit - lguCount);
            clearTimeout(timeoutId);
            return NextResponse.json(
              availableSlots > 0
                ? {
                    error: `Not enough slots available. Available slots: ${availableSlots}.`,
                    availableSlots,
                  }
                : { error: 'Thank you for your interest. All slots are fully taken.' },
              { status: 400 }
            );
          }
        }
      }
    }

    const contactperson = (formData.CONTACTPERSON || '').toString().trim().toUpperCase();
    const contactnum = (formData.CONTACTNUMBER || '').toString().trim().toUpperCase();
    const email = (formData.EMAILADDRESS || '').toString().trim().toLowerCase();

    // Confcodes to check for duplicate participants: current + linked_conference (comma-separated)
    const linkedRaw = (conference as { linked_conference?: string | null }).linked_conference || '';
    const linkedConfcodes = linkedRaw
      .split(',')
      .map((c: string) => c.trim())
      .filter((c: string) => c.length > 0 && c !== confcode);
    // Build Manila time for regdate (UTC+8)
    const getManilaTime = (): string => {
      const now = new Date();
      const manilaOffset = 8 * 60;
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const manilaTime = new Date(utc + (manilaOffset * 60000));
      const y = manilaTime.getFullYear();
      const m = String(manilaTime.getMonth() + 1).padStart(2, '0');
      const d = String(manilaTime.getDate()).padStart(2, '0');
      const h = String(manilaTime.getHours()).padStart(2, '0');
      const min = String(manilaTime.getMinutes()).padStart(2, '0');
      const s = String(manilaTime.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${d} ${h}:${min}:${s}`;
    };
    const regdate = getManilaTime();

    // Build participants array for atomic RPC (duplicate check + insert under advisory lock)
    const participants: Record<string, string | null>[] = [];
    for (let i = 0; i < detailcount; i++) {
      const expirydateStr = (formData[`EXPIRYDATE|${i}`] || '').toString().trim();
      let expirydate: string | null = null;
      if (expirydateStr) {
        const dateObj = new Date(expirydateStr);
        if (!isNaN(dateObj.getTime())) expirydate = dateObj.toISOString().split('T')[0];
      }
      participants.push({
        lastname: (formData[`LASTNAME|${i}`] || '').toString().trim().toUpperCase(),
        firstname: (formData[`FIRSTNAME|${i}`] || '').toString().trim().toUpperCase(),
        middleinit: (formData[`MI|${i}`] || '').toString().trim().toUpperCase(),
        suffix: (formData[`SUFFIX|${i}`] || '').toString().trim().toUpperCase() || null,
        designation: (formData[`DESIGNATION|${i}`] || '').toString().trim().toUpperCase(),
        brgy: (formData[`BRGY|${i}`] || '').toString().trim().toUpperCase(),
        lgu: (formData[`LGU|${i}`] || lgu).toString().trim().toUpperCase(),
        province,
        tshirtsize: (formData[`TSHIRTSIZE|${i}`] || '').toString().trim().toUpperCase(),
        contactnum: (formData[`CONTACTNUMBER|${i}`] || '').toString().trim().toUpperCase(),
        prcnum: (formData[`PRCNUM|${i}`] || '').toString().trim().toUpperCase(),
        expirydate,
        email: (formData[`EMAIL|${i}`] || '').toString().trim().toLowerCase()
      });
    }

    const payload = {
      confcode,
      linked_confcodes: linkedConfcodes.join(','),
      province,
      lgu,
      contactperson,
      contactnum,
      email,
      regdate,
      prefix: (conference as { prefix?: string | null }).prefix ?? null,
      participants
    };

    const { data: rpcData, error: rpcError } = await withTimeout(
      supabase.rpc('submit_registration_atomic', { payload }),
      timeoutPromise
    ) as { data: { regid: string } | null; error: { message?: string } | null };

    if (rpcError) {
      clearTimeout(timeoutId);
      const msg = (rpcError as { message?: string }).message ?? '';
      const isDuplicate = /already exists|Duplicate participant|only register once/i.test(msg);
      return NextResponse.json(
        { error: isDuplicate ? msg : 'Failed to submit registration' },
        { status: isDuplicate ? 400 : 500 }
      );
    }
    if (!rpcData?.regid) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Failed to submit registration' },
        { status: 500 }
      );
    }

    const regId = rpcData.regid;

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
          ? `${process.env.NEXT_PUBLIC_APP_URL}/view/${regId}${confcode ? `?confcode=${encodeURIComponent(confcode)}` : ''}`
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

