/**
 * AI Routes - Product Recognition and other AI-powered features
 */

import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';

const router = Router();

// Must match frontend PRODUCT_CATEGORIES in productLibraryTypes.ts
const PRODUCT_CATEGORIES = [
  'Cleanser',
  'Toner',
  'Serum',
  'Moisturizer',
  'Sunscreen',
  'Treatment',
  'Eye Cream',  
  'Mask',
  'Oil',
  'Exfoliant',
  'Essence',
  'Mist',
  'Lip Care',
  'Body Care',
];

// Must match frontend SKIN_TYPES in productLibraryTypes.ts
const SKIN_TYPES = [
  'Normal',
  'Dry',
  'Oily',
  'Combination',
  'Sensitive',
  'Acne-Prone',
  'Mature',
  'All Skin Types',
];

// ============================================================================
// POST /ai/product-recognition - AI Product Recognition from Image
// ============================================================================

router.post('/product-recognition', async (req: Request, res: Response): Promise<void> => {
  try {

    console.log('🔐 Product recognition request:', req.body);
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      res.status(400).json({ 
        success: false, 
        error: 'Image data is required' 
      });
      return;
    }

    const gatewayApiKey = env.GATEWAY_API_KEY;
    if (!gatewayApiKey) {
      console.error('GATEWAY_API_KEY not configured');
      res.status(500).json({ 
        success: false, 
        error: 'AI service is not configured' 
      });
      return;
    }

    // Clean up the base64 string if it includes the data URL prefix
    let cleanBase64 = imageBase64;
    if (typeof imageBase64 === 'string' && imageBase64.includes(',')) {
      cleanBase64 = imageBase64.split(',')[1];
    }

    const prompt = `You are a skincare product recognition expert. Analyze this product image and extract the following information. Be as accurate as possible based on what you can see on the product packaging, label, or bottle.

Return ONLY a valid JSON object with these fields:
{
  "name": "The product name as shown on the packaging",
  "brand": "The brand name",
  "category": "One of these exact categories: ${PRODUCT_CATEGORIES.join(', ')}",
  "description": "A brief description of what the product does based on visible information",
  "ingredients": ["Array of key ingredients if visible on the packaging"],
  "skinTypes": ["Array of suitable skin types from this list: ${SKIN_TYPES.join(', ')}. Include ALL applicable types. If the product is suitable for most skin types, include 'All Skin Types'."],
  "usageInstructions": "Usage instructions if visible on the packaging. If not visible, provide general usage instructions based on the product type and category (e.g., 'Apply a small amount to clean, dry skin morning and evening').",
  "confidence": "high, medium, or low - how confident you are in the identification"
}

IMPORTANT:
- Always include at least one skin type in skinTypes array. If uncertain, use ["All Skin Types"].
- Always provide usageInstructions based on the product type.
- If you cannot identify certain fields, use empty string for text fields or empty array for arrays.
- Always provide your best guess for name, brand, and category based on the packaging design, colors, and any visible text.`;

    // Call AI Gateway with GPT-4.1-mini for vision capabilities
    const response = await fetch('https://ai.gateway.fastrouter.io/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': gatewayApiKey,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${cleanBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      res.status(500).json({ 
        success: false, 
        error: 'AI service error' 
      });
      return;
    }

    const data = await response.json();

    // Parse the AI response
    const content = (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? '{}';

    let productInfo: any;
    try {
      productInfo = JSON.parse(content);
      console.log('✅ Parsed AI product info:', JSON.stringify(productInfo, null, 2));
      console.log('  - skinTypes:', productInfo.skinTypes);
      console.log('  - usageInstructions:', productInfo.usageInstructions);
      
      // Ensure arrays are actually arrays
      if (!Array.isArray(productInfo.skinTypes)) {
        productInfo.skinTypes = productInfo.skinTypes ? [productInfo.skinTypes] : [];
      }
      if (!Array.isArray(productInfo.ingredients)) {
        productInfo.ingredients = productInfo.ingredients ? [productInfo.ingredients] : [];
      }
      
      // Validate skin types against allowed values
      if (productInfo.skinTypes && productInfo.skinTypes.length > 0) {
        productInfo.skinTypes = productInfo.skinTypes.filter((type: string) => 
          SKIN_TYPES.some(st => st.toLowerCase() === type.toLowerCase())
        ).map((type: string) => 
          SKIN_TYPES.find(st => st.toLowerCase() === type.toLowerCase()) || type
        );
      }
      
      // Default to All Skin Types if empty
      if (!productInfo.skinTypes || productInfo.skinTypes.length === 0) {
        productInfo.skinTypes = ['All Skin Types'];
      }
      
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      productInfo = {
        name: '',
        brand: '',
        category: '',
        description: '',
        ingredients: [],
        skinTypes: ['All Skin Types'],
        usageInstructions: '',
        confidence: 'low',
        rawResponse: content,
      };
    }

    // Validate and normalize the category
    if (productInfo.category && !PRODUCT_CATEGORIES.includes(productInfo.category)) {
      const lowerCategory = String(productInfo.category).toLowerCase();
      const matchedCategory = PRODUCT_CATEGORIES.find(
        (cat) =>
          cat.toLowerCase().includes(lowerCategory) ||
          lowerCategory.includes(cat.toLowerCase())
      );
      productInfo.category = matchedCategory || 'Other';
    }

    res.status(200).json({
      success: true,
      product: productInfo,
    });
  } catch (error: any) {
    console.error('Product recognition error:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to analyze product image',
    });
  }
});

export default router;
