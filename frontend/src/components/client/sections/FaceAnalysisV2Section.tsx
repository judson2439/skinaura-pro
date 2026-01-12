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
  const [widgetState, setWidgetState] = useState<WidgetState>('idle');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<ProductData[]>([]);
  const faceAgeRef = useRef<FaceAge | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize FaceAge when active
  useEffect(() => {
    if (widgetState === 'active' && containerRef.current) {
      // Create FaceAge instance with full options
      const options = {
        elementId: 'faceage-container',
        faceageId: FACE_AGE_ID,
        displayModel: 'section' as const, // 'widget', 'section', or 'modal'
        language: 'en',
        currency: '$',
        height: '650px',
        quiz: true,
        showProducts: true,
        showRoutine: true,
        showAddToCart: true,
        showCamera: true,
        showUpload: true,
        problems: [...SKIN_PROBLEMS] as string[],
        routinesSupport: [...ROUTINE_SUPPORT] as string[],
      };

      const faceAge = new FaceAge(options);
      faceAgeRef.current = faceAge;

      // Set up API callbacks
      faceAge.API.getAdvisorData((data: AnalysisData) => {
        console.log('Advisor data analysis:', data);
        setAnalysisData(data);
        setWidgetState('complete');

        // Get user image after analysis
        const image = faceAge.API.getImage();
        if (image) {
          setUserImage(image);
        }

        // Get active quiz selections
        faceAge.API.getActiveSelections((selections: AnalysisData) => {
          console.log('Quiz active selection data:', selections);
        });
      });

      // Set up event handlers
      faceAge.onClickProblem((key: string) => {
        console.log('User clicked on problem:', key);
      });

      faceAge.onDisplayProducts((data: ProductData[]) => {
        console.log('Display Products:', data);
      });

      faceAge.onDisplayRoutines((data: AnalysisData) => {
        console.log('Display Routines:', data);
      });

      faceAge.onAddToCart((product: ProductData) => {
        console.log('User clicked add to cart:', product);
        setSelectedProducts(prev => [...prev, product]);
      });

      faceAge.onClickProduct((product: ProductData) => {
        console.log('User clicked on product info:', product);
      });

      faceAge.onResetData(() => {
        console.log('User clicked reset data');
        setAnalysisData(null);
        setUserImage(null);
        setSelectedProducts([]);
      });

      faceAge.onCloseModal(() => {
        console.log('User closed modal');
      });

      faceAge.onCheckout((data: AnalysisData) => {
        console.log('User clicked checkout:', data);
      });

      // Render the widget
      faceAge.render();

      // Cleanup on unmount
      return () => {
        faceAgeRef.current = null;
      };
    }
  }, [widgetState]);

  // Start analysis
  const handleStartAnalysis = useCallback(() => {
    setWidgetState('active');
    setAnalysisData(null);
    setUserImage(null);
    setSelectedProducts([]);
  }, []);

  // Reset to initial state
  const handleReset = useCallback(() => {
    setWidgetState('idle');
    setAnalysisData(null);
    setUserImage(null);
    setSelectedProducts([]);
    faceAgeRef.current = null;
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
            <RotateCcw className="w-4 h-4" />
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
                  <Droplets className="w-4 h-4 text-[#CFAFA3]" />
                  <span>Skincare routines</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ShoppingCart className="w-4 h-4 text-[#CFAFA3]" />
                  <span>Product recommendations</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4 text-[#CFAFA3]" />
                  <span>Personalized quiz</span>
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

        {/* Active State - Show FaceAge Widget */}
        {(widgetState === 'active' || widgetState === 'complete') && (
          <div 
            ref={containerRef}
            id="faceage-container" 
            className="min-h-[650px] w-full"
          />
        )}
      </div>

      {/* Analysis Summary (shown after complete) */}
      {widgetState === 'complete' && analysisData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Image */}
          {userImage && (
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#CFAFA3]" />
                Your Photo
              </h3>
              <img 
                src={userImage} 
                alt="Analysis photo" 
                className="w-full max-w-xs mx-auto rounded-lg shadow-md"
              />
            </div>
          )}

          {/* Analysis Results */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-gray-900">Analysis Complete</h3>
            </div>
            <pre className="text-sm text-gray-600 bg-white/50 rounded-lg p-4 overflow-auto max-h-64">
              {JSON.stringify(analysisData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Selected Products */}
      {selectedProducts.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#CFAFA3]" />
            Products Added to Cart ({selectedProducts.length})
          </h3>
          <div className="space-y-3">
            {selectedProducts.map((product, index) => (
              <div 
                key={`${product.id}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium">{product.title}</span>
                <span className="text-[#CFAFA3] font-semibold">${product.price}</span>
              </div>
            ))}
          </div>
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
