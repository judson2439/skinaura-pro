import React, { useState, useCallback } from 'react';
import ReactFaceAge from 'react-face-age';
import {
  Sparkles,
  Camera,
  Upload,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// CONSTANTS
// ============================================================================

const FACE_AGE_ID = 'sG3mv6Z0qLEuDJIHopSZ';

// ============================================================================
// TYPES
// ============================================================================

interface FaceAgeOptions {
  faceageId: string;
  type: string;
}

interface FaceAgeResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

type WidgetState = 'idle' | 'active';

// ============================================================================
// FACE ANALYSIS V2 SECTION
// ============================================================================

const FaceAnalysisV2Section: React.FC = () => {
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [analysisResult, setAnalysisResult] = useState<FaceAgeResult | null>(null);

  // FaceAge options
  const options: FaceAgeOptions = {
    faceageId: FACE_AGE_ID,
    type: 'skincare-analyzer',
  };

  // Handle FaceAge onLoad callback
  const handleLoad = useCallback((result: FaceAgeResult) => {
    console.log('FaceAge result:', result);
    setAnalysisResult(result);
  }, []);

  // Start analysis
  const handleStartAnalysis = () => {
    setWidgetState('active');
    setAnalysisResult(null);
  };

  // Reset to initial state
  const handleReset = () => {
    setWidgetState('idle');
    setAnalysisResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-gray-900">
              Face Analysis v2
            </h1>
            <p className="text-gray-500">
              Powered by FaceAge AI Technology
            </p>
          </div>
        </div>

        {widgetState === 'active' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Start Over
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Idle State - Start Screen */}
        {widgetState === 'idle' && (
          <div className="p-8">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#CFAFA3]/20 to-[#E8D5D0]/20 flex items-center justify-center mb-6">
                <Sparkles className="w-12 h-12 text-[#CFAFA3]" />
              </div>
              
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                Advanced Skin Analysis
              </h2>
              <p className="text-gray-500 max-w-md mb-8">
                Get a comprehensive analysis of your skin using AI technology. 
                We'll analyze 13 different skin metrics including wrinkles, dark circles, 
                pores, pigmentation, and more.
              </p>

              {/* Features List */}
              <div className="grid grid-cols-2 gap-4 mb-8 max-w-lg">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Camera className="w-4 h-4 text-[#CFAFA3]" />
                  <span>Live camera capture</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Upload className="w-4 h-4 text-[#CFAFA3]" />
                  <span>Photo upload option</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-[#CFAFA3]" />
                  <span>13 skin metrics</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Sparkles className="w-4 h-4 text-[#CFAFA3]" />
                  <span>AI-powered accuracy</span>
                </div>
              </div>

              <Button
                onClick={handleStartAnalysis}
                className="bg-gradient-to-r from-[#CFAFA3] to-[#E8D5D0] hover:from-[#C09A8D] hover:to-[#D9C6C1] text-white px-8 py-6 text-lg rounded-xl shadow-lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Start Skin Analysis
              </Button>
            </div>
          </div>
        )}

        {/* Active State - Show ReactFaceAge Component */}
        {widgetState === 'active' && (
          <div className="min-h-[700px]">
            <ReactFaceAge
              options={options}
              onLoad={handleLoad}
            />
          </div>
        )}
      </div>

      {/* Analysis Result (if available) */}
      {analysisResult && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Analysis Complete</h3>
          </div>
          <pre className="text-sm text-gray-600 bg-white/50 rounded-lg p-4 overflow-auto max-h-64">
            {JSON.stringify(analysisResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Info Card */}
      {widgetState === 'idle' && (
        <div className="bg-gradient-to-r from-[#CFAFA3]/10 to-[#E8D5D0]/10 rounded-xl p-6 border border-[#CFAFA3]/20">
          <h3 className="font-semibold text-gray-900 mb-2">What we analyze:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              'Fine Wrinkles',
              'Eye Wrinkles',
              'Deep Wrinkles',
              'Dark Circles',
              'Eye Bags',
              'Pores',
              'Pigmentation',
              'Redness',
              'Oiliness',
              'Dryness',
              'Sagginess',
              'Dullness',
              'Acne',
            ].map((metric) => (
              <div
                key={metric}
                className="flex items-center gap-2 text-sm text-gray-600"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#CFAFA3]" />
                {metric}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceAnalysisV2Section;
