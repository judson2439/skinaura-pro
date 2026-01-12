import React, { useState, useEffect, useRef, useCallback } from 'react';
import FaceAge from 'face-age';
import {
  Sparkles,
  Camera,
  Upload,
  RefreshCw,
  CheckCircle2,
  ShoppingCart,
  RotateCcw,
  User,
  Droplets,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactFaceAge from 'react-face-age';

// ============================================================================
// CONSTANTS
// ============================================================================

const FACE_AGE_ID = 'sG3mv6Z0qLEuDJIHopSZ';

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

// Routine categories
const ROUTINE_SUPPORT = [
  'cleanser',
  'toner',
  'serum',
  'eyeCream',
  'spotTreatment',
  'moisturizer',
  'sunscreen',
  'faceOil',
  'nightCream',
] as const;

// ============================================================================
// TYPES
// ============================================================================

interface AnalysisData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface ProductData {
  id: number;
  title: string;
  price: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

type WidgetState = 'idle' | 'active' | 'complete';

// ============================================================================
// FACE ANALYSIS V2 SECTION
// ============================================================================

const FaceAnalysisV2Section: React.FC = () => {
  
  return (
    <div className="space-y-6">
      <ReactFaceAge options={{ faceageId: FACE_AGE_ID }} />
    </div>
  );
};

export default FaceAnalysisV2Section;
