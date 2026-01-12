import React, { useEffect, useRef } from 'react';
import FaceAge from 'face-age';

// ============================================================================
// CONSTANTS
// ============================================================================

const FACE_AGE_ID = 'sG3mv6Z0qLEuDJIHopSZ';
const ELEMENT_ID = 'FaceAge-module';

// ============================================================================
// FACE ANALYSIS V2 SECTION
// ============================================================================

const FaceAnalysisV2Section: React.FC = () => {
  const faceAgeRef = useRef<FaceAge | null>(null);

  useEffect(() => {
    // Only initialize once
    if (faceAgeRef.current) return;

    const options = {
      elementId: ELEMENT_ID,
      faceageId: FACE_AGE_ID,
      displayModel: 'widget' as const,
      language: 'en',
      currency: '$',
      quiz: true,
      defaultQuiz: { email: 'hi@getfaceage.com' },
      showProducts: true,
      showRoutine: true,
      showAddToCart: true,
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
      routinesSupport: ['cleanser', 'toner', 'serum'],
      showCamera: true,
      showUpload: true,
    };

    const faceAge = new FaceAge(options);
    faceAge.render();
    faceAgeRef.current = faceAge;
  }, []);

  return (
    <div className="space-y-6">
      {/* Container for FaceAge widget */}
      <div id={ELEMENT_ID} className="w-full min-h-[600px]" />
    </div>
  );
};

export default FaceAnalysisV2Section;
