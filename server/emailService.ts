import { Resend } from "resend";
import { emailLogger } from "./logger";

// From address for emails - domain must be verified in Resend dashboard
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "MaintenanceHub <info@maintenancehub.org>";

export interface InvitationEmailData {
  toEmail: string;
  inviterName: string;
  companyName: string;
  role: string;
  inviteLink: string;
}

export interface PasswordResetEmailData {
  toEmail: string;
  resetLink: string;
}

export interface AccessCodeEmailData {
  toEmail: string;
  accessKey: string;
}

let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    emailLogger.warn({}, "RESEND_API_KEY not configured - email sending is disabled");
    return null;
  }
  
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  
  return resend;
}

export async function sendInvitationEmail(data: InvitationEmailData) {
  const client = getResendClient();
  
  if (!client) {
    emailLogger.info({}, "Email sending skipped - no API key configured");
    return { skipped: true, reason: "No RESEND_API_KEY configured" };
  }

  try {
    const { toEmail, inviterName, companyName, role, inviteLink } = data;

    const roleDisplay = role === "admin" ? "Administrator" : role === "manager" ? "Manager" : "Technician";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">MaintenanceHub</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Industrial Management Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 24px; font-weight: 600;">You've Been Invited!</h2>
              
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on MaintenanceHub as a <strong>${roleDisplay}</strong>.
              </p>

              <div style="background-color: #f7fafc; border-left: 4px solid #667eea; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #2d3748; font-size: 14px; line-height: 1.5;">
                  <strong>Your Role:</strong> ${roleDisplay}
                </p>
              </div>

              <p style="margin: 24px 0; color: #4a5568; font-size: 15px; line-height: 1.6;">
                MaintenanceHub is a comprehensive industrial maintenance management platform that helps teams track equipment, manage work orders, schedule preventive maintenance, and analyze downtime.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);">
                      Accept Invitation & Sign In
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                This invitation link will expire in 7 days. If you have any questions, please contact ${inviterName} or your company administrator.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f7fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #718096; font-size: 12px; text-align: center; line-height: 1.5;">
                This email was sent by MaintenanceHub. If you weren't expecting this invitation, you can safely ignore this email.
              </p>
              <p style="margin: 8px 0 0; color: #a0aec0; font-size: 11px; text-align: center;">
                © ${new Date().getFullYear()} MaintenanceHub. All rights reserved.
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

    const emailText = `
You've Been Invited to ${companyName}

${inviterName} has invited you to join ${companyName} on MaintenanceHub as a ${roleDisplay}.

MaintenanceHub is a comprehensive industrial maintenance management platform that helps teams track equipment, manage work orders, schedule preventive maintenance, and analyze downtime.

To accept this invitation and get started, please click the link below or copy it into your browser:

${inviteLink}

This invitation link will expire in 7 days. If you have any questions, please contact ${inviterName} or your company administrator.

---
This email was sent by MaintenanceHub. If you weren't expecting this invitation, you can safely ignore this email.
    `;

    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject: `You've been invited to join ${companyName} on MaintenanceHub`,
      html: emailHtml,
      text: emailText,
    });

    emailLogger.info({ result }, "Invitation email sent successfully");
    return result;
  } catch (error) {
    emailLogger.error({ err: error }, "Error sending invitation email");
    throw error;
  }
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData) {
  const client = getResendClient();

  if (!client) {
    emailLogger.info({}, "Email sending skipped - no API key configured");
    return { skipped: true, reason: "No RESEND_API_KEY configured" };
  }

  try {
    const { toEmail, resetLink } = data;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">MaintenanceHub</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Industrial Management Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
              
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password.
              </p>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>Important:</strong> This link expires in 1 hour and can only be used once.
                </p>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f7fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #718096; font-size: 12px; text-align: center; line-height: 1.5;">
                This email was sent by MaintenanceHub. If you didn't request this, please ignore this email.
              </p>
              <p style="margin: 8px 0 0; color: #a0aec0; font-size: 11px; text-align: center;">
                © ${new Date().getFullYear()} MaintenanceHub. All rights reserved.
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

    const emailText = `
Reset Your Password

We received a request to reset your password. Click the link below to create a new password:

${resetLink}

Important: This link expires in 1 hour and can only be used once.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
This email was sent by MaintenanceHub. If you didn't request this, please ignore this email.
    `;

    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject: "Reset Your MaintenanceHub Password",
      html: emailHtml,
      text: emailText,
    });

    emailLogger.info({ result }, "Password reset email sent successfully");
    return result;
  } catch (error) {
    emailLogger.error({ err: error }, "Error sending password reset email");
    throw error;
  }
}

export async function sendAccessCodeEmail(data: AccessCodeEmailData) {
  const client = getResendClient();

  if (!client) {
    emailLogger.info({}, "Email sending skipped - no API key configured");
    return { skipped: true, reason: "No RESEND_API_KEY configured" };
  }

  try {
    const { toEmail, accessKey } = data;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your MaintenanceHub Access Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">MaintenanceHub</h1>
              <p style="margin: 8px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">Industrial Management Platform</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 24px; font-weight: 600;">Welcome to MaintenanceHub!</h2>
              
              <p style="margin: 0 0 24px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Your request for access has been approved. Use the access code below to complete your registration and set up your company.
              </p>

              <div style="background-color: #f7fafc; border: 2px dashed #667eea; padding: 24px; margin: 32px 0; border-radius: 8px; text-align: center;">
                <p style="margin: 0 0 8px; color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
                  Your Access Code
                </p>
                <div style="color: #2d3748; font-size: 32px; font-weight: 700; letter-spacing: 0.1em; font-family: 'JetBrains Mono', monospace;">
                  ${accessKey}
                </div>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 32px 0;">
                <tr>
                  <td align="center">
                    <a href="${process.env.APP_URL || 'https://www.maintenancehub.org'}/register" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);">
                      Complete Registration
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                This code can only be used once. If you have any questions, please reply to this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f7fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #718096; font-size: 12px; text-align: center; line-height: 1.5;">
                This email was sent by MaintenanceHub.
              </p>
              <p style="margin: 8px 0 0; color: #a0aec0; font-size: 11px; text-align: center;">
                © ${new Date().getFullYear()} MaintenanceHub. All rights reserved.
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

    const emailText = `
Welcome to MaintenanceHub!

Your request for access has been approved.

Your Access Code: ${accessKey}

To complete your registration, please visit:
${process.env.APP_URL || 'https://www.maintenancehub.org'}/register

This code can only be used once.
    `;

    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      subject: "Your MaintenanceHub Access Code",
      html: emailHtml,
      text: emailText,
    });

    emailLogger.info({ result }, "Access code email sent successfully");
    return result;
  } catch (error) {
    emailLogger.error({ err: error }, "Error sending access code email");
    throw error;
  }
}
