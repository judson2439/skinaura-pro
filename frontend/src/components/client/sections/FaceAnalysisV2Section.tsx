import React, { useEffect, useRef, useCallback, useState } from 'react';
import { getAuthSession, getAuthToken } from '@/lib/authStorage';
import { decryptFileToBlob } from '@/lib/encryption';
import { apiClient } from '@/lib/apiClient';
import { supabase } from '@/lib/supabase';
import {
  Camera,
  Loader2,
  RefreshCw,
  Sparkles,
  Heart,
  Droplets,
  Sun,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Eye,
  Zap,
  Target,
  Info,
} from 'lucide-react';

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

// Analysis item from FaceAge API
interface AnalysisItem {
  key: string;
  title: string;
  alternativeTitle?: string;
  description: string;
  number: string; // Percentage as string (e.g., "5.22")
  format: 'Percent' | 'Number';
  orginalNumber?: string;
  colors: string;
  areacolor?: string;
  titleTr?: string;
  descriptionTr?: string;
  showInOverview?: string;
  isSVG?: string;
  isBeta?: number | string;
  point?: string;
  masks?: string;
  areas?: string;
}

// Active selections from quiz
interface ActiveSelections {
  email?: string;
  skin_concern?: string[];
  time?: string;
  allergic?: string;
  allergy_to?: string[];
  [key: string]: unknown;
}

// Full advisor data response
interface AdvisorDataResponse {
  analysis: AnalysisItem[];
  activeSelections?: ActiveSelections;
}

// Parsed skin problem for display
interface SkinProblem {
  key: string;
  title: string;
  description: string;
  value: number;
  color: string;
}

declare global {
  interface Window {
    FaceAge?: FaceAgeConstructor;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get severity color based on value (0-100, lower is better for most problems)
const getSeverityColor = (value: number): string => {
  if (value <= 10) return 'bg-green-500';
  if (value <= 25) return 'bg-green-400';
  if (value <= 50) return 'bg-yellow-400';
  if (value <= 75) return 'bg-orange-400';
  return 'bg-red-500';
};

// Get severity text
const getSeverityText = (value: number): string => {
  if (value <= 10) return 'Excellent';
  if (value <= 25) return 'Good';
  if (value <= 50) return 'Moderate';
  if (value <= 75) return 'Needs Attention';
  return 'High Concern';
};

// Calculate overall skin health score (inverse of average problem severity)
const calculateSkinHealth = (problems: SkinProblem[]): number => {
  if (problems.length === 0) return 0;
  const avgProblem = problems.reduce((sum, p) => sum + p.value, 0) / problems.length;
  return Math.round(100 - avgProblem);
};

/**
 * Upload a blob to Supabase storage and get public URL
 */
const uploadToSupabaseStorage = async (blob: Blob, productId: string): Promise<string> => {
  try {
    const ext = blob.type.split('/')[1] || 'jpg';
    const fileName = `faceage-products/${productId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('progress-photos')
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('progress-photos')
      .getPublicUrl(fileName);

    console.log(`? Image uploaded to Supabase: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    throw error;
  }
};

/**
 * Fetch, decrypt, and upload image to cloud storage
 */
const fetchDecryptAndUploadImage = async (
  imageUrl: string, 
  token: string | null,
  productId: string
): Promise<string> => {
  try {
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
    let imageBlob: Blob;

    if (contentType.includes('application/json')) {
      const encryptedData = await response.json();
      
      if (!encryptedData.encrypted || !encryptedData.iv) {
        throw new Error('Invalid encrypted image data');
      }

      imageBlob = await decryptFileToBlob(
        encryptedData.encrypted,
        encryptedData.iv,
        encryptedData.mimeType || 'image/jpeg'
      );
    } else {
      imageBlob = await response.blob();
    }

    const publicUrl = await uploadToSupabaseStorage(imageBlob, productId);
    return publicUrl;
  } catch (error) {
    console.error('Error fetching/decrypting/uploading image:', error);
    return 'https://via.placeholder.com/200x200?text=No+Image';
  }
};

// ============================================================================
// FACE ANALYSIS V2 SECTION
// ============================================================================

const FaceAnalysisV2Section: React.FC = () => {
  const faceAgeRef = useRef<FaceAgeInstance | null>(null);
  const scriptLoadedRef = useRef(false);
  const [faceAgeReady, setFaceAgeReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState<AdvisorDataResponse | null>(null);
  const [skinProblems, setSkinProblems] = useState<SkinProblem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<SkinProblem | null>(null);

  /**
   * Fetch recommended products and set them in FaceAge
   */
  const fetchAndSetProducts = useCallback(async () => {
    const faceAge = faceAgeRef.current;
    if (!faceAge) {
      console.log('FaceAge not ready, skipping product fetch');
      return;
    }

    try {
      const authSession = getAuthSession();
      const token = authSession?.token || getAuthToken();

      if (!token) {
        console.log('No auth token, skipping product fetch');
        return;
      }

      console.log('??? Fetching recommended products...');

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

      const customProducts: FaceAgeCustomProduct[] = await Promise.all(
        products.map(async (product) => {
          let imagePublicUrl = 'https://via.placeholder.com/200x200?text=No+Image';
          
          if (product.image_url) {
            imagePublicUrl = await fetchDecryptAndUploadImage(
              product.image_url, 
              token, 
              product.id
            );
          }

          return {
            id: product.id,
            url: product.purchase_url || '',
            image: imagePublicUrl,
            title: product.name,
            description: product.description || '',
            problems: product.concerns || [],
            price: product.price || 0,
          };
        })
      );

      faceAge.API.setCustomProducts(customProducts);
      console.log('? Custom products set in FaceAge:', customProducts.length);

    } catch (error) {
      console.error('Error fetching recommended products:', error);
    }
  }, []);

  // Handle reset analysis
  const handleResetAnalysis = () => {
    setAnalysisData(null);
    setSkinProblems([]);
    setSelectedProblem(null);
  };

  // Fetch products when FaceAge becomes ready
  useEffect(() => {
    if (faceAgeReady) {
      fetchAndSetProducts();
      setIsLoading(false);
    }
  }, [faceAgeReady, fetchAndSetProducts]);

  // Initialize FaceAge
  useEffect(() => {
    if (faceAgeRef.current || scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const initFaceAge = () => {
      if (!window.FaceAge) {
        console.error('FaceAge not loaded');
        setIsLoading(false);
        return;
      }

      // Check if the element exists in DOM before initializing
      const element = document.getElementById(ELEMENT_ID);
      if (!element) {
        console.log('FaceAge element not found, retrying...');
        // Retry after a short delay to wait for DOM render
        setTimeout(initFaceAge, 100);
        return;
      }

      const options = {
        elementId: ELEMENT_ID,
        faceageId: FACE_AGE_ID,
        displayModel: 'widget',
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
          // Find and select the clicked problem
          setSkinProblems(prev => {
            const problem = prev.find(p => p.key === key);
            if (problem) {
              setSelectedProblem(problem);
            }
            return prev;
          });
        });

        faceAge.onResetData(() => {
          console.log('User reset data');
          handleResetAnalysis();
        });

        // Get analysis data when available
        faceAge.API.getAdvisorData((data: unknown) => {
          console.log('Advisor data:', data);
          const advisorData = data as AdvisorDataResponse;
          setAnalysisData(advisorData);
          
          // Parse analysis items into skin problems array
          if (advisorData?.analysis && Array.isArray(advisorData.analysis)) {
            const problemsList: SkinProblem[] = advisorData.analysis
              .map((item) => ({
                key: item.key,
                title: item.title || item.titleTr || item.key,
                description: item.description || item.descriptionTr || '',
                value: parseFloat(item.number) || 0,
                color: item.colors || '#888888',
              }))
              .sort((a, b) => b.value - a.value);
            
            setSkinProblems(problemsList);
            
            // Auto-select the top concern
            if (problemsList.length > 0) {
              setSelectedProblem(problemsList[0]);
            }
          }
        });

        setFaceAgeReady(true);
        setIsLoading(false);
      } catch (error) {
        console.error('FaceAge initialization error:', error);
        setIsLoading(false);
      }
    };

    if (window.FaceAge) {
      initFaceAge();
      return;
    }

    const script = document.createElement('script');
    script.src = FACE_AGE_CDN;
    script.async = true;
    script.onload = initFaceAge;
    script.onerror = () => {
      console.error('Failed to load FaceAge script');
      setIsLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector(`script[src="${FACE_AGE_CDN}"]`);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  // Calculate derived values
  const skinHealth = skinProblems.length > 0 ? calculateSkinHealth(skinProblems) : 0;
  const areasToFocus = skinProblems.filter(p => p.value > 50).length;
  const goodAreas = skinProblems.filter(p => p.value <= 10).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">AI Skin Analysis</h2>
          <p className="text-gray-500">Get personalized insights about your skin health</p>
        </div>
        <div className="flex items-center gap-3">
          {analysisData && (
            <button
              onClick={handleResetAnalysis}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">New Analysis</span>
            </button>
          )}
        </div>
      </div>

      {/* Overview Cards - Show when analysis is complete */}
      {analysisData && skinProblems.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-[#cab0a5] to-[#b89a8e] rounded-2xl p-5 text-white">
            <Heart className="w-8 h-8 mb-3 opacity-80" />
            <p className="text-3xl font-bold">{skinHealth}%</p>
            <p className="text-white/80 text-sm">Skin Health</p>
          </div>
          <div className="bg-gradient-to-br from-[#a57865] to-[#8a6354] rounded-2xl p-5 text-white">
            <Sparkles className="w-8 h-8 mb-3 opacity-80" />
            <p className="text-3xl font-bold">{skinProblems.length}</p>
            <p className="text-white/80 text-sm">Areas Analyzed</p>
          </div>
          <div className="bg-gradient-to-br from-[#007185] to-[#005a6a] rounded-2xl p-5 text-white">
            <Target className="w-8 h-8 mb-3 opacity-80" />
            <p className="text-3xl font-bold">{areasToFocus}</p>
            <p className="text-white/80 text-sm">Areas to Focus</p>
          </div>
          <div className="bg-gradient-to-br from-[#e6d5b8] to-[#d4c4a8] rounded-2xl p-5 text-[#2D2A3E]">
            <CheckCircle className="w-8 h-8 mb-3 opacity-80" />
            <p className="text-3xl font-bold">{goodAreas}</p>
            <p className="text-[#2D2A3E]/70 text-sm">Excellent Areas</p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* FaceAge Widget Container */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#007185]" />
              <h3 className="font-serif font-bold text-lg">Face Scanner</h3>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Take a photo or upload an image to analyze your skin
            </p>
          </div>
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin" />
              </div>
            )}
            <div id={ELEMENT_ID} className="w-full min-h-[700px]" />
          </div>
        </div>

        {/* Analysis Results Section */}
        <div className="space-y-6">
          {/* Skin Problems Breakdown */}
          {analysisData && skinProblems.length > 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Eye className="w-5 h-5 text-[#007185]" />
                <h3 className="font-serif font-bold text-lg">Detailed Analysis</h3>
              </div>
              
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {skinProblems.map((problem) => (
                  <div 
                    key={problem.key} 
                    className={`space-y-2 p-3 rounded-xl cursor-pointer transition-all ${
                      selectedProblem?.key === problem.key 
                        ? 'bg-gray-50 ring-2 ring-[#007185]/20' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedProblem(problem)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: problem.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{problem.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{problem.value.toFixed(1)}%</span>
                        {problem.value <= 10 ? (
                          <TrendingDown className="w-4 h-4 text-green-500" />
                        ) : problem.value >= 50 ? (
                          <TrendingUp className="w-4 h-4 text-red-500" />
                        ) : (
                          <Zap className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${getSeverityColor(problem.value)}`}
                        style={{ width: `${Math.min(problem.value, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{getSeverityText(problem.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Eye className="w-5 h-5 text-[#007185]" />
                <h3 className="font-serif font-bold text-lg">Analysis Results</h3>
              </div>
              <div className="py-12 text-center text-gray-400">
                <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium text-gray-600">No Analysis Yet</p>
                <p className="text-sm mt-2">
                  Use the Face Scanner to analyze your skin and see detailed results here.
                </p>
              </div>
            </div>
          )}

          {/* Selected Problem Details */}
          {selectedProblem && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-[#007185]" />
                <h3 className="font-serif font-bold text-lg">About {selectedProblem.title}</h3>
              </div>
              <div className="flex items-start gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                  style={{ backgroundColor: selectedProblem.color }}
                >
                  {selectedProblem.value.toFixed(0)}%
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {selectedProblem.description}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedProblem.value <= 10 ? 'bg-green-100 text-green-700' :
                      selectedProblem.value <= 25 ? 'bg-green-50 text-green-600' :
                      selectedProblem.value <= 50 ? 'bg-yellow-100 text-yellow-700' :
                      selectedProblem.value <= 75 ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {getSeverityText(selectedProblem.value)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Concerns */}
          {analysisData && skinProblems.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <h3 className="font-serif font-bold text-lg">Top Concerns</h3>
              </div>
              <div className="space-y-3">
                {skinProblems.slice(0, 3).map((problem, idx) => (
                  <div 
                    key={problem.key} 
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      problem.value >= 50 ? 'bg-red-50 hover:bg-red-100' :
                      problem.value >= 25 ? 'bg-orange-50 hover:bg-orange-100' : 
                      'bg-yellow-50 hover:bg-yellow-100'
                    }`}
                    onClick={() => setSelectedProblem(problem)}
                  >
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white"
                      style={{ backgroundColor: problem.color }}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{problem.title}</p>
                      <p className="text-xs text-gray-500">{getSeverityText(problem.value)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{problem.value.toFixed(1)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skin Health Tips */}
          {analysisData && skinProblems.length > 0 && (
            <div className="bg-gradient-to-br from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="w-5 h-5" />
                <h3 className="font-serif font-bold text-lg">Quick Tips</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-xl p-4">
                  <Sun className="w-5 h-5 mb-2 text-white/60" />
                  <p className="text-sm font-medium">Sun Protection</p>
                  <p className="text-xs text-white/60 mt-1">Always wear SPF 30+ daily</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <Droplets className="w-5 h-5 mb-2 text-white/60" />
                  <p className="text-sm font-medium">Hydration</p>
                  <p className="text-xs text-white/60 mt-1">Drink 8 glasses of water</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <Sparkles className="w-5 h-5 mb-2 text-white/60" />
                  <p className="text-sm font-medium">Routine</p>
                  <p className="text-xs text-white/60 mt-1">Cleanse, tone, moisturize</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <Heart className="w-5 h-5 mb-2 text-white/60" />
                  <p className="text-sm font-medium">Rest</p>
                  <p className="text-xs text-white/60 mt-1">Get 7-8 hours of sleep</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceAnalysisV2Section;
