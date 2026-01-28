/**
 * Email service using Mailgun for sending verification emails
 */

import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { env } from '../config/env.js';

// Initialize Mailgun client
const mailgun = new Mailgun(formData);
const mg = env.MAILGUN_API_KEY ? mailgun.client({
  username: 'api',
  key: env.MAILGUN_API_KEY,
}) : null;

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Generate a 6-digit verification code
 */
export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Get verification code expiry timestamp
 */
export const getVerificationCodeExpiry = (): Date => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + env.VERIFICATION_CODE_EXPIRY_MINUTES);
  return expiry;
};

/**
 * Send email verification code
 */
export const sendVerificationEmail = async (
  toEmail: string,
  toName: string,
  verificationCode: string
): Promise<EmailResult> => {
  if (!mg || !env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    console.warn('⚠️ Mailgun not configured - email not sent');
    console.log(`📧 [DEV] Verification code for ${toEmail}: ${verificationCode}`);
    return { 
      success: true, 
      messageId: 'dev-mode',
    };
  }

  try {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - SkinAura PRO</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #CFAFA3 0%, #E8D5D0 100%); border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: #2D2A3E; font-size: 28px; font-weight: 700;">SkinAura PRO</h1>
              <p style="margin: 10px 0 0; color: #5D5A6E; font-size: 14px;">Professional Skincare Management</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #2D2A3E; font-size: 24px; font-weight: 600;">Verify Your Email</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Hi ${toName},
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                Thank you for signing up for SkinAura PRO! Please use the verification code below to complete your registration:
              </p>
              
              <!-- Verification Code Box -->
              <div style="background: linear-gradient(135deg, #CFAFA3 0%, #E8D5D0 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px;">
                <p style="margin: 0 0 10px; color: #2D2A3E; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Your Verification Code</p>
                <p style="margin: 0; color: #2D2A3E; font-size: 36px; font-weight: 700; letter-spacing: 8px;">${verificationCode}</p>
              </div>
              
              <p style="margin: 0 0 20px; color: #999; font-size: 14px; line-height: 1.6;">
                This code will expire in ${env.VERIFICATION_CODE_EXPIRY_MINUTES} minutes. If you didn't create an account with SkinAura PRO, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} SkinAura PRO. All rights reserved.
              </p>
              <p style="margin: 10px 0 0; color: #999; font-size: 12px;">
                This is an automated message, please do not reply.
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

    const textContent = `
Verify Your Email - SkinAura PRO

Hi ${toName},

Thank you for signing up for SkinAura PRO! Please use the verification code below to complete your registration:

Your Verification Code: ${verificationCode}

This code will expire in ${env.VERIFICATION_CODE_EXPIRY_MINUTES} minutes. If you didn't create an account with SkinAura PRO, you can safely ignore this email.

© ${new Date().getFullYear()} SkinAura PRO. All rights reserved.
`;

    const result = await mg.messages.create(env.MAILGUN_DOMAIN, {
      from: `${env.MAILGUN_FROM_NAME} <${env.MAILGUN_FROM_EMAIL}>`,
      to: [toEmail],
      subject: 'Verify Your Email - SkinAura PRO',
      text: textContent,
      html: htmlContent,
    });

    console.log(`✅ Verification email sent to ${toEmail}, messageId: ${result.id}`);

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error: any) {
    console.error('❌ Failed to send verification email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
};

/**
 * Send welcome email after verification
 */
export const sendWelcomeEmail = async (
  toEmail: string,
  toName: string,
  role: 'client' | 'professional'
): Promise<EmailResult> => {
  if (!mg || !env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    console.warn('⚠️ Mailgun not configured - welcome email not sent');
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const dashboardUrl = role === 'professional' 
      ? `${env.FRONTEND_URL}/professional`
      : `${env.FRONTEND_URL}/client`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SkinAura PRO</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #CFAFA3 0%, #E8D5D0 100%); border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: #2D2A3E; font-size: 28px; font-weight: 700;">Welcome to SkinAura PRO!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Hi ${toName},
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Your email has been verified and your account is now active! You're all set to start your skincare journey with SkinAura PRO.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #CFAFA3 0%, #B89A8E 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Go to Dashboard</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} SkinAura PRO. All rights reserved.
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

    const result = await mg.messages.create(env.MAILGUN_DOMAIN, {
      from: `${env.MAILGUN_FROM_NAME} <${env.MAILGUN_FROM_EMAIL}>`,
      to: [toEmail],
      subject: 'Welcome to SkinAura PRO!',
      html: htmlContent,
    });

    console.log(`✅ Welcome email sent to ${toEmail}`);
    return { success: true, messageId: result.id };
  } catch (error: any) {
    console.error('❌ Failed to send welcome email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send client invitation email (legacy - without token)
 */
export const sendClientInvitationEmail = async (
  toEmail: string,
  professionalName: string,
  businessName: string
): Promise<EmailResult> => {
  if (!mg || !env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    console.warn('⚠️ Mailgun not configured - invitation email not sent');
    console.log(`📧 [DEV] Invitation email for ${toEmail} from ${professionalName} (${businessName})`);
    return { 
      success: true, 
      messageId: 'dev-mode',
    };
  }

  try {
    const signupUrl = `${env.FRONTEND_URL}?signup=client`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've Been Invited - SkinAura PRO</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #CFAFA3 0%, #E8D5D0 100%); border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: #2D2A3E; font-size: 28px; font-weight: 700;">SkinAura PRO</h1>
              <p style="margin: 10px 0 0; color: #5D5A6E; font-size: 14px;">Professional Skincare Management</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #2D2A3E; font-size: 24px; font-weight: 600;">You've Been Invited!</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                <strong>${professionalName}</strong> from <strong>${businessName}</strong> has invited you to join SkinAura PRO as their client.
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                With SkinAura PRO, you'll be able to:
              </p>
              <ul style="margin: 0 0 30px; padding-left: 20px; color: #666; font-size: 16px; line-height: 1.8;">
                <li>Track your personalized skincare routines</li>
                <li>Document your progress with photos</li>
                <li>Receive product recommendations from your skincare professional</li>
                <li>Communicate directly with your skincare expert</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${signupUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #CFAFA3 0%, #B89A8E 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Create Your Account</a>
              </div>
              
              <p style="margin: 0; color: #999; font-size: 14px; line-height: 1.6;">
                This invitation was sent by ${professionalName}. If you weren't expecting this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} SkinAura PRO. All rights reserved.
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

    const textContent = `
You've Been Invited - SkinAura PRO

${professionalName} from ${businessName} has invited you to join SkinAura PRO as their client.

With SkinAura PRO, you'll be able to:
- Track your personalized skincare routines
- Document your progress with photos
- Receive product recommendations from your skincare professional
- Communicate directly with your skincare expert

Create your account here: ${signupUrl}

This invitation was sent by ${professionalName}. If you weren't expecting this email, you can safely ignore it.

© ${new Date().getFullYear()} SkinAura PRO. All rights reserved.
`;

    const result = await mg.messages.create(env.MAILGUN_DOMAIN, {
      from: `${env.MAILGUN_FROM_NAME} <${env.MAILGUN_FROM_EMAIL}>`,
      to: [toEmail],
      subject: `${professionalName} has invited you to SkinAura PRO`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`✅ Invitation email sent to ${toEmail}, messageId: ${result.id}`);

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error: any) {
    console.error('❌ Failed to send invitation email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
};

/**
 * Generate a unique invitation token
 */
export const generateInvitationToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

/**
 * Get invitation token expiry timestamp (7 days from now)
 */
export const getInvitationTokenExpiry = (): Date => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return expiry;
};

// Default logo URL for email templates
const DEFAULT_LOGO_URL = 'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png';

/**
 * Send client invitation email with token link
 */
export const sendClientInvitationWithTokenEmail = async (
  toEmail: string,
  professionalName: string,
  businessName: string,
  invitationToken: string,
  logoUrl?: string
): Promise<EmailResult> => {
  // Use professional's logo if provided, otherwise use default
  const emailLogoUrl = logoUrl || DEFAULT_LOGO_URL;

  if (!mg || !env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    console.warn('⚠️ Mailgun not configured - invitation email not sent');
    console.log(`📧 [DEV] Invitation email for ${toEmail} from ${professionalName} (${businessName})`);
    console.log(`📧 [DEV] Invitation link: ${env.FRONTEND_URL}/client-confirm?token=${invitationToken}`);
    console.log(`📧 [DEV] Logo URL: ${emailLogoUrl}`);
    return { 
      success: true, 
      messageId: 'dev-mode',
    };
  }

  try {
    const invitationUrl = `${env.FRONTEND_URL}/client-confirm?token=${invitationToken}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've Been Invited - SkinAura PRO</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #CFAFA3 0%, #E8D5D0 100%); border-radius: 16px 16px 0 0;">
              <img src="${emailLogoUrl}" alt="${businessName} Logo" style="max-width: 180px; max-height: 80px; object-fit: contain; margin-bottom: 16px;" />
              <h1 style="margin: 0; color: #2D2A3E; font-size: 28px; font-weight: 700;">${businessName}</h1>
              <p style="margin: 10px 0 0; color: #5D5A6E; font-size: 14px;">Professional Skincare Management</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #2D2A3E; font-size: 24px; font-weight: 600;">You've Been Invited!</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                <strong>${professionalName}</strong> from <strong>${businessName}</strong> has invited you to join SkinAura PRO as their client.
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                With SkinAura PRO, you'll be able to:
              </p>
              <ul style="margin: 0 0 30px; padding-left: 20px; color: #666; font-size: 16px; line-height: 1.8;">
                <li>Track your personalized skincare routines</li>
                <li>Document your progress with photos</li>
                <li>Receive product recommendations from your skincare professional</li>
                <li>Communicate directly with your skincare expert</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #CFAFA3 0%, #B89A8E 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation & Create Account</a>
              </div>

              <p style="margin: 0 0 20px; color: #666; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px; color: #CFAFA3; font-size: 14px; word-break: break-all;">
                ${invitationUrl}
              </p>
              
              <p style="margin: 0; color: #999; font-size: 14px; line-height: 1.6;">
                This invitation will expire in 7 days. If you weren't expecting this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} SkinAura PRO. All rights reserved.
              </p>
              <p style="margin: 10px 0 0; color: #999; font-size: 12px;">
                This is an automated message, please do not reply.
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

    const textContent = `
You've Been Invited - SkinAura PRO

${professionalName} from ${businessName} has invited you to join SkinAura PRO as their client.

With SkinAura PRO, you'll be able to:
- Track your personalized skincare routines
- Document your progress with photos
- Receive product recommendations from your skincare professional
- Communicate directly with your skincare expert

Accept your invitation and create your account here:
${invitationUrl}

This invitation will expire in 7 days. If you weren't expecting this email, you can safely ignore it.

© ${new Date().getFullYear()} SkinAura PRO. All rights reserved.
`;

    const result = await mg.messages.create(env.MAILGUN_DOMAIN, {
      from: `${env.MAILGUN_FROM_NAME} <${env.MAILGUN_FROM_EMAIL}>`,
      to: [toEmail],
      subject: `${professionalName} has invited you to SkinAura PRO`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`✅ Invitation email with token sent to ${toEmail}, messageId: ${result.id}`);

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error: any) {
    console.error('❌ Failed to send invitation email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
};

/**
 * Generate a unique password reset token
 */
export const generateResetToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

/**
 * Get password reset token expiry timestamp (1 hour from now)
 */
export const getResetTokenExpiry = (): Date => {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 1);
  return expiry;
};

/**
 * Send password reset email with reset link
 */
export const sendPasswordResetEmail = async (
  toEmail: string,
  toName: string,
  resetToken: string
): Promise<EmailResult> => {
  if (!mg || !env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    console.warn('⚠️ Mailgun not configured - password reset email not sent');
    console.log(`📧 [DEV] Password reset link for ${toEmail}: ${env.FRONTEND_URL}/reset-password?token=${resetToken}`);
    return { 
      success: true, 
      messageId: 'dev-mode',
    };
  }

  try {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - SkinAura PRO</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #CFAFA3 0%, #E8D5D0 100%); border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: #2D2A3E; font-size: 28px; font-weight: 700;">SkinAura PRO</h1>
              <p style="margin: 10px 0 0; color: #5D5A6E; font-size: 14px;">Professional Skincare Management</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #2D2A3E; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                Hi ${toName},
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password for your SkinAura PRO account. Click the button below to create a new password:
              </p>
              
              <!-- Reset Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #CFAFA3 0%, #B89A8E 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reset Password</a>
              </div>
              
              <p style="margin: 0 0 20px; color: #666; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px; color: #CFAFA3; font-size: 14px; word-break: break-all;">
                ${resetUrl}
              </p>
              
              <p style="margin: 0 0 20px; color: #999; font-size: 14px; line-height: 1.6;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email - your password won't be changed.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} SkinAura PRO. All rights reserved.
              </p>
              <p style="margin: 10px 0 0; color: #999; font-size: 12px;">
                This is an automated message, please do not reply.
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

    const textContent = `
Reset Your Password - SkinAura PRO

Hi ${toName},

We received a request to reset your password for your SkinAura PRO account. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email - your password won't be changed.

© ${new Date().getFullYear()} SkinAura PRO. All rights reserved.
`;

    const result = await mg.messages.create(env.MAILGUN_DOMAIN, {
      from: `${env.MAILGUN_FROM_NAME} <${env.MAILGUN_FROM_EMAIL}>`,
      to: [toEmail],
      subject: 'Reset Your Password - SkinAura PRO',
      text: textContent,
      html: htmlContent,
    });

    console.log(`✅ Password reset email sent to ${toEmail}, messageId: ${result.id}`);

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error: any) {
    console.error('❌ Failed to send password reset email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
};

/**
 * Send connection reminder email to existing client
 * This is sent when a professional invites an already-registered client
 */
export const sendConnectionReminderEmail = async (
  toEmail: string,
  clientName: string,
  professionalName: string,
  businessName?: string,
  logoUrl?: string
): Promise<EmailResult> => {
  if (!mg || !env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
    console.warn('⚠️ Mailgun not configured - email not sent');
    console.log(`📧 [DEV] Connection reminder for ${toEmail}: ${professionalName} wants to connect`);
    return { 
      success: true, 
      messageId: 'dev-mode',
    };
  }

  try {
    const displayName = businessName || professionalName;
    const actualLogoUrl = logoUrl || 'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png';
    const loginUrl = `${env.FRONTEND_URL}`;
    
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connection Request - SkinAura PRO</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #CFAFA3 0%, #E8D5D0 100%); border-radius: 16px 16px 0 0;">
              <img src="${actualLogoUrl}" alt="${displayName}" style="max-width: 120px; max-height: 80px; margin-bottom: 15px; border-radius: 8px;" />
              <h1 style="margin: 0; color: #2D2A3E; font-size: 24px; font-weight: 700;">Connection Request</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #2D2A3E; font-size: 18px; font-weight: 600;">
                Hi ${clientName}! 👋
              </p>
              <p style="margin: 0 0 20px; color: #666; font-size: 16px; line-height: 1.6;">
                <strong>${professionalName}</strong>${businessName ? ` from <strong>${businessName}</strong>` : ''} would like to connect with you on SkinAura PRO.
              </p>
              <p style="margin: 0 0 30px; color: #666; font-size: 16px; line-height: 1.6;">
                By accepting this connection, you'll be able to receive personalized skincare routines, product recommendations, and treatment plans from your skincare professional.
              </p>
              
              <!-- Info Box -->
              <div style="background: linear-gradient(135deg, #CFAFA3 0%, #E8D5D0 100%); border-radius: 12px; padding: 25px; margin: 0 0 30px;">
                <p style="margin: 0; color: #2D2A3E; font-size: 16px; line-height: 1.6;">
                  <strong>What happens next?</strong><br/>
                  Log in to your SkinAura PRO account to view and respond to this connection request. You'll find it in your notifications.
                </p>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #2D2A3E 0%, #3D3A4E 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600;">
                  Log In to Respond
                </a>
              </div>
              
              <p style="margin: 30px 0 0; color: #999; font-size: 14px; line-height: 1.6; text-align: center;">
                If you don't recognize this request, you can simply ignore it or decline the connection when you log in.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9f9f9; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0 0 10px; color: #999; font-size: 12px;">
                This email was sent by SkinAura PRO on behalf of ${displayName}
              </p>
              <p style="margin: 0; color: #CFAFA3; font-size: 12px;">
                © ${new Date().getFullYear()} SkinAura PRO. All rights reserved.
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

    const result = await mg.messages.create(env.MAILGUN_DOMAIN, {
      from: `${displayName} via SkinAura PRO <noreply@${env.MAILGUN_DOMAIN}>`,
      to: toEmail,
      subject: `${professionalName} wants to connect with you on SkinAura PRO`,
      html: htmlContent,
    });

    console.log(`✅ Connection reminder email sent to ${toEmail}`);
    return {
      success: true,
      messageId: result.id,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to send connection reminder email:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

export default {
  generateVerificationCode,
  getVerificationCodeExpiry,
  sendVerificationEmail,
  sendWelcomeEmail,
  sendClientInvitationEmail,
  generateInvitationToken,
  getInvitationTokenExpiry,
  sendClientInvitationWithTokenEmail,
  sendConnectionReminderEmail,
  generateResetToken,
  getResetTokenExpiry,
  sendPasswordResetEmail,
};

