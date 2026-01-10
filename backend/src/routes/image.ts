/**
 * Generic Image Upload Routes
 * Images are encrypted on the frontend before upload.
 * Backend just stores the encrypted data as-is.
 * Frontend decrypts images when displaying them.
 */

import { Router, Request, Response } from 'express';
import { verifyToken } from '../lib/auth.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const router = Router();

// ============================================================================
// CONFIGURATION
// ============================================================================

// Valid image categories and their upload directories
const IMAGE_CATEGORIES = ['avatars', 'products', 'photos', 'treatments'] as const;
type ImageCategory = typeof IMAGE_CATEGORIES[number];

// Ensure upload directory exists for a category
const ensureUploadDir = (category: ImageCategory): string => {
  const uploadDir = path.join(process.cwd(), 'uploads', category);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

// Validate category
const isValidCategory = (category: string): category is ImageCategory => {
  return IMAGE_CATEGORIES.includes(category as ImageCategory);
};

// Generate a unique filename
const generateFilename = (originalName?: string): string => {
  const hash = crypto.randomBytes(16).toString('hex');
  const ext = originalName ? path.extname(originalName) : '.enc';
  return `enc_${hash}${ext}`;
};

// ============================================================================
// TYPES
// ============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// Encrypted image data from frontend
interface EncryptedImageData {
  encrypted: string;  // Base64 encoded encrypted image data
  iv: string;         // Base64 encoded IV
  mimeType: string;   // Original mime type
  originalName?: string;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Auth middleware
const authMiddleware = async (
  req: Request,
  res: Response,
  next: () => void
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Authorization token required' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const result = verifyToken(token);
    if (!result.valid || !result.payload) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }
    (req as any).userId = result.payload.sub as string;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

// ============================================================================
// POST /images/upload/:category - Save encrypted image (no server-side encryption)
// ============================================================================

router.post('/upload/:category', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;

    // Validate category
    if (!isValidCategory(category)) {
      res.status(400).json({ 
        success: false, 
        error: `Invalid category. Must be one of: ${IMAGE_CATEGORIES.join(', ')}` 
      });
      return;
    }

    const uploadDir = ensureUploadDir(category);

    // Expect encrypted data from frontend
    const { encrypted, iv, mimeType, originalName } = req.body as EncryptedImageData;

    if (!encrypted || !iv) {
      res.status(400).json({ success: false, error: 'Missing encrypted data or IV' });
      return;
    }

    // Generate filename
    const filename = generateFilename(originalName);
    const filePath = path.join(uploadDir, filename);

    // Save the encrypted data as-is (base64 encoded)
    // We store as JSON so frontend can easily parse iv and encrypted data
    const fileData = JSON.stringify({
      encrypted,
      iv,
      mimeType: mimeType || 'image/jpeg',
    });
    
    fs.writeFileSync(filePath, fileData, 'utf-8');

    // Return the image URL path
    const imageUrl = `/api/images/${category}/${filename}`;

    console.log(`✅ Encrypted image saved: ${imageUrl}`);

    res.status(200).json({
      success: true,
      data: { image_url: imageUrl },
    } as ApiResponse);
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload image',
    } as ApiResponse);
  }
});

// ============================================================================
// GET /images/:category/:filename - Serve encrypted image data (for frontend to decrypt)
// ============================================================================

router.get('/:category/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, filename } = req.params;

    // Validate category
    if (!isValidCategory(category)) {
      res.status(400).json({ success: false, error: 'Invalid category' });
      return;
    }

    const uploadDir = path.join(process.cwd(), 'uploads', category);
    const filePath = path.join(uploadDir, filename);

    // Security: Prevent path traversal
    if (!filePath.startsWith(uploadDir) || filename.includes('..')) {
      res.status(400).json({ success: false, error: 'Invalid filename' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Image not found' });
      return;
    }

    // Read the encrypted file data
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Return encrypted data as JSON for frontend to decrypt
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=3600',
    });

    res.send(fileContent);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve image',
    } as ApiResponse);
  }
});

// ============================================================================
// DELETE /images/:category/:filename - Delete an image
// ============================================================================

router.delete('/:category/:filename', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, filename } = req.params;

    // Validate category
    if (!isValidCategory(category)) {
      res.status(400).json({ success: false, error: 'Invalid category' });
      return;
    }

    const uploadDir = path.join(process.cwd(), 'uploads', category);
    const filePath = path.join(uploadDir, filename);

    // Security: Prevent path traversal
    if (!filePath.startsWith(uploadDir) || filename.includes('..')) {
      res.status(400).json({ success: false, error: 'Invalid filename' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Image not found' });
      return;
    }

    // Delete the file
    fs.unlinkSync(filePath);

    console.log(`🗑️ Image deleted: ${category}/${filename}`);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    } as ApiResponse);
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete image',
    } as ApiResponse);
  }
});

export default router;
