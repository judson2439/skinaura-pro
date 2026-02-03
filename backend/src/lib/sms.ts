/**
 * SMS service using Twilio for sending phone verification codes
 */

import twilio from 'twilio';
import { env } from '../config/env.js';

// Initialize Twilio client
const twilioClient = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
  ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  : null;

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

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

  // Check Twilio configuration
  const isTwilioConfigured = twilioClient && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER;
  
  if (!isTwilioConfigured) {
    const missingConfig = [];
    if (!env.TWILIO_ACCOUNT_SID) missingConfig.push('TWILIO_ACCOUNT_SID');
    if (!env.TWILIO_AUTH_TOKEN) missingConfig.push('TWILIO_AUTH_TOKEN');
    if (!env.TWILIO_PHONE_NUMBER) missingConfig.push('TWILIO_PHONE_NUMBER');
    
    console.warn(`⚠️ Twilio not configured - missing: ${missingConfig.join(', ')}`);
    console.log(`📱 [DEV] Verification code for ${formattedPhone}: ${verificationCode}`);
    return { 
      success: true, 
      messageId: 'dev-mode',
      error: `Twilio not configured. Missing: ${missingConfig.join(', ')}`,
    };
  }

  try {
    const message = await twilioClient.messages.create({
      body: `Your SkinAura PRO verification code is: ${verificationCode}. This code expires in ${env.VERIFICATION_CODE_EXPIRY_MINUTES} minutes.`,
      from: env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log(`✅ Verification SMS sent to ${formattedPhone}, SID: ${message.sid}`);

    return {
      success: true,
      messageId: message.sid,
    };
  } catch (error: any) {
    console.error('❌ Failed to send verification SMS:', error);
    console.error('   Phone:', formattedPhone);
    console.error('   Twilio Account SID:', env.TWILIO_ACCOUNT_SID ? 'Set' : 'Missing');
    console.error('   Twilio Phone Number:', env.TWILIO_PHONE_NUMBER || 'Missing');
    console.error('   Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
    });
    return {
      success: false,
      error: error.message || error.code || 'Failed to send SMS',
    };
  }
};

/**
 * Send welcome SMS after phone verification
 */
export const sendWelcomeSms = async (toPhone: string): Promise<SmsResult> => {
  const formattedPhone = formatPhoneNumber(toPhone);

  if (!twilioClient || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
    console.warn('⚠️ Twilio not configured - welcome SMS not sent');
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const message = await twilioClient.messages.create({
      body: `Welcome to SkinAura PRO! Your phone has been verified. You're all set to start your skincare journey.`,
      from: env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log(`✅ Welcome SMS sent to ${formattedPhone}`);
    return { success: true, messageId: message.sid };
  } catch (error: any) {
    console.error('❌ Failed to send welcome SMS:', error);
    return { success: false, error: error.message };
  }
};

export default {
  generatePhoneVerificationCode,
  getPhoneVerificationCodeExpiry,
  formatPhoneNumber,
  sendVerificationSms,
  sendWelcomeSms,
};

