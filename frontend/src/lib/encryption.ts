/**
 * Frontend Encryption Utility
 * Uses Web Crypto API for AES-256-GCM encryption
 */

// Get encryption key from environment variable
const ENCRYPTION_KEY = import.meta.env.VITE_API_ENCRYPTION_KEY || 'default-dev-key-32-characters!!';

/**
 * Convert string to ArrayBuffer
 */
const stringToArrayBuffer = (str: string): ArrayBuffer => {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
};
/**
 * Convert ArrayBuffer to Base64 string
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convert Base64 string to ArrayBuffer
 */
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Derive a CryptoKey from the encryption key string
 */
const deriveKey = async (keyString: string): Promise<CryptoKey> => {
  // Ensure key is exactly 32 bytes for AES-256
  const keyBytes = new TextEncoder().encode(keyString.padEnd(32, '0').slice(0, 32));
  
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt data using AES-256-GCM
 * Returns: { iv: base64, data: base64, tag: included in data }
 */
export const encryptData = async (data: unknown): Promise<{ encrypted: string; iv: string }> => {
  try {
    const key = await deriveKey(ENCRYPTION_KEY);
    
    // Generate random 12-byte IV (recommended for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Convert data to JSON string, then to ArrayBuffer
    const plaintext = JSON.stringify(data);
    const plaintextBuffer = stringToArrayBuffer(plaintext);
    
    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit auth tag
      },
      key,
      plaintextBuffer
    );
    
    return {
      encrypted: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer),
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt data using AES-256-GCM (for client-side decryption if needed)
 */
export const decryptData = async (encryptedData: string, iv: string): Promise<unknown> => {
  try {
    const key = await deriveKey(ENCRYPTION_KEY);
    
    const ciphertext = base64ToArrayBuffer(encryptedData);
    const ivBuffer = base64ToArrayBuffer(iv);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
        tagLength: 128,
      },
      key,
      ciphertext
    );
    
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decrypted);
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Check if encryption is enabled
 */
export const isEncryptionEnabled = (): boolean => {
  return import.meta.env.VITE_ENABLE_ENCRYPTION === 'true';
};

// ============================================================================
// IMAGE/FILE ENCRYPTION UTILITIES
// ============================================================================

/**
 * Encrypt a File/Blob for upload
 * @param file - File or Blob to encrypt
 * @returns Object with encrypted base64 data, iv, and mime type
 */
export const encryptFile = async (file: File | Blob): Promise<{ 
  encrypted: string; 
  iv: string; 
  mimeType: string;
  originalName?: string;
}> => {
  try {
    const key = await deriveKey(ENCRYPTION_KEY);
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Generate random 12-byte IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the file content
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      key,
      arrayBuffer
    );
    
    return {
      encrypted: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv.buffer),
      mimeType: file.type || 'application/octet-stream',
      originalName: file instanceof File ? file.name : undefined,
    };
  } catch (error) {
    console.error('File encryption failed:', error);
    throw new Error('Failed to encrypt file');
  }
};

/**
 * Decrypt binary data to a Blob
 * @param encryptedData - Base64 encoded encrypted data
 * @param iv - Base64 encoded IV
 * @param mimeType - MIME type of the original file
 * @returns Decrypted Blob
 */
export const decryptFileToBlob = async (
  encryptedData: string, 
  iv: string, 
  mimeType: string = 'application/octet-stream'
): Promise<Blob> => {
  try {
    const key = await deriveKey(ENCRYPTION_KEY);
    
    const ciphertext = base64ToArrayBuffer(encryptedData);
    const ivBuffer = base64ToArrayBuffer(iv);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
        tagLength: 128,
      },
      key,
      ciphertext
    );
    
    return new Blob([decrypted], { type: mimeType });
  } catch (error) {
    console.error('File decryption failed:', error);
    throw new Error('Failed to decrypt file');
  }
};

// ============================================================================
// IMAGE UPLOAD UTILITIES
// ============================================================================

// Valid image categories
export type ImageCategory = 'avatars' | 'products' | 'photos' | 'treatments';

// Get API base URL
const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5505';
};

/**
 * Upload an image to the generic image endpoint
 * @param file - File to upload
 * @param category - Image category (avatars, products, photos, treatments)
 * @param token - Auth token
 * @returns Upload response with image URL
 */
export const uploadImage = async (
  file: File,
  category: ImageCategory,
  token: string
): Promise<{ success: boolean; data?: { image_url: string }; error?: string }> => {
  try {
    const uploadUrl = `${getApiBaseUrl()}/api/images/upload/${category}`;

    if (isEncryptionEnabled()) {
      // Encrypt the file
      const encryptedData = await encryptFile(file);
      
      // Send as JSON with encrypted data
      // NOTE: Do NOT send 'X-Encrypted: true' header for image uploads!
      // The backend will detect encrypted images by checking for encrypted/iv/mimeType fields.
      // The X-Encrypted header triggers the decryptRequestMiddleware which is for JSON body decryption,
      // not for binary file decryption.
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(encryptedData),
      });
      
      return await response.json();
    } else {
      // Send as regular FormData
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      return await response.json();
    }
  } catch (error) {
    console.error('Upload image failed:', error);
    return { success: false, error: 'Failed to upload image' };
  }
};

export default {
  encryptData,
  decryptData,
  isEncryptionEnabled,
  encryptFile,
  decryptFileToBlob,
  uploadImage,
};
