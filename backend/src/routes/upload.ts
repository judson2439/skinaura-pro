/**
 * Upload routes for handling file uploads
 * Files are encrypted before storage and decrypted on retrieval
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import { 
  hashFilename, 
  encryptAndSaveFile, 
  readAndDecryptFile,
  getMimeType,
  decryptRequestData,
  EncryptedPayload,
} from '../lib/crypto.js';

const router = Router();

// Base path for uploads
const UPLOADS_BASE_PATH = path.join(process.cwd(), 'public', 'uploads');
const AVATARS_PATH = path.join(UPLOADS_BASE_PATH, 'avatars');

interface AvatarUploadRequest {
  imageData: string;  // Base64 encoded image data
  filename: string;   // Original filename
  userId: string;     // User ID for hashing
  mimeType?: string;  // MIME type of the image
}

/**
 * POST /upload/avatar
 * Upload and encrypt an avatar image
 */
router.post('/avatar', async (req: Request, res: Response): Promise<void> => {
  try {
    let uploadData: AvatarUploadRequest;

    // Check if request is encrypted
    const body = req.body as EncryptedPayload | AvatarUploadRequest;
    if ('data' in body && 'iv' in body && 'timestamp' in body) {
      const result = decryptRequestData<AvatarUploadRequest>(body as EncryptedPayload);
      if (!result.success || !result.data) {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to decrypt request',
        });
        return;
      }
      uploadData = result.data;
    } else {
      uploadData = body as AvatarUploadRequest;
    }

    const { imageData, filename, userId, mimeType } = uploadData;

    // Validate required fields
    if (!imageData || !filename || !userId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: imageData, filename, and userId are required',
      });
      return;
    }

    // Validate image data (should be base64)
    if (!imageData.includes('base64,') && !isBase64(imageData)) {
      res.status(400).json({
        success: false,
        error: 'Invalid image data format. Expected base64 encoded image.',
      });
      return;
    }

    // Extract base64 data (remove data URL prefix if present)
    let base64Data = imageData;
    if (imageData.includes('base64,')) {
      base64Data = imageData.split('base64,')[1];
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (imageBuffer.length > maxSize) {
      res.status(400).json({
        success: false,
        error: 'Image file too large. Maximum size is 5MB.',
      });
      return;
    }

    // Hash the filename
    const hashedFilename = hashFilename(filename, userId);
    const outputPath = path.join(AVATARS_PATH, hashedFilename);

    console.log(`📁 Encrypting and saving avatar: ${hashedFilename}`);

    // Encrypt and save the file
    const result = encryptAndSaveFile(imageBuffer, outputPath);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to save avatar',
      });
      return;
    }

    // Generate the URL for the avatar
    const avatarUrl = `/api/upload/avatar/${hashedFilename}`;

    console.log(`✅ Avatar saved successfully: ${avatarUrl}`);

    res.status(201).json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatarUrl,
        filename: hashedFilename,
      },
    });

  } catch (error) {
    console.error('❌ Avatar upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during avatar upload',
    });
  }
});

/**
 * GET /upload/avatar/:filename
 * Retrieve and decrypt an avatar image
 */
router.get('/avatar/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    if (!filename) {
      res.status(400).json({
        success: false,
        error: 'Filename is required',
      });
      return;
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(AVATARS_PATH, sanitizedFilename);

    console.log(`📁 Retrieving avatar: ${sanitizedFilename}`);

    // Decrypt and read the file
    const decryptedBuffer = readAndDecryptFile(filePath);

    if (!decryptedBuffer) {
      res.status(404).json({
        success: false,
        error: 'Avatar not found',
      });
      return;
    }

    // Get MIME type
    const contentType = getMimeType(sanitizedFilename);

    // Set cache headers (avatars can be cached)
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', decryptedBuffer.length);

    res.send(decryptedBuffer);

  } catch (error) {
    console.error('❌ Avatar retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during avatar retrieval',
    });
  }
});

/**
 * DELETE /upload/avatar/:filename
 * Delete an avatar (for user profile updates)
 */
router.delete('/avatar/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    if (!filename) {
      res.status(400).json({
        success: false,
        error: 'Filename is required',
      });
      return;
    }

    // Sanitize filename
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(AVATARS_PATH, sanitizedFilename);

    const fs = await import('fs');
    
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: 'Avatar not found',
      });
      return;
    }

    fs.unlinkSync(filePath);
    console.log(`🗑️ Avatar deleted: ${sanitizedFilename}`);

    res.status(200).json({
      success: true,
      message: 'Avatar deleted successfully',
    });

  } catch (error) {
    console.error('❌ Avatar deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during avatar deletion',
    });
  }
});

/**
 * Check if string is valid base64
 */
function isBase64(str: string): boolean {
  try {
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch {
    return false;
  }
}

export default router;

