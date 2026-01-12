import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Camera,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

import FaceAge from 'face-age';

// ============================================================================
// CONSTANTS
// ============================================================================


// All available skin problems for analysis
const SKIN_PROBLEMS = [
  'fineWrinkles',
  'eyeWrinkles',
  'deepWrinkles',
  'darkCircle',
  'eyeBag',
  'pores',
  'pigment',
  'redness',
  'oiliness',
  'dryness',
  'sagginess',
  'dullness',
  'acne',
] as const;

// ============================================================================
// TYPES
// ============================================================================

type WidgetState = 'idle' | 'loading' | 'active' | 'error';

interface ApiResponse {
  status: boolean;
  data?: {
    url: string;
  };
  message?: string;
}

// ============================================================================
// FACE ANALYSIS V2 SECTION
// ============================================================================

const FaceAnalysisV2Section: React.FC = () => {

  const FACE_AGE_ID = 'sG3mv6Z0qLEuDJIHopSZ';
  const options = {
    elementId: 'FaceAge-module',
  faceageId: FACE_AGE_ID,
  displayModel: 'widget',
  language: 'en',
  currency: '$',
  quiz: true,
  defaultQuiz: {email: 'hi@getfaceage.com' },
  showProducts: true,
  showRoutine: true,
  showAddToCart: true,
  problems: ['fineWrinkles', 'eyeWrinkles', 'deepWrinkles', 'darkCircle', 'eyeBag', 'pores', 'pigment', 'redness', 'oiliness', 'acne'],
  routinesSupport: ['cleanser', 'toner', 'serum'],
  showCamera: true,
  showUpload: true,
};

  const faceAge = new FaceAge(options);
  return (
    <div className="space-y-6">
      faceAge.render();
    </div>
  );
};

export default FaceAnalysisV2Section;
