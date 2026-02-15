import { Resend } from 'resend';
import { supabase } from '@/lib/db';

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn('RESEND_API_KEY is not set. Email functionality will be disabled.');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Get from email address from environment or use default
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

interface RegistrationEmailData {
  transId: string;
  email: string;
  contactPerson: string;
  province: string;
  lgu: string;
  contactNumber: string;
  regdate: string;
  participantCount: number;
  viewUrl?: string;
  conferenceName?: string;
  confcode?: string;
}

/**
 * Send registration confirmation email
 * @param data Registration data for email
 * @returns Promise with success status and error message if any
 */
export async function sendRegistrationConfirmation(
  data: RegistrationEmailData
): Promise<{ success: boolean; error?: string }> {
  // If Resend is not configured, skip email sending
  if (!resend) {
    console.warn('Resend is not configured. Skipping email send.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    // Format registration date for display (use exact time from DB, no timezone conversion)
    const formatDate = (dateString: string): string => {
      try {
        // Parse the date string (format: YYYY-MM-DD HH:MM:SS) - stored value is already the intended time
        const [datePart, timePart] = dateString.trim().split(/\s+/);
        if (!datePart || !timePart) return dateString;
        const [year, month, day] = datePart.split('-');
        const [hoursStr, minutesStr] = timePart.split(':');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = parseInt(month, 10) - 1;
        if (monthIndex < 0 || monthIndex > 11) return dateString;
        const h = parseInt(hoursStr, 10) || 0;
        const m = parseInt(minutesStr, 10) || 0;
        const hour12 = h % 12 || 12;
        const ampm = h < 12 ? 'AM' : 'PM';
        const minutePadded = String(m).padStart(2, '0');
        return `${monthNames[monthIndex]} ${parseInt(day, 10)}, ${year}, ${hour12}:${minutePadded} ${ampm}`;
      } catch (error) {
        return dateString; // Return original if parsing fails
      }
    };

    const formattedDate = formatDate(data.regdate);
    
    // Get conference name from data or use default
    const conferenceName = data.conferenceName || 'Philippine Association of Local Government Accountants, Inc.';
    
    // Fetch conference data and contacts from database if confcode is provided
    let dateFrom: string | null = null;
    let dateTo: string | null = null;
    let venue: string | null = null;
    let contactNumbers: string[] = [];
    if (data.confcode) {
      try {
        // Fetch conference data for date_from, date_to, and venue
        const { data: conferenceData, error: conferenceError } = await supabase
          .from('conference')
          .select('date_from, date_to, venue')
          .eq('confcode', data.confcode)
          .single();
        
        if (!conferenceError && conferenceData) {
          dateFrom = conferenceData.date_from;
          dateTo = conferenceData.date_to;
          venue = conferenceData.venue;
        }
        
        // Fetch contacts
        const { data: contactData, error: contactError } = await supabase
          .from('contacts')
          .select('contact_no')
          .eq('confcode', data.confcode)
          .order('id', { ascending: true });
        
        if (!contactError && contactData) {
          contactNumbers = contactData.map(contact => contact.contact_no || '').filter(Boolean);
        }
      } catch (error) {
        console.error('Error fetching conference data or contacts for email:', error);
        // Continue with empty values - will not display dates/venue if not available
      }
    }
    
    // Format date range for display (similar to landing page)
    const formatDateRange = (dateFrom: string | null, dateTo: string | null): string => {
      if (!dateFrom || !dateTo) return '';
      try {
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        const fromFormatted = fromDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        const toDay = toDate.toLocaleDateString('en-US', { day: 'numeric' });
        const toYear = toDate.toLocaleDateString('en-US', { year: 'numeric' });
        return `${fromFormatted} - ${toDay}, ${toYear}`;
      } catch (error) {
        return '';
      }
    };
    
    const formattedDateRange = formatDateRange(dateFrom, dateTo);
    
    // Format contact numbers for display
    const formatContactNumbers = (contacts: string[]): string => {
      if (contacts.length === 0) {
        return 'Loading...'; // Fallback if no contacts found
      } else if (contacts.length === 1) {
        return contacts[0];
      } else if (contacts.length === 2) {
        return `${contacts[0]} and ${contacts[1]}`;
      } else {
        const last = contacts[contacts.length - 1];
        const rest = contacts.slice(0, -1);
        return `${rest.join(', ')}, and ${last}`;
      }
    };
    
    const formattedContactNumbers = formatContactNumbers(contactNumbers);
    
    // Get base URL for images - must be absolute URL for email clients
    // In Next.js, files in public folder are served from root
    // Remove trailing slash if present to avoid double slashes
    let baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').trim();
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    // Warn if using localhost in production (likely means NEXT_PUBLIC_APP_URL is not set)
    if (baseUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
      console.error('⚠️ WARNING: NEXT_PUBLIC_APP_URL is not set or is using localhost in production!');
      console.error('   Email images will not load correctly. Please set NEXT_PUBLIC_APP_URL in Railway to your production URL.');
      console.error('   Example: NEXT_PUBLIC_APP_URL=https://registration.phalga.org');
    }
    
    const leftImageUrl = `${baseUrl}/left.png`;
    const rightImageUrl = `${baseUrl}/right.png`;
    const viewUrl = data.viewUrl || `${baseUrl}/view/${data.transId}${data.confcode ? `?confcode=${encodeURIComponent(data.confcode)}` : ''}`;
    
    // // console.log('Email image URLs:', { 
    // //   leftImageUrl, 
    // //   rightImageUrl, 
    // //   baseUrl,
    // //   viewUrl,
    // //   nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    //   nodeEnv: process.env.NODE_ENV,
    //   conferenceName
    // });

    // Create HTML email template
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f4f4f4;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" style="width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; position: relative;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 30%; vertical-align: middle; text-align: left; padding: 0 10px;">
                    <!--[if mso]>
                    <v:image src="${leftImageUrl}" style="width:120px;height:auto;" />
                    <![endif]-->
                    <img 
                      src="${leftImageUrl}" 
                      alt="PHALGA" 
                      width="120"
                      style="max-width: 120px; width: 120px; height: auto; display: block; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" 
                    />
                  </td>
                  <td style="width: 40%; vertical-align: middle; text-align: center; padding: 0 10px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold; line-height: 1.2;">
                      ${conferenceName}
                    </h1>
                    ${formattedDateRange ? `<p style="margin: 8px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">${formattedDateRange}</p>` : ''}
                    ${venue ? `<p style="margin: ${formattedDateRange ? '4px' : '8px'} 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">${venue}</p>` : ''}
                    <p style="margin: ${venue ? '10px' : formattedDateRange ? '8px' : '10px'} 0 0 0; color: #ffffff; font-size: 16px;">
                      Registration Confirmation
                    </p>
                  </td>
                  <td style="width: 30%; vertical-align: middle; text-align: right; padding: 0 10px;">
                    <!--[if mso]>
                    <v:image src="${rightImageUrl}" style="width:120px;height:auto;" />
                    <![endif]-->
                    <img 
                      src="${rightImageUrl}" 
                      alt="PHALGA" 
                      width="120"
                      style="max-width: 120px; width: 120px; height: auto; display: block; margin-left: auto; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" 
                    />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Dear ${data.contactPerson},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Your registration has been successfully submitted. Please upload your proof of payment within 24 hours.
              </p>
              
              <!-- Transaction ID Highlight -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 5px 0; color: #666666; font-size: 14px; font-weight: bold;">
                  REGISTRATION ID
                </p>
                <p style="margin: 0; color: #333333; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                  ${data.transId || 'N/A'}
                </p>
              </div>
              
              <!-- Registration Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666666; font-size: 14px; width: 40%;">
                    Registration Date & Time:
                  </td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333333; font-size: 14px; font-weight: 500;">
                    ${formattedDate}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666666; font-size: 14px;">
                    Province:
                  </td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333333; font-size: 14px; font-weight: 500;">
                    ${data.province}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666666; font-size: 14px;">
                    LGU:
                  </td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333333; font-size: 14px; font-weight: 500;">
                    ${data.lgu}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666666; font-size: 14px;">
                    Contact Number:
                  </td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333333; font-size: 14px; font-weight: 500;">
                    ${data.contactNumber}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #666666; font-size: 14px;">
                    Number of Participants:
                  </td>
                  <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #333333; font-size: 14px; font-weight: 500;">
                    ${data.participantCount}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; color: #666666; font-size: 14px;">
                    Status:
                  </td>
                  <td style="padding: 10px; color: #f97316; font-size: 14px; font-weight: 500;">
                    PENDING
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Use your Registration ID to view your registration details.
              </p>
              
              <!-- View Registration Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${viewUrl}" style="display: inline-block; background-color: #667eea; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold; font-size: 16px;">
                  View Registration Details
                </a>
              </div>
              
              <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you have any questions or need to make changes to your registration, please contact registration team using this number${contactNumbers.length > 1 ? 's' : ''} <strong>${formattedContactNumbers}</strong>.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; color: #666666; font-size: 12px;">
                This is an automated confirmation email. Please do not reply to this message.
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © 2026 PHALGA. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email
    const result = await resend.emails.send({
      from: fromEmail,
      to: data.email,
      subject: `Registration Confirmation - ${conferenceName}`,
      html: htmlContent,
    });

    if (result.error) {
      console.error('Resend API error:', result.error);
      return { success: false, error: result.error.message || 'Failed to send email' };
    }

    // console.log('Registration confirmation email sent successfully to:', data.email);
    return { success: true };
  } catch (error: any) {
    console.error('Error sending registration confirmation email:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error occurred while sending email',
    };
  }
}
