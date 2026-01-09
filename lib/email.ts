import { Resend } from 'resend';

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
    // Format registration date for display
    const formatDate = (dateString: string): string => {
      try {
        // Parse the date string (format: YYYY-MM-DD HH:MM:SS)
        const [datePart, timePart] = dateString.split(' ');
        const [year, month, day] = datePart.split('-');
        const [hours, minutes] = timePart.split(':');
        
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hours),
          parseInt(minutes)
        );
        
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Manila',
          timeZoneName: 'short'
        });
      } catch (error) {
        return dateString; // Return original if parsing fails
      }
    };

    const formattedDate = formatDate(data.regdate);
    const viewUrl = data.viewUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/view/${data.transId}`;

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
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                17th Mindanao Geographic Conference
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 16px;">
                Registration Confirmation
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Dear ${data.contactPerson},
              </p>
              
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Thank you for registering for the <strong>17th Mindanao Geographic Conference</strong>. Your registration has been successfully submitted and is currently under review.
              </p>
              
              <!-- Transaction ID Highlight -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 5px 0; color: #666666; font-size: 14px; font-weight: bold;">
                  TRANSACTION ID
                </p>
                <p style="margin: 0; color: #333333; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                  ${data.transId}
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
                Please keep your Transaction ID safe. You can use it to view your registration details at any time.
              </p>
              
              <!-- View Registration Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${viewUrl}" style="display: inline-block; background-color: #667eea; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 5px; font-weight: bold; font-size: 16px;">
                  View Registration Details
                </a>
              </div>
              
              <p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                If you have any questions or need to make changes to your registration, please contact us using the information provided in your registration.
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
      subject: 'Registration Confirmation - 17th Mindanao Geographic Conference',
      html: htmlContent,
    });

    if (result.error) {
      console.error('Resend API error:', result.error);
      return { success: false, error: result.error.message || 'Failed to send email' };
    }

    console.log('Registration confirmation email sent successfully to:', data.email);
    return { success: true };
  } catch (error: any) {
    console.error('Error sending registration confirmation email:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error occurred while sending email',
    };
  }
}
