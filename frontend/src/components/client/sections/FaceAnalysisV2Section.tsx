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
  CircleDot,
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

// ============================================================================
// RADAR CHART COMPONENT
// ============================================================================

interface RadarChartProps {
  data: SkinProblem[];
  size?: number;
  onSelectProblem?: (problem: SkinProblem) => void;
  selectedProblem?: SkinProblem | null;
}

const RadarChart: React.FC<RadarChartProps> = ({ 
  data, 
  size = 320, 
  onSelectProblem,
  selectedProblem 
}) => {
  if (data.length === 0) return null;

  const labelPadding = 90;
  const totalWidth = size + (labelPadding * 2);
  const totalHeight = size + (labelPadding * 2);

  const centerX = totalWidth / 2;
  const centerY = totalHeight / 2;
  const radius = (size / 2) - 20;
  const levels = 5;
  const angleStep = (2 * Math.PI) / data.length;

  const getPoint = (index: number, value: number) => {
    const angle = (index * angleStep) - (Math.PI / 2);
    const r = (value / 100) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  // Grid lines (pentagon/polygon shapes)
  const gridLines = [];
  for (let level = 1; level <= levels; level++) {
    const levelRadius = (level / levels) * radius;
    const points = data.map((_, index) => {
      const angle = (index * angleStep) - (Math.PI / 2);
      return `${centerX + levelRadius * Math.cos(angle)},${centerY + levelRadius * Math.sin(angle)}`;
    }).join(' ');
    gridLines.push(
      <polygon
        key={`grid-${level}`}
        points={points}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="1"
      />
    );
  }

  // Axis lines from center to each vertex
  const axisLines = data.map((_, index) => {
    const angle = (index * angleStep) - (Math.PI / 2);
    const endX = centerX + radius * Math.cos(angle);
    const endY = centerY + radius * Math.sin(angle);
    return (
      <line
        key={`axis-${index}`}
        x1={centerX}
        y1={centerY}
        x2={endX}
        y2={endY}
        stroke="#e5e7eb"
        strokeWidth="1"
      />
    );
  });

  // Data polygon points
  const dataPoints = data.map((problem, index) => {
    const point = getPoint(index, problem.value);
    return `${point.x},${point.y}`;
  }).join(' ');

  // Labels around the chart
  const labels = data.map((problem, index) => {
    const angle = (index * angleStep) - (Math.PI / 2);
    const labelRadius = radius + 35;
    const x = centerX + labelRadius * Math.cos(angle);
    const y = centerY + labelRadius * Math.sin(angle);

    let textAnchor: 'start' | 'middle' | 'end' = 'middle';
    if (x < centerX - 10) textAnchor = 'end';
    else if (x > centerX + 10) textAnchor = 'start';

    const isSelected = selectedProblem?.key === problem.key;

    return (
      <g key={`label-${index}`}>
        <text
          x={x}
          y={y - 8}
          textAnchor={textAnchor}
          dominantBaseline="middle"
          className={`text-[10px] font-medium cursor-pointer transition-all ${
            isSelected ? 'fill-[#007185]' : 'fill-gray-600'
          }`}
          onClick={() => onSelectProblem?.(problem)}
        >
          {problem.title}
        </text>
        <text
          x={x}
          y={y + 6}
          textAnchor={textAnchor}
          dominantBaseline="middle"
          className={`text-[9px] font-bold ${
            problem.value <= 10 ? 'fill-green-500' :
            problem.value <= 25 ? 'fill-green-400' :
            problem.value <= 50 ? 'fill-yellow-500' :
            problem.value <= 75 ? 'fill-orange-500' : 'fill-red-500'
          }`}
        >
          {problem.value.toFixed(1)}%
        </text>
      </g>
    );
  });

  // Dots at each data point
  const dots = data.map((problem, index) => {
    const point = getPoint(index, problem.value);
    const isSelected = selectedProblem?.key === problem.key;
    return (
      <circle
        key={`dot-${index}`}
        cx={point.x}
        cy={point.y}
        r={isSelected ? 7 : 5}
        fill={problem.color}
        stroke="#fff"
        strokeWidth="2"
        className="cursor-pointer transition-all"
        onClick={() => onSelectProblem?.(problem)}
      />
    );
  });

  return (
    <div className="flex justify-center w-full overflow-hidden">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="max-w-full"
        style={{ minWidth: '280px' }}
      >
        {/* Grid */}
        {gridLines}
        {axisLines}

        {/* Data area */}
        <polygon
          points={dataPoints}
          fill="rgba(0, 113, 133, 0.2)"
          stroke="#007185"
          strokeWidth="2"
        />

        {/* Data points */}
        {dots}

        {/* Labels */}
        {labels}

        {/* Center circle */}
        <circle
          cx={centerX}
          cy={centerY}
          r="4"
          fill="#007185"
        />
      </svg>
    </div>
  );
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
        height: '550px',
        width: '100%',
        margin: '0 auto',
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
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CircleDot className="w-4 h-4 text-[#CFAFA3]" />
              <span className="text-xs font-semibold text-[#CFAFA3] uppercase tracking-wider">
                AI Analysis
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2">
              SkinAura AI Facial Scanner
            </h2>
            <p className="text-gray-300 text-sm md:text-base">
              Advanced AI-powered analysis to evaluate your skin health and track skincare progress
            </p>
          </div>
          <div className="flex items-center gap-3">
            {faceAgeReady && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-400">AI Ready</span>
              </div>
            )}
            {analysisData && (
              <button
                onClick={handleResetAnalysis}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-colors text-white"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm font-medium">New Analysis</span>
              </button>
            )}
          </div>
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
          <div className="relative max-h-[700px]">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin" />
              </div>
            )}
            <div id={ELEMENT_ID} className="w-full h-full" />
          </div>
        </div>

        {/* Analysis Results Section */}
        <div className="space-y-6">
          {/* Radar Chart Section */}
          {analysisData && skinProblems.length > 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#007185]" />
                  <h3 className="font-serif font-bold text-lg">Skin Analysis Chart</h3>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {skinProblems.length} areas analyzed
                </span>
              </div>
              
              {/* Radar Chart */}
              <RadarChart 
                data={skinProblems} 
                size={300}
                onSelectProblem={setSelectedProblem}
                selectedProblem={selectedProblem}
              />
              <p className="text-xs text-gray-500 text-center mt-2">
                Click on any area to see details. Higher values indicate areas that may need attention.
              </p>
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

          {/* Skin Problems List */}
          {analysisData && skinProblems.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-[#007185]" />
                <h3 className="font-serif font-bold text-lg">Detailed Breakdown</h3>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {skinProblems.map((problem) => (
                  <div 
                    key={problem.key} 
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      selectedProblem?.key === problem.key 
                        ? 'bg-[#007185]/5 ring-2 ring-[#007185]/20' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedProblem(problem)}
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: problem.color }}
                    >
                      {problem.value.toFixed(0)}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800 truncate">{problem.title}</span>
                        {problem.value <= 10 ? (
                          <TrendingDown className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : problem.value >= 50 ? (
                          <TrendingUp className="w-4 h-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${getSeverityColor(problem.value)}`}
                          style={{ width: `${Math.min(problem.value, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
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
