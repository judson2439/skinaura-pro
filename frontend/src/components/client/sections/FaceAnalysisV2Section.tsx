import React, { useEffect, useRef, useCallback } from 'react';
import { getAuthSession, getAuthToken } from '@/lib/authStorage';
import { decryptFileToBlob } from '@/lib/encryption';
import { apiClient } from '@/lib/apiClient';

// ============================================================================
// CONSTANTS
// ============================================================================

const FACE_AGE_ID = 'sG3mv6Z0qLEuDJIHopSZ';
const ELEMENT_ID = 'FaceAge-module';
const FACE_AGE_CDN = 'https://cdn.jsdelivr.net/npm/face-age';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// ============================================================================
// TYPES
// ============================================================================

interface FaceAgeInstance {
  render: () => void;
  onClickProblem: (callback: (key: string) => void) => void;
  onResetData: (callback: () => void) => void;
  onAddToCart: (callback: (data: unknown) => void) => void;
  onClickProduct: (callback: (product: unknown) => void) => void;
  API: {
    getAdvisorData: (callback: (data: unknown) => void) => void;
    getImage: () => string | null;
    getRoutineGroup: () => unknown;
    setCustomProducts: (products: unknown[]) => void;
  };
}

interface RecommendedProduct {
  id: string;
  professional_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  ingredients: string | null;
  skin_types: string[] | null;
  concerns: string[] | null;
  price: number | null;
  currency: string | null;
  image_url: string | null;
  purchase_url: string | null;
  is_active: boolean;
  is_global: boolean;
  usage_instructions: string | null;
  created_at: string;
  updated_at: string | null;
}

interface FaceAgeCustomProduct {
  id: string;
  url: string;
  image: string;
  title: string;
  description: string;
  problems: string[];
  price: number;
}

interface FaceAgeConstructor {
  new (options: Record<string, unknown>): FaceAgeInstance;
}

declare global {
  interface Window {
    FaceAge?: FaceAgeConstructor;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch and decrypt an image from the backend
 * Returns a data URL for the decrypted image
 */
const fetchAndDecryptImage = async (imageUrl: string, token: string | null): Promise<string> => {
  try {
    // Build full URL
    const fullUrl = imageUrl.startsWith('http') 
      ? imageUrl 
      : `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // Encrypted image - decrypt client-side
      const encryptedData = await response.json();
      
      if (!encryptedData.encrypted || !encryptedData.iv) {
        throw new Error('Invalid encrypted image data');
      }

      const decryptedBlob = await decryptFileToBlob(
        encryptedData.encrypted,
        encryptedData.iv,
        encryptedData.mimeType || 'image/jpeg'
      );

      // Convert blob to data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(decryptedBlob);
      });
    } else {
      // Legacy unencrypted image
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (error) {
    console.error('Error fetching/decrypting image:', error);
    // Return a placeholder image on error
    return 'https://via.placeholder.com/200x200?text=No+Image';
  }
};

// ============================================================================
// FACE ANALYSIS V2 SECTION
// ============================================================================

const FaceAnalysisV2Section: React.FC = () => {
  const faceAgeRef = useRef<FaceAgeInstance | null>(null);
  const scriptLoadedRef = useRef(false);

  /**
   * Fetch recommended products and set them in FaceAge
   */
  const fetchAndSetProducts = useCallback(async (faceAge: FaceAgeInstance) => {
    try {
      const authSession = getAuthSession();
      const token = authSession?.token || getAuthToken();

      if (!token) {
        console.log('No auth token, skipping product fetch');
        return;
      }

      // Fetch recommended products from backend
      apiClient.setAuthToken(token);
      const response = await apiClient.get<{
        success: boolean;
        data?: { products: RecommendedProduct[]; professional_ids: string[] };
        error?: string;
      }>('/api/client/recommended-products');

      if (!response.ok || !response.data?.success || !response.data?.data?.products?.length) {
        console.log('No recommended products found');
        return;
      }

      const products: RecommendedProduct[] = response.data.data.products;
      console.log(`Found ${products.length} recommended products`);

      // Process products and decrypt images
      const customProducts: FaceAgeCustomProduct[] = await Promise.all(
        products.map(async (product) => {
          // Decrypt image if image_url exists
          let imageDataUrl = 'https://via.placeholder.com/200x200?text=No+Image';
          
          if (product.image_url) {
            imageDataUrl = await fetchAndDecryptImage(product.image_url, token);
          }

          return {
            id: product.id,
            url: product.purchase_url || '',
            image: imageDataUrl,
            title: product.name,
            description: product.description || '',
            problems: product.concerns || [],
            price: product.price || 0,
          };
        })
      );

      // Set custom products in FaceAge
      faceAge.API.setCustomProducts(customProducts);
      console.log('✅ Custom products set in FaceAge:', customProducts.length);

    } catch (error) {
      console.error('Error fetching recommended products:', error);
    }
  }, []);

  useEffect(() => {
    // Only initialize once
    if (faceAgeRef.current || scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const initFaceAge = () => {
      if (!window.FaceAge) {
        console.error('FaceAge not loaded');
        return;
      }

      const options = {
        elementId: ELEMENT_ID,
        faceageId: FACE_AGE_ID,
        displayModel: 'section',
        language: 'en',
        currency: '$',
        quiz: true,
        showProducts: true,
        showRoutine: true,
        showAddToCart: true,
        defaultQuiz: { email: 'hi@getfaceage.com' },
        problems: [
          'fineWrinkles',
          'eyeWrinkles',
          'deepWrinkles',
          'darkCircle',
          'eyeBag',
          'pores',
          'pigment',
          'redness',
          'oiliness',
          'acne',
        ],
        routinesSupport: [
          'cleanser',
          'toner',
          'serum',
          'eyeCream',
          'spotTreatment',
          'moisturizer',
          'sunscreen',
          'faceOil',
          'nightCream',
        ],
        showCamera: true,
        showUpload: true,
      };

      try {
        const faceAge = new window.FaceAge(options);
        faceAge.render();
        faceAgeRef.current = faceAge;

        // Event listeners
        faceAge.onClickProblem((key: string) => {
          console.log('User clicked on problem:', key);
        });

        faceAge.onResetData(() => {
          console.log('User reset data');
        });

        // Get analysis data when available
        faceAge.API.getAdvisorData((data: unknown) => {
          console.log('Advisor data:', data);
        });

        // Fetch and set custom products from linked professionals
        fetchAndSetProducts(faceAge);
      } catch (error) {
        console.error('FaceAge initialization error:', error);
      }
    };

    // Check if already loaded
    if (window.FaceAge) {
      initFaceAge();
      return;
    }

    // Load script from CDN
    const script = document.createElement('script');
    script.src = FACE_AGE_CDN;
    script.async = true;
    script.onload = initFaceAge;
    script.onerror = () => console.error('Failed to load FaceAge script');
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount (optional)
      const existingScript = document.querySelector(`script[src="${FACE_AGE_CDN}"]`);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [fetchAndSetProducts]);

  return (
    <div className="space-y-6">
      <div id={ELEMENT_ID} className="w-full min-h-[700px]" />
    </div>
  );
};

export default FaceAnalysisV2Section;
