/**
 * SMS service using SimpleTexting for sending phone verification codes and messages
 */

import { env } from '../config/env.js';

const SIMPLETEXTING_API_URL = 'https://app2.simpletexting.com/v1/send';

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Convert phone to SimpleTexting format (10-digit for US/Canada)
 */
const toSimpleTextingPhone = (phone: string): string => {
  const cleaned = phone.replace(/[^\d]/g, '');
  // US/Canada: strip leading 1 if 11 digits
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return cleaned.slice(1);
  }
  return cleaned.slice(-10); // take last 10 digits for international
};

/**
 * Send SMS via SimpleTexting API
 */
export const sendSms = async (toPhone: string, message: string): Promise<SmsResult> => {
  const formattedPhone = toSimpleTextingPhone(toPhone);

  const isConfigured = env.SIMPLETEXTING_API_KEY;

  if (!isConfigured) {
    console.warn('⚠️ SimpleTexting not configured - missing SIMPLETEXTING_API_KEY');
    console.log(`📱 [DEV] SMS to ${formattedPhone}: ${message}`);
    return {
      success: true,
      messageId: 'dev-mode',
      error: 'SimpleTexting not configured. Missing: SIMPLETEXTING_API_KEY',
    };
  }

  try {
    const params = new URLSearchParams();
    params.append('phone', formattedPhone);
    params.append('message', message);

    const response = await fetch(SIMPLETEXTING_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SIMPLETEXTING_API_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    const data = (await response.json()) as { code?: number; smsid?: string; message?: string };

    if (data.code === 1) {
      console.log(`✅ SMS sent to ${formattedPhone}, smsid: ${data.smsid || 'N/A'}`);
      return {
        success: true,
        messageId: data.smsid,
      };
    }

    const errorMsg = data.message || 'Failed to send SMS';
    console.error('❌ SimpleTexting API error:', errorMsg, data);
    return {
      success: false,
      error: errorMsg,
    };
  } catch (error: any) {
    console.error('❌ Failed to send SMS:', error);
    console.error('   Phone:', formattedPhone);
    console.error('   Error details:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
    };
  }
};

/**
 * Generate a 6-digit verification code
 */
export const generatePhoneVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Get phone verification code expiry timestamp
 */
export const getPhoneVerificationCodeExpiry = (): Date => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + env.VERIFICATION_CODE_EXPIRY_MINUTES);
  return expiry;
};

/**
 * Format phone number to E.164 format if not already
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If doesn't start with +, assume it needs country code
  if (!cleaned.startsWith('+')) {
    // If it starts with 1 and is 11 digits, it's likely US/Canada
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 10) {
      // Assume US number without country code
      cleaned = '+1' + cleaned;
    } else {
      // Add + prefix
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
};

/**
 * Send phone verification SMS
 */
export const sendVerificationSms = async (
  toPhone: string,
  verificationCode: string
): Promise<SmsResult> => {
  const formattedPhone = formatPhoneNumber(toPhone);
  const message = `Your SkinAura PRO verification code is: ${verificationCode}. This code expires in ${env.VERIFICATION_CODE_EXPIRY_MINUTES} minutes.`;
  return sendSms(formattedPhone, message);
};

/**
 * Send welcome SMS after phone verification
 */
export const sendWelcomeSms = async (toPhone: string): Promise<SmsResult> => {
  const formattedPhone = formatPhoneNumber(toPhone);
  const message = `Welcome to SkinAura PRO! Your phone has been verified. You're all set to start your skincare journey.`;
  return sendSms(formattedPhone, message);
};

export default {
  generatePhoneVerificationCode,
  getPhoneVerificationCodeExpiry,
  formatPhoneNumber,
  sendSms,
  sendVerificationSms,
  sendWelcomeSms,
};
