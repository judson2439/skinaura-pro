/**
 * Product routes for managing product library
 */

import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { verifyToken } from '../lib/auth.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const router = Router();

// Ensure upload directory exists
const ensureUploadDir = () => {
  const uploadDir = path.join(process.cwd(), 'uploads/products');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
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

interface Product {
  id: string;
  professional_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
  purchase_url: string | null;
  ingredients: string[] | null;
  skin_types: string[] | null;
  concerns: string[] | null;
  is_active: boolean;
  is_global: boolean;
  created_at: string;
  updated_at: string | null;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

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

router.use(authMiddleware);

// ============================================================================
// GET /products - Fetch all products for professional
// ============================================================================

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;

    const products = await query<Product>(
      `SELECT * FROM products 
       WHERE professional_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [professionalId]
    );

    res.status(200).json({
      success: true,
      data: { products },
    } as ApiResponse);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
    } as ApiResponse);
  }
});

// ============================================================================
// POST /products - Create a new product
// ============================================================================

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const {
      name,
      brand,
      category,
      description,
      price,
      image_url,
      purchase_url,
      ingredients,
      skin_types,
      concerns,
    } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Product name is required' });
      return;
    }

    const product = await queryOne<Product>(
      `INSERT INTO products (
        professional_id, name, brand, category, description, price,
        image_url, purchase_url, ingredients, skin_types, concerns,
        is_active, is_global, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, false, NOW())
      RETURNING *`,
      [
        professionalId,
        name,
        brand || null,
        category || null,
        description || null,
        price || null,
        image_url || null,
        purchase_url || null,
        ingredients || [],
        skin_types || [],
        concerns || [],
      ]
    );

    res.status(201).json({
      success: true,
      data: { product },
    } as ApiResponse);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
    } as ApiResponse);
  }
});

// ============================================================================
// PATCH /products/:id - Update a product
// ============================================================================

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const productId = req.params.id;
    const {
      name,
      brand,
      category,
      description,
      price,
      image_url,
      purchase_url,
      ingredients,
      skin_types,
      concerns,
    } = req.body;

    const product = await queryOne<Product>(
      `UPDATE products SET
        name = COALESCE($1, name),
        brand = $2,
        category = $3,
        description = $4,
        price = $5,
        image_url = $6,
        purchase_url = $7,
        ingredients = COALESCE($8, ingredients),
        skin_types = COALESCE($9, skin_types),
        concerns = COALESCE($10, concerns),
        updated_at = NOW()
      WHERE id = $11 AND professional_id = $12
      RETURNING *`,
      [
        name,
        brand || null,
        category || null,
        description || null,
        price || null,
        image_url || null,
        purchase_url || null,
        ingredients,
        skin_types,
        concerns,
        productId,
        professionalId,
      ]
    );

    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: { product },
    } as ApiResponse);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
    } as ApiResponse);
  }
});

// ============================================================================
// DELETE /products/:id - Delete a product
// ============================================================================

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const productId = req.params.id;

    // Get the product first to check for image
    const product = await queryOne<Product>(
      `SELECT * FROM products WHERE id = $1 AND professional_id = $2`,
      [productId, professionalId]
    );

    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    // Delete from database
    await query(
      `DELETE FROM products WHERE id = $1 AND professional_id = $2`,
      [productId, professionalId]
    );

    // Delete image file if it exists and is a local file
    if (product.image_url) {
      try {
        let filename: string | undefined;
        
        // Handle new encrypted image URLs (/api/products/image/filename)
        if (product.image_url.includes('/api/products/image/')) {
          filename = product.image_url.split('/api/products/image/').pop();
        }
        // Handle old format (/uploads/products/filename)
        else if (product.image_url.includes('/uploads/products/')) {
          filename = product.image_url.split('/uploads/products/').pop();
        }
        
        if (filename) {
          const filePath = path.join(process.cwd(), 'uploads/products', filename);
          const metaPath = path.join(process.cwd(), 'uploads/products', `${filename}.meta`);
          
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          if (fs.existsSync(metaPath)) {
            fs.unlinkSync(metaPath);
          }
        }
      } catch (err) {
        console.error('Error deleting product image:', err);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    } as ApiResponse);
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
    } as ApiResponse);
  }
});

// ============================================================================
// POST /products/upload-image - Save pre-encrypted product image (no server-side encryption)
// ============================================================================

router.post('/upload-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const uploadDir = ensureUploadDir();

    // Expect encrypted data from frontend
    const { encrypted, iv, mimeType, originalName } = req.body;

    if (!encrypted || !iv) {
      res.status(400).json({ success: false, error: 'Missing encrypted data or IV' });
      return;
    }

    // Generate filename
    const filename = generateFilename(originalName);
    const filePath = path.join(uploadDir, filename);

    // Save the encrypted data as-is (JSON format for frontend to decrypt)
    const fileData = JSON.stringify({
      encrypted,
      iv,
      mimeType: mimeType || 'image/jpeg',
    });
    
    fs.writeFileSync(filePath, fileData, 'utf-8');

    // Return the image URL path
    const imageUrl = `/api/products/image/${filename}`;

    console.log(`✅ Encrypted product image saved: ${imageUrl}`);

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
// GET /products/image/:filename - Serve encrypted product image (for frontend to decrypt)
// ============================================================================

router.get('/image/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;
    const uploadDir = path.join(process.cwd(), 'uploads/products');
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
// POST /products/bulk-import - Bulk import products
// ============================================================================

router.post('/bulk-import', async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { products: productsToImport } = req.body;

    if (!Array.isArray(productsToImport) || productsToImport.length === 0) {
      res.status(400).json({ success: false, error: 'Products array is required' });
      return;
    }

    const importedProducts: Product[] = [];
    const errors: string[] = [];

    for (let i = 0; i < productsToImport.length; i++) {
      const productData = productsToImport[i];
      
      if (!productData.name) {
        errors.push(`Row ${i + 1}: Product name is required`);
        continue;
      }

      try {
        const product = await queryOne<Product>(
          `INSERT INTO products (
            professional_id, name, brand, category, description, price,
            image_url, purchase_url, ingredients, skin_types, concerns,
            is_active, is_global, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, false, NOW())
          RETURNING *`,
          [
            professionalId,
            productData.name,
            productData.brand || null,
            productData.category || null,
            productData.description || null,
            productData.price || null,
            productData.image_url || null,
            productData.purchase_url || null,
            productData.ingredients || [],
            productData.skin_types || [],
            productData.concerns || [],
          ]
        );
        
        if (product) {
          importedProducts.push(product);
        }
      } catch (err) {
        errors.push(`Row ${i + 1}: Failed to import "${productData.name}"`);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        imported: importedProducts.length,
        failed: errors.length,
        products: importedProducts,
        errors,
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Error bulk importing products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk import products',
    } as ApiResponse);
  }
});

export default router;
