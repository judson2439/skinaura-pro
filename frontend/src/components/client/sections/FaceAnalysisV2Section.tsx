import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Camera,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// CONSTANTS
// ============================================================================

const FACE_AGE_ID = 'sG3mv6Z0qLEuDJIHopSZ';
const CALLBACK_URL = 'https://emqiscdnvmjjrqapccib.supabase.co/functions/v1/analyze-face-callback';
const SKIN_ANALYZE_API = 'https://core.getfaceage.com/api/v1/widget/skin-analyze/set-parameters';

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
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches the skin analyze widget URL from FaceAge API
   */
  const fetchWidgetUrl = useCallback(async () => {
    setWidgetState('loading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('callbackUrl', CALLBACK_URL);
      formData.append('faceAgeId', FACE_AGE_ID);
      formData.append('showCamera', 'true');
      formData.append('showUpload', 'true');
      formData.append('language', 'en');
      formData.append('currency', '$');
      formData.append('gtag', '');

      // Add all skin problems
      SKIN_PROBLEMS.forEach((problem, index) => {
        formData.append(`problems[${index}]`, problem);
      });

      const response = await fetch(SKIN_ANALYZE_API, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data: ApiResponse = await response.json();

      if (data.status && data.data?.url) {
        setWidgetUrl(data.data.url);
        setWidgetState('active');
      } else {
        throw new Error(data.message || 'Failed to get widget URL');
      }
    } catch (err) {
      console.error('FaceAge API error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setWidgetState('error');
    }
  }, []);

  /**
   * Reset to initial state
   */
  const handleReset = useCallback(() => {
    setWidgetState('idle');
    setWidgetUrl(null);
    setError(null);
  }, []);

  // Auto-load widget on mount (optional - remove if you want manual trigger)
  useEffect(() => {
    fetchWidgetUrl();
  }, [fetchWidgetUrl]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">AI Skin Analysis</h2>
        </div>
        <p className="text-muted-foreground">
          Analyze your skin with our advanced AI technology
        </p>
      </div>

      {/* Idle State - Start Button */}
      {widgetState === 'idle' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Camera className="w-16 h-16 text-muted-foreground" />
          <p className="text-muted-foreground text-center max-w-md">
            Take a photo or upload an image to get personalized skin analysis
            and product recommendations.
          </p>
          <Button onClick={fetchWidgetUrl} size="lg" className="gap-2">
            <Camera className="w-5 h-5" />
            Start Analysis
          </Button>
        </div>
      )}

      {/* Loading State */}
      {widgetState === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground">Initializing skin analyzer...</p>
        </div>
      )}

      {/* Error State */}
      {widgetState === 'error' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <p className="text-destructive text-center max-w-md">{error}</p>
          <Button onClick={fetchWidgetUrl} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        </div>
      )}

      {/* Active State - Widget Iframe */}
      {widgetState === 'active' && widgetUrl && (
        <div className="space-y-4">
          <div className="relative w-full rounded-lg overflow-hidden border bg-background shadow-sm">
            <iframe
              src={widgetUrl}
              title="FaceAge Skin Analyzer"
              className="w-full min-h-[700px] border-0"
              allow="camera; microphone"
              allowFullScreen
            />
          </div>
          <div className="flex justify-center">
            <Button onClick={handleReset} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Start New Analysis
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaceAnalysisV2Section;
