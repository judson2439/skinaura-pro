import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Camera,
  Upload,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API_CONFIG } from '@/config/api';

// ============================================================================
// CONSTANTS
// ============================================================================

const FACE_AGE_ID = 'sG3mv6Z0qLEuDJIHopSZ';
const FACE_AGE_WIDGET_BASE_URL = 'https://panel.getfaceage.com/widget/skin-analyze';

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

type SkinProblem = typeof SKIN_PROBLEMS[number];

// ============================================================================
// TYPES
// ============================================================================

interface WidgetConfig {
  showCamera: boolean;
  showUpload: boolean;
  language: string;
  currency: string;
  problems: SkinProblem[];
}

type WidgetState = 'idle' | 'loading' | 'ready' | 'analyzing' | 'complete' | 'error';

// ============================================================================
// FACE ANALYSIS V2 SECTION
// ============================================================================

const FaceAnalysisV2Section: React.FC = () => {
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [config] = useState<WidgetConfig>({
    showCamera: true,
    showUpload: true,
    language: 'en',
    currency: '$',
    problems: [...SKIN_PROBLEMS],
  });

  // Generate callback URL for receiving analysis results
  const getCallbackUrl = useCallback(() => {
    // Use the API base URL for callback
    return `${API_CONFIG.baseUrl}/api/client/face-analysis/callback`;
  }, []);

  // Build widget URL directly (avoids CORS issues with their API)
  const buildWidgetUrl = useCallback(() => {
    const params = new URLSearchParams();
    
    // Required parameters
    params.set('faceAgeId', FACE_AGE_ID);
    params.set('type', 'skincare-analyzer');
    
    // Optional parameters
    params.set('showCamera', config.showCamera.toString());
    params.set('showUpload', config.showUpload.toString());
    params.set('language', config.language);
    params.set('currency', config.currency);
    params.set('callbackUrl', getCallbackUrl());
    
    // Add problems/access parameter (comma-separated list)
    params.set('access', config.problems.join(','));
    
    return `${FACE_AGE_WIDGET_BASE_URL}?${params.toString()}`;
  }, [config, getCallbackUrl]);

  // Initialize widget
  const initializeWidget = useCallback(() => {
    setWidgetState('loading');
    setError(null);

    try {
      const url = buildWidgetUrl();
      setWidgetUrl(url);
      setWidgetState('ready');
    } catch (err) {
      console.error('Error building widget URL:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize skin analysis');
      setWidgetState('error');
    }
  }, [buildWidgetUrl]);

  // Start analysis when component mounts or user clicks start
  const handleStartAnalysis = () => {
    initializeWidget();
  };

  // Reset to initial state
  const handleReset = () => {
    setWidgetState('idle');
    setWidgetUrl(null);
    setError(null);
    setIsFullscreen(false);
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Listen for messages from iframe (if FaceAge sends postMessage)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from FaceAge domain
      if (event.origin.includes('getfaceage.com') || event.origin.includes('panel.getfaceage.com')) {
        console.log('FaceAge message received:', event.data);
        
        // Handle completion message if sent
        if (event.data?.type === 'analysis_complete' || event.data?.status === 'complete') {
          setWidgetState('complete');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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

        {widgetState !== 'idle' && (
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
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'fixed inset-4 z-50' : ''
      }`}>
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

        {/* Loading State */}
        {widgetState === 'loading' && (
          <div className="p-8">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="w-12 h-12 text-[#CFAFA3] animate-spin mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Initializing Analysis
              </h2>
              <p className="text-gray-500">
                Preparing the skin analysis widget...
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {widgetState === 'error' && (
          <div className="p-8">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Unable to Start Analysis
              </h2>
              <p className="text-gray-500 mb-6 max-w-md">
                {error || 'Something went wrong. Please try again.'}
              </p>
              <Button
                onClick={handleStartAnalysis}
                className="bg-gradient-to-r from-[#CFAFA3] to-[#E8D5D0] hover:from-[#C09A8D] hover:to-[#D9C6C1] text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Widget Ready - Show iframe */}
        {(widgetState === 'ready' || widgetState === 'analyzing' || widgetState === 'complete') && widgetUrl && (
          <div className="relative">
            {/* Fullscreen toggle */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={toggleFullscreen}
                className="bg-white/90 hover:bg-white shadow-md"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
              {isFullscreen && (
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleReset}
                  className="bg-white/90 hover:bg-white shadow-md"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* FaceAge Widget iframe */}
            <iframe
              src={widgetUrl}
              title="FaceAge Skin Analysis"
              className={`w-full border-0 ${isFullscreen ? 'h-full' : 'h-[700px]'}`}
              allow="camera; microphone"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
            />
          </div>
        )}
      </div>

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

      {/* Fullscreen backdrop */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleFullscreen}
        />
      )}
    </div>
  );
};

export default FaceAnalysisV2Section;
