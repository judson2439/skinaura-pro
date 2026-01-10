/**
 * Backend Encryption/Decryption Utility
 * Uses Node.js crypto module for AES-256-GCM
 */

import crypto from 'crypto';

// Get encryption key from environment variable
const ENCRYPTION_KEY = process.env.API_ENCRYPTION_KEY || 'default-dev-key-32-characters!!';

/**
 * Ensure key is exactly 32 bytes for AES-256
 */
const getKeyBuffer = (): Buffer => {
  const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
  return Buffer.from(key, 'utf8');
};

/**
 * Decrypt data using AES-256-GCM
 * @param encryptedData - Base64 encoded ciphertext (includes auth tag)
 * @param iv - Base64 encoded initialization vector
 * @returns Decrypted data as parsed JSON
 */
export const decryptData = (encryptedData: string, iv: string): unknown => {
  try {
    const key = getKeyBuffer();
    const ivBuffer = Buffer.from(iv, 'base64');
    const ciphertext = Buffer.from(encryptedData, 'base64');
    
    // GCM auth tag is the last 16 bytes of the ciphertext
    const authTagLength = 16;
    const authTag = ciphertext.subarray(ciphertext.length - authTagLength);
    const encryptedContent = ciphertext.subarray(0, ciphertext.length - authTagLength);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedContent);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    const jsonString = decrypted.toString('utf8');
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Encrypt data using AES-256-GCM (for response encryption if needed)
 * @param data - Data to encrypt
 * @returns Object with encrypted data and IV (both base64 encoded)
 */
export const encryptData = (data: unknown): { encrypted: string; iv: string } => {
  try {
    const key = getKeyBuffer();
    
    // Generate random 12-byte IV (recommended for GCM)
    const iv = crypto.randomBytes(12);
    
    const plaintext = JSON.stringify(data);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Append auth tag to ciphertext
    const authTag = cipher.getAuthTag();
    const ciphertext = Buffer.concat([encrypted, authTag]);
    
    return {
      encrypted: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Check if encryption is enabled
 */
export const isEncryptionEnabled = (): boolean => {
  return process.env.ENABLE_ENCRYPTION === 'true';
};

// ============================================================================
// IMAGE/FILE ENCRYPTION UTILITIES
// ============================================================================

/**
 * Encrypt a filename to obscure the original name
 * @param filename - Original filename
 * @returns Encrypted filename with extension preserved
 */
export const encryptFilename = (filename: string): string => {
  try {
    const key = getKeyBuffer();
    const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
    const baseName = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
    
    // Create a hash of the filename + timestamp for uniqueness
    const hash = crypto
      .createHmac('sha256', key)
      .update(baseName + Date.now().toString())
      .digest('hex')
      .substring(0, 32);
    
    return `enc_${hash}${ext}`;
  } catch (error) {
    console.error('Filename encryption failed:', error);
    // Fallback to timestamp-based name
    return `enc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
};

/**
 * Encrypt binary data (file content) using AES-256-GCM
 * @param buffer - File content as Buffer
 * @returns Encrypted buffer with IV prepended
 */
export const encryptFile = (buffer: Buffer): Buffer => {
  try {
    const key = getKeyBuffer();
    const iv = crypto.randomBytes(12);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    // Format: [iv (12 bytes)] + [authTag (16 bytes)] + [ciphertext]
    return Buffer.concat([iv, authTag, encrypted]);
  } catch (error) {
    console.error('File encryption failed:', error);
    throw new Error('Failed to encrypt file');
  }
};

/**
 * Decrypt binary data (file content) using AES-256-GCM
 * @param encryptedBuffer - Encrypted buffer with IV prepended
 * @returns Decrypted file content as Buffer
 */
export const decryptFile = (encryptedBuffer: Buffer): Buffer => {
  try {
    const key = getKeyBuffer();
    
    // Extract IV (first 12 bytes), authTag (next 16 bytes), and ciphertext
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const ciphertext = encryptedBuffer.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  } catch (error) {
    console.error('File decryption failed:', error);
    throw new Error('Failed to decrypt file');
  }
};

/**
 * Decrypt base64-encoded image data from frontend
 * @param encryptedBase64 - Base64 encoded encrypted data
 * @param ivBase64 - Base64 encoded IV
 * @returns Decrypted file content as Buffer
 */
export const decryptImageFromBase64 = (encryptedBase64: string, ivBase64: string): Buffer => {
  try {
    const key = getKeyBuffer();
    const ivBuffer = Buffer.from(ivBase64, 'base64');
    const ciphertext = Buffer.from(encryptedBase64, 'base64');
    
    // GCM auth tag is the last 16 bytes of the ciphertext
    const authTagLength = 16;
    const authTag = ciphertext.subarray(ciphertext.length - authTagLength);
    const encryptedContent = ciphertext.subarray(0, ciphertext.length - authTagLength);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedContent);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  } catch (error) {
    console.error('Image decryption from base64 failed:', error);
    throw new Error('Failed to decrypt image');
  }
};

export default {
  encryptData,
  decryptData,
  isEncryptionEnabled,
  encryptFilename,
  encryptFile,
  decryptFile,
  decryptImageFromBase64,
};
