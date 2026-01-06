/**
 * Security utilities for input validation, password strength checking,
 * and data encryption for secure API communication.
 */

export interface PasswordStrength {
  score: number; // 0-4
  label: string;
  suggestions: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface EncryptedPayload {
  data: string;      // Base64 encrypted data
  iv: string;        // Base64 initialization vector
  timestamp: number; // Request timestamp for replay protection
}

// Encryption key from environment (must match backend)
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'skinaura-default-key-32chars!!';

/**
 * Convert string to Uint8Array
 */
const stringToBuffer = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

/**
 * Convert ArrayBuffer to Base64 string
 */
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Derive a CryptoKey from password using PBKDF2
 */
const deriveKey = async (password: string): Promise<CryptoKey> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: stringToBuffer('skinaura-salt-2024') as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt data using AES-GCM
 * @param data - Plain object to encrypt
 * @returns EncryptedPayload with base64 encoded data
 */
export const encryptData = async <T extends object>(data: T): Promise<EncryptedPayload> => {
  try {
    const key = await deriveKey(ENCRYPTION_KEY);
    
    // Generate random IV (12 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Add timestamp for replay protection
    const timestamp = Date.now();
    const payload = JSON.stringify({ ...data, _ts: timestamp });
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      stringToBuffer(payload).buffer as ArrayBuffer
    );

    return {
      data: bufferToBase64(encrypted),
      iv: bufferToBase64(iv.buffer as ArrayBuffer),
      timestamp,
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt data using AES-GCM (for testing/debugging)
 */
export const decryptData = async <T>(encrypted: EncryptedPayload): Promise<T> => {
  try {
    const key = await deriveKey(ENCRYPTION_KEY);
    
    // Decode base64
    const ivBytes = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
    const dataBytes = Uint8Array.from(atob(encrypted.data), c => c.charCodeAt(0));
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      dataBytes as BufferSource
    );

    const jsonStr = new TextDecoder().decode(decrypted);
    const parsed = JSON.parse(jsonStr);
    
    // Remove internal timestamp
    delete parsed._ts;
    
    return parsed as T;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Validate input based on type
 */
export function validateInput(value: string, type: 'email' | 'phone' | 'text'): ValidationResult {
  if (type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) {
      return { valid: false, error: 'Email is required' };
    }
    if (!emailRegex.test(value)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }
    return { valid: true };
  }

  if (type === 'phone') {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (value && !phoneRegex.test(value)) {
      return { valid: false, error: 'Please enter a valid phone number' };
    }
    if (value && value.replace(/\D/g, '').length < 10) {
      return { valid: false, error: 'Phone number must be at least 10 digits' };
    }
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Sanitize input to prevent XSS
 */
export function sanitizeInput(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Check password strength
 */
export function checkPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= 8) score++;
  else suggestions.push('Use at least 8 characters');

  if (password.length >= 12) score++;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  else suggestions.push('Mix uppercase and lowercase letters');

  if (/\d/.test(password)) score++;
  else suggestions.push('Add numbers');

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  else suggestions.push('Add special characters');

  // Cap at 4
  score = Math.min(score, 4);

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

  return {
    score,
    label: labels[score],
    suggestions,
  };
}

