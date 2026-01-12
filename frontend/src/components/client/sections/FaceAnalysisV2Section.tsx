import React from 'react';
import ReactFaceAge from 'react-face-age';

// ============================================================================
// CONSTANTS
// ============================================================================

const FACE_AGE_ID = 'sG3mv6Z0qLEuDJIHopSZ';

// ============================================================================
// FACE ANALYSIS V2 SECTION
// ============================================================================

const FaceAnalysisV2Section: React.FC = () => {
  const options = {
    faceageId: FACE_AGE_ID,
    displayModel: 'widget',
    type: 'skincare-analyzer',
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

  return (
    <div className="space-y-6">
      <ReactFaceAge
        options={options}
        onLoad={(result) => {
          console.log('FaceAge loaded:', result);
        }}
      />
    </div>
  );
};

export default FaceAnalysisV2Section;
