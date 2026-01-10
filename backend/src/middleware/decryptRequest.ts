/**
 * Request Decryption Middleware
 * Decrypts encrypted request bodies using AES-256-GCM
 */

import { Request, Response, NextFunction } from 'express';
import { decryptData, isEncryptionEnabled } from '../lib/encryption.js';

interface EncryptedBody {
  encrypted: string;
  iv: string;
}

/**
 * Check if request body is encrypted
 */
const isEncryptedRequest = (req: Request): boolean => {
  return req.headers['x-encrypted'] === 'true';
};

/**
 * Validate encrypted body structure
 */
const isValidEncryptedBody = (body: unknown): body is EncryptedBody => {
  if (!body || typeof body !== 'object') return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.encrypted === 'string' &&
    typeof obj.iv === 'string' &&
    obj.encrypted.length > 0 &&
    obj.iv.length > 0
  );
};

/**
 * Middleware to decrypt encrypted request bodies
 * 
 * Usage: Add this middleware after body parsers (express.json())
 * 
 * If the request has header 'X-Encrypted: true' and a valid encrypted body,
 * the middleware will decrypt the body and replace req.body with the decrypted data.
 */
export const decryptRequestMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Skip if encryption is not enabled on server side
    if (!isEncryptionEnabled()) {
      next();
      return;
    }

    // Skip if request is not marked as encrypted
    if (!isEncryptedRequest(req)) {
      next();
      return;
    }

    // Skip if no body or GET/DELETE requests typically don't have bodies
    if (!req.body || Object.keys(req.body).length === 0) {
      next();
      return;
    }

    // Validate encrypted body structure
    if (!isValidEncryptedBody(req.body)) {
      console.warn('Request marked as encrypted but body is invalid');
      res.status(400).json({
        success: false,
        error: 'Invalid encrypted request body',
      });
      return;
    }

    // Decrypt the body
    const { encrypted, iv } = req.body;
    const decryptedData = decryptData(encrypted, iv);

    // Replace request body with decrypted data
    req.body = decryptedData;

    console.log('✅ Request body decrypted successfully');
    next();
  } catch (error) {
    console.error('❌ Failed to decrypt request body:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to decrypt request body',
    });
  }
};

export default decryptRequestMiddleware;
