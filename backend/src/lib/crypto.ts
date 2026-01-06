/**
 * Crypto utilities for request decryption.
 * Uses AES-256-GCM with PBKDF2 key derivation.
 * Must match frontend encryption implementation.
 */

import crypto from 'crypto';
import { env } from '../config/env.js';

export interface EncryptedPayload {
  data: string;      // Base64 encrypted data
  iv: string;        // Base64 initialization vector
  timestamp: number; // Request timestamp for replay protection
}

export interface DecryptedResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Must match frontend key
const ENCRYPTION_KEY = env.ENCRYPTION_KEY || 'skinaura-default-key-32chars!!';
const SALT = 'skinaura-salt-2024';
const ITERATIONS = 100000;
const KEY_LENGTH = 32; // 256 bits

// Maximum age for request timestamps (5 minutes)
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

/**
 * Derive key using PBKDF2 (matching Web Crypto API implementation)
 */
const deriveKey = (password: string): Buffer => {
  return crypto.pbkdf2Sync(
    password,
    Buffer.from(SALT, 'utf-8'),
    ITERATIONS,
    KEY_LENGTH,
    'sha256'
  );
};

/**
 * Decrypt data received from frontend
 * @param encrypted - EncryptedPayload from frontend
 * @returns Decrypted data or error
 */
export const decryptRequestData = <T = Record<string, unknown>>(
  encrypted: EncryptedPayload
): DecryptedResult<T> => {
  try {
    // Validate timestamp (replay protection)
    const now = Date.now();
    const age = now - encrypted.timestamp;
    
    if (age > MAX_TIMESTAMP_AGE_MS || age < -30000) {
      // Allow 30 seconds clock skew backwards
      return {
        success: false,
        error: 'Request expired or invalid timestamp',
      };
    }

    // Decode base64
    const iv = Buffer.from(encrypted.iv, 'base64');
    const encryptedData = Buffer.from(encrypted.data, 'base64');

    // Derive key
    const key = deriveKey(ENCRYPTION_KEY);

    // AES-GCM uses last 16 bytes as auth tag
    const authTagLength = 16;
    const authTag = encryptedData.subarray(encryptedData.length - authTagLength);
    const ciphertext = encryptedData.subarray(0, encryptedData.length - authTagLength);

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    // Parse JSON
    const parsed = JSON.parse(decrypted);

    // Remove internal timestamp
    delete parsed._ts;

    return {
      success: true,
      data: parsed as T,
    };
  } catch (error) {
    console.error('Decryption error:', error);
    return {
      success: false,
      error: 'Failed to decrypt request data',
    };
  }
};

/**
 * Encrypt response data (for secure responses if needed)
 */
export const encryptResponseData = <T extends object>(data: T): EncryptedPayload => {
  try {
    const key = deriveKey(ENCRYPTION_KEY);
    const iv = crypto.randomBytes(12);
    const timestamp = Date.now();

    const payload = JSON.stringify({ ...data, _ts: timestamp });

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(payload, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Append auth tag
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([encrypted, authTag]);

    return {
      data: combined.toString('base64'),
      iv: iv.toString('base64'),
      timestamp,
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt response data');
  }
};

/**
 * Middleware to decrypt request body
 */
export const decryptRequestMiddleware = (
  req: { body: EncryptedPayload | Record<string, unknown> },
  res: { status: (code: number) => { json: (data: unknown) => void } },
  next: () => void
): void => {
  // Check if body looks like encrypted payload
  if (
    req.body &&
    typeof req.body === 'object' &&
    'data' in req.body &&
    'iv' in req.body &&
    'timestamp' in req.body
  ) {
    const result = decryptRequestData(req.body as EncryptedPayload);
    
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Invalid encrypted payload',
      });
      return;
    }

    // Replace body with decrypted data
    req.body = result.data as Record<string, unknown>;
  }

  next();
};

export default {
  decryptRequestData,
  encryptResponseData,
  decryptRequestMiddleware,
};

