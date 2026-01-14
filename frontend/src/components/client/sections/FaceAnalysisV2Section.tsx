import React, { useEffect, useRef } from 'react';

// ============================================================================
// CONSTANTS
// ============================================================================

const FACE_AGE_ID = 'sG3mv6Z0qLEuDJIHopSZ';
const ELEMENT_ID = 'FaceAge-module';
const FACE_AGE_CDN = 'https://cdn.jsdelivr.net/npm/face-age';

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

interface FaceAgeConstructor {
  new (options: Record<string, unknown>): FaceAgeInstance;
}

declare global {
  interface Window {
    FaceAge?: FaceAgeConstructor;
  }
}

// ============================================================================
// FACE ANALYSIS V2 SECTION
// ============================================================================

const FaceAnalysisV2Section: React.FC = () => {
  const faceAgeRef = useRef<FaceAgeInstance | null>(null);
  const scriptLoadedRef = useRef(false);

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

        faceAge.API.setCustomProducts([
          {
            id: 1,
            url: 'https://getfaceage.com',
            image: 'https://demo.getfaceage.com/static/products/pr5.png',
            title: 'Skin moisturizers',
            description: 'Vitamin C. Rooster 30ml', //optional
            routineGroups: {'morning': ['cleanser', 'serum']}, //optional
            problems: ['acne', 'wrinkles'], //optional
            price: 40,
            offerPrice: 18.99, //optional
          },
          {
            id: 2,
            url: 'https://getfaceage.com',
            image: 'https://demo.getfaceage.com/static/products/pr5.png',
            title: 'Skin moisturizers',
            description: 'Vitamin C. Rooster 30ml', //optional
            routineGroups: {'morning': ['cleanser', 'serum']}, //optional
            problems: ['acne', 'wrinkles'], //optional
            price: 40,
            offerPrice: 18.99, //optional
          },
          {
            id: 3,
            url: 'https://getfaceage.com',
            image: 'https://demo.getfaceage.com/static/products/pr5.png',
            title: 'Skin moisturizers',
            description: 'Vitamin C. Rooster 30ml', //optional
            routineGroups: {'morning': ['cleanser', 'serum']}, //optional
            problems: ['acne', 'wrinkles'], //optional
            price: 40,
            offerPrice: 18.99, //optional
          },  
        ]);
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
  }, []);

  return (
    <div className="space-y-6">
      <div id={ELEMENT_ID} className="w-full min-h-[700px]" />
    </div>
  );
};

export default FaceAnalysisV2Section;
