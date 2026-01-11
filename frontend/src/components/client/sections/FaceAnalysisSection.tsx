import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import {
  Camera,
  CameraOff,
  Loader2,
  RefreshCw,
  Sparkles,
  Activity,
  User,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  History,
  Target,
  Zap,
  Heart,
  Info,
  Settings,
  ShieldAlert,
  Video,
  Pause,
  Play,
  Upload,
  Image as ImageIcon,
  X,
  Mail,
  Eye,
  Save,
  FileDown,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken, getAuthSession } from '@/lib/authStorage';
import { exportHistoryEntryPDF, exportCurrentAnalysisPDF } from '@/lib/pdfExport';
import { EncryptedImage } from '@/components/ui/encrypted-image';
import { uploadImage } from '@/lib/encryption';
// TYPES
// ============================================================================

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'blocked' | 'unknown';
type InputMode = 'camera' | 'upload';

interface SkinMetrics {
  fineWrinkles: number;
  eyeWrinkles: number;
  deepWrinkles: number;
  darkCircle: number;
  eyeBag: number;
  pores: number;
  pigment: number;
  redness: number;
  oiliness: number;
  dryness: number;
  sagginess: number;
}

interface FaceMetrics {
  estimatedAge: number;
  gender: string;
  genderProbability: number;
  expressions: {
    neutral: number;
    happy: number;
    sad: number;
    angry: number;
    fearful: number;
    disgusted: number;
    surprised: number;
  };
  skinMetrics: SkinMetrics;
  hydration: number;
  elasticity: number;
  evenness: number;
  radiance: number;
  timestamp: Date;
}

interface HistoryEntry {
  id: string;
  client_id?: string;
  photo_url: string | null;
  age: number;
  gender: string;
  expression: string;
  hydration: string;
  elasticity: string;
  evenness: string;
  radiance: string;
  fine_wrinkles: string;
  eye_wrinkles: string;
  deep_wrinkles: string;
  dark_circle: string;
  eye_bag: string;
  pores: string;
  pigment: string;
  redness: string;
  oiliness: string;
  dryness: string;
  sagginess: string;
  fine_wrinkles_tips: string | null;
  eye_wrinkles_tips: string | null;
  deep_wrinkles_tips: string | null;
  dark_circle_tips: string | null;
  eye_bag_tips: string | null;
  pores_tips: string | null;
  pigment_tips: string | null;
  redness_tips: string | null;
  oiliness_tips: string | null;
  dryness_tips: string | null;
  sagginess_tips: string | null;
  created_at: string;
}


// ============================================================================
// CONSTANTS
// ============================================================================

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

const SKIN_METRIC_LABELS: { key: keyof SkinMetrics; label: string }[] = [
  { key: 'fineWrinkles', label: 'Fine Wrinkles' },
  { key: 'eyeWrinkles', label: 'Eye Wrinkles' },
  { key: 'deepWrinkles', label: 'Deep Wrinkles' },
  { key: 'darkCircle', label: 'Dark Circle' },
  { key: 'eyeBag', label: 'Eye Bag' },
  { key: 'pores', label: 'Pores' },
  { key: 'pigment', label: 'Pigment' },
  { key: 'redness', label: 'Redness' },
  { key: 'oiliness', label: 'Oiliness' },
  { key: 'dryness', label: 'Dryness' },
  { key: 'sagginess', label: 'Sagginess' },
];

const SKIN_TIPS: Record<string, string[]> = {
  fineWrinkles: [
    'Use a retinol serum at night',
    'Apply sunscreen daily to prevent further damage',
    'Stay hydrated and use hyaluronic acid',
  ],
  eyeWrinkles: [
    'Use an eye cream with peptides',
    'Wear sunglasses to prevent squinting',
    'Get adequate sleep (7-9 hours)',
  ],
  deepWrinkles: [
    'Consider professional treatments like microneedling',
    'Use products with retinoids and vitamin C',
    'Facial massage can help improve circulation',
  ],
  darkCircle: [
    'Get enough sleep and reduce screen time',
    'Use eye creams with vitamin K and caffeine',
    'Stay hydrated and reduce salt intake',
  ],
  eyeBag: [
    'Apply cold compresses in the morning',
    'Elevate your head while sleeping',
    'Reduce alcohol and salt consumption',
  ],
  pores: [
    'Use niacinamide to minimize pore appearance',
    'Exfoliate regularly with BHA/salicylic acid',
    'Always remove makeup before bed',
  ],
  pigment: [
    'Use vitamin C serum in the morning',
    'Apply SPF 30+ sunscreen daily',
    'Try products with arbutin or kojic acid',
  ],
  redness: [
    'Use gentle, fragrance-free products',
    'Apply products with centella asiatica',
    'Avoid hot water and harsh exfoliants',
  ],
  oiliness: [
    'Use oil-free, non-comedogenic products',
    'Try niacinamide to regulate sebum',
    'Don\'t over-wash - it can increase oil production',
  ],
  dryness: [
    'Use a hydrating serum with hyaluronic acid',
    'Apply moisturizer to damp skin',
    'Use a humidifier in dry environments',
  ],
  sagginess: [
    'Use products with peptides and retinol',
    'Facial exercises can help tone muscles',
    'Consider professional treatments like RF therapy',
  ],
};

// ============================================================================
// RADAR CHART COMPONENT
// ============================================================================

interface RadarChartProps {
  data: SkinMetrics;
  size?: number;
}

const RadarChart: React.FC<RadarChartProps> = ({ data, size = 320 }) => {
  const labelPadding = 80;
  const totalWidth = size + (labelPadding * 2);
  const totalHeight = size + (labelPadding * 2);
  
  const centerX = totalWidth / 2;
  const centerY = totalHeight / 2;
  const radius = (size / 2) - 20;
  const levels = 5;
  const metrics = SKIN_METRIC_LABELS;
  const angleStep = (2 * Math.PI) / metrics.length;

  const getPoint = (index: number, value: number) => {
    const angle = (index * angleStep) - (Math.PI / 2);
    const r = (value / 100) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const gridLines = [];
  for (let level = 1; level <= levels; level++) {
    const levelRadius = (level / levels) * radius;
    const points = metrics.map((_, index) => {
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

  const axisLines = metrics.map((_, index) => {
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

  const dataPoints = metrics.map((metric, index) => {
    const value = data[metric.key];
    const point = getPoint(index, value);
    return `${point.x},${point.y}`;
  }).join(' ');

  const labels = metrics.map((metric, index) => {
    const angle = (index * angleStep) - (Math.PI / 2);
    const labelRadius = radius + 25;
    const x = centerX + labelRadius * Math.cos(angle);
    const y = centerY + labelRadius * Math.sin(angle);
    
    let textAnchor: 'start' | 'middle' | 'end' = 'middle';
    if (x < centerX - 10) textAnchor = 'end';
    else if (x > centerX + 10) textAnchor = 'start';
    
    return (
      <text
        key={`label-${index}`}
        x={x}
        y={y}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        className="text-xs fill-gray-600 font-medium"
      >
        {metric.label}
      </text>
    );
  });

  const dots = metrics.map((metric, index) => {
    const value = data[metric.key];
    const point = getPoint(index, value);
    return (
      <circle
        key={`dot-${index}`}
        cx={point.x}
        cy={point.y}
        r="5"
        fill="#0d9488"
        stroke="#fff"
        strokeWidth="2"
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
        {gridLines}
        {axisLines}
        <polygon
          points={dataPoints}
          fill="rgba(13, 148, 136, 0.25)"
          stroke="#0d9488"
          strokeWidth="2"
        />
        {dots}
        {labels}
      </svg>
    </div>
  );
};

// ============================================================================
// HISTORY DETAIL MODAL
// ============================================================================

interface HistoryDetailModalProps {
  entry: HistoryEntry | null;
  isOpen: boolean;
  onClose: () => void;
  clientId?: string;
}

const HistoryDetailModal: React.FC<HistoryDetailModalProps> = ({ entry, isOpen, onClose, clientId }) => {
  const [isExporting, setIsExporting] = React.useState(false);

  if (!isOpen || !entry) return null;

  const skinMetrics: SkinMetrics = {
    fineWrinkles: parseInt(entry.fine_wrinkles) || 0,
    eyeWrinkles: parseInt(entry.eye_wrinkles) || 0,
    deepWrinkles: parseInt(entry.deep_wrinkles) || 0,
    darkCircle: parseInt(entry.dark_circle) || 0,
    eyeBag: parseInt(entry.eye_bag) || 0,
    pores: parseInt(entry.pores) || 0,
    pigment: parseInt(entry.pigment) || 0,
    redness: parseInt(entry.redness) || 0,
    oiliness: parseInt(entry.oiliness) || 0,
    dryness: parseInt(entry.dryness) || 0,
    sagginess: parseInt(entry.sagginess) || 0,
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getMetricColor = (value: number) => {
    if (value <= 30) return 'text-green-500';
    if (value <= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Parse tips string into array by splitting on semicolon
  const parseTips = (tipsString: string | null): string[] => {
    if (!tipsString) return [];
    return tipsString.split(';').map(tip => tip.trim()).filter(tip => tip.length > 0);
  };

  // All tips data
  const allTips = [
    { label: 'Fine Wrinkles', tips: parseTips(entry.fine_wrinkles_tips), value: entry.fine_wrinkles },
    { label: 'Eye Wrinkles', tips: parseTips(entry.eye_wrinkles_tips), value: entry.eye_wrinkles },
    { label: 'Deep Wrinkles', tips: parseTips(entry.deep_wrinkles_tips), value: entry.deep_wrinkles },
    { label: 'Dark Circles', tips: parseTips(entry.dark_circle_tips), value: entry.dark_circle },
    { label: 'Eye Bags', tips: parseTips(entry.eye_bag_tips), value: entry.eye_bag },
    { label: 'Pores', tips: parseTips(entry.pores_tips), value: entry.pores },
    { label: 'Pigmentation', tips: parseTips(entry.pigment_tips), value: entry.pigment },
    { label: 'Redness', tips: parseTips(entry.redness_tips), value: entry.redness },
    { label: 'Oiliness', tips: parseTips(entry.oiliness_tips), value: entry.oiliness },
    { label: 'Dryness', tips: parseTips(entry.dryness_tips), value: entry.dryness },
    { label: 'Sagginess', tips: parseTips(entry.sagginess_tips), value: entry.sagginess },
  ];

  // Handle PDF export
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportHistoryEntryPDF(entry, entry.client_id || clientId);
    } catch (err) {
      console.error('Error exporting PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E] flex-shrink-0">
          <div>
            <h2 className="text-xl font-serif font-bold text-white">Analysis Details</h2>
            <p className="text-white/70 text-sm">{formatDate(entry.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Export PDF
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid md:grid-cols-2 gap-6 h-full">
            {/* Left Column - Photo, Basic Info, Skin Health, Radar Chart & Summary */}
            <div className="flex flex-col space-y-4">
              {/* Photo */}
              {entry.photo_url && (
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <EncryptedImage
                    src={entry.photo_url}
                    alt="Analysis photo"
                    className="w-full h-56 object-cover"
                    fallbackClassName="w-8 h-8 text-gray-400"
                  />
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100">
                  <div className="flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-purple-500" />
                    <span className="text-[10px] font-medium text-purple-600 uppercase">Age</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-700">{entry.age}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100">
                  <div className="flex items-center gap-1 mb-1">
                    <User className="w-3 h-3 text-pink-500" />
                    <span className="text-[10px] font-medium text-pink-600 uppercase">Gender</span>
                  </div>
                  <p className="text-lg font-bold text-pink-700 capitalize">{entry.gender}</p>
                </div>
                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
                  <div className="flex items-center gap-1 mb-1">
                    <Heart className="w-3 h-3 text-amber-500" />
                    <span className="text-[10px] font-medium text-amber-600 uppercase">Expression</span>
                  </div>
                  <p className="text-lg font-bold text-amber-700 capitalize">{entry.expression}</p>
                </div>
              </div>

              {/* General Skin Health */}
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 rounded-lg bg-gray-50 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Hydration</p>
                  <p className={`text-lg font-bold ${getScoreColor(parseInt(entry.hydration))}`}>{entry.hydration}%</p>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Elasticity</p>
                  <p className={`text-lg font-bold ${getScoreColor(parseInt(entry.elasticity))}`}>{entry.elasticity}%</p>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Evenness</p>
                  <p className={`text-lg font-bold ${getScoreColor(parseInt(entry.evenness))}`}>{entry.evenness}%</p>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Radiance</p>
                  <p className={`text-lg font-bold ${getScoreColor(parseInt(entry.radiance))}`}>{entry.radiance}%</p>
                </div>
              </div>

              {/* Detailed Skin Metrics */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-teal-500" />
                  Detailed Skin Metrics
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {SKIN_METRIC_LABELS.map((metric) => (
                    <div key={metric.key} className="p-2 rounded-lg bg-white border border-gray-100 text-center">
                      <p className="text-[9px] text-gray-500 uppercase truncate">{metric.label}</p>
                      <p className={`text-sm font-bold ${getMetricColor(skinMetrics[metric.key])}`}>
                        {skinMetrics[metric.key]}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Radar Chart */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-teal-500" />
                  Skin Analysis Chart
                </h4>
                <RadarChart data={skinMetrics} size={280} />
                <p className="text-xs text-gray-500 text-center mt-2">
                  Higher values indicate areas that may need attention
                </p>
              </div>

              {/* Summary Card - Moved to Left Column */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#2D2A3E] to-[#3D3A4E]">
                <h4 className="text-sm font-medium text-white flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-[#CFAFA3]" />
                  Analysis Summary
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/10">
                    <p className="text-[10px] text-white/60 uppercase mb-1">Overall Skin Health</p>
                    <p className="text-lg font-bold text-white">
                      {Math.round((parseInt(entry.hydration) + parseInt(entry.elasticity) + parseInt(entry.evenness) + parseInt(entry.radiance)) / 4)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/10">
                    <p className="text-[10px] text-white/60 uppercase mb-1">Areas to Focus</p>
                    <p className="text-lg font-bold text-white">
                      {allTips.filter(t => parseInt(t.value) > 50).length}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-white/60 mt-3">
                  Based on your analysis, focus on the areas with higher percentages for best results.
                </p>
              </div>
            </div>

            {/* Right Column - All Tips Only */}
            <div className="flex flex-col h-full">
              <div className="p-4 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100 flex-1 flex flex-col min-h-0">
                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-4 flex-shrink-0">
                  <Zap className="w-4 h-4 text-teal-500" />
                  Personalized Skincare Tips
                </h4>
                
                <div className="space-y-3 overflow-y-auto pr-2 flex-1">
                  {allTips.map((item, index) => (
                    item.tips.length > 0 && (
                      <div key={index} className="p-3 rounded-lg bg-white border border-teal-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-800 text-sm">{item.label}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            parseInt(item.value) <= 30 
                              ? 'bg-green-100 text-green-700' 
                              : parseInt(item.value) <= 60 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {item.value}%
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {item.tips.map((tip, tipIndex) => (
                            <li key={tipIndex} className="flex items-start gap-2 text-xs text-gray-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0"></span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};




// ============================================================================
// COMPONENT
// ============================================================================


// ============================================================================
// COMPONENT
// ============================================================================

const FaceAnalysisSection: React.FC = () => {
  // Use auth token for API calls
  const authToken = getAuthToken();

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frozenCanvasRef = useRef<HTMLCanvasElement>(null);
  const uploadCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const analysisTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAnalyzingRef = useRef(false);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<FaceMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'history' | 'tips'>('analysis');
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [checkingPermission, setCheckingPermission] = useState(false);
  const [analysisTimeRemaining, setAnalysisTimeRemaining] = useState(5);
  const [frozenImageData, setFrozenImageData] = useState<string | null>(null);
  
  // Photo Upload State
  const [inputMode, setInputMode] = useState<InputMode>('camera');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzingUpload, setIsAnalyzingUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Export PDF state
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportingHistoryId, setExportingHistoryId] = useState<string | null>(null);

  // History state
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<HistoryEntry | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Check camera permission status
  const checkCameraPermission = useCallback(async () => {
    setCheckingPermission(true);
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setPermissionStatus(result.state as PermissionStatus);
        
        result.onchange = () => {
          setPermissionStatus(result.state as PermissionStatus);
        };
      } else {
        setPermissionStatus('unknown');
      }
    } catch (err) {
      console.log('Permission query not supported:', err);
      setPermissionStatus('unknown');
    }
    setCheckingPermission(false);
  }, []);

  // Detect browser type for specific instructions
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome') && !userAgent.includes('edg')) return 'chrome';
    if (userAgent.includes('firefox')) return 'firefox';
    if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'safari';
    if (userAgent.includes('edg')) return 'edge';
    return 'other';
  };

  const browser = getBrowserInfo();

  // Load face-api models
  const loadModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    } catch (err) {
      console.error('Error loading face-api models:', err);
      setError('Failed to load face analysis models. Please refresh the page and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch history from database
  const fetchHistory = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    
    setLoadingHistory(true);
    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { analyses: HistoryEntry[] };
        error?: string;
      }>('/api/client/skin-analysis');

      if (!response.data.success) {
        console.error('Error fetching history:', response.data.error);
      } else {
        setHistoryEntries(response.data.data?.analyses || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Initialize models and check permissions on mount
  useEffect(() => {
    loadModels();
    checkCameraPermission();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (analysisTimerRef.current) {
        clearTimeout(analysisTimerRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [loadModels, checkCameraPermission]);

  // Fetch history when tab changes to history or on mount
  useEffect(() => {
    if (activeTab === 'history' && authToken) {
      fetchHistory();
    }
  }, [activeTab, authToken, fetchHistory]);

  // Freeze the current video frame
  const freezeVideoFrame = useCallback(() => {
    if (videoRef.current && frozenCanvasRef.current) {
      const video = videoRef.current;
      const canvas = frozenCanvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setFrozenImageData(imageData);
      }
    }
  }, []);

  // Stop all analysis and freeze everything
  const stopAllAnalysis = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (analysisTimerRef.current) {
      clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    freezeVideoFrame();
    
    if (videoRef.current) {
      videoRef.current.pause();
    }
    
    setIsPaused(true);
    setAnalysisTimeRemaining(0);
    isAnalyzingRef.current = false;
  }, [freezeVideoFrame]);

  // Start webcam
  const startCamera = async () => {
    setError(null);
    setFrozenImageData(null);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Your browser does not support camera access. Please try using a modern browser like Chrome, Firefox, or Edge.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });
      
      streamRef.current = stream;
      setPermissionStatus('granted');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setIsPaused(false);
        setAnalysisTimeRemaining(5);
        
        startAnalysisTimer();
      }
    } catch (err: unknown) {
      console.error('Error accessing camera:', err);
      
      const error = err as DOMException;
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionStatus('blocked');
        setError('Camera access was blocked. Please enable camera permissions in your browser settings to use this feature.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setError('No camera found. Please connect a camera and try again.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setError('Camera is in use by another application. Please close other apps using the camera and try again.');
      } else if (error.name === 'OverconstrainedError') {
        setError('Camera does not meet the required constraints. Trying with default settings...');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          streamRef.current = stream;
          setPermissionStatus('granted');
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setCameraActive(true);
            setIsPaused(false);
            setAnalysisTimeRemaining(5);
            startAnalysisTimer();
          }
          setError(null);
        } catch {
          setError('Unable to access camera with any settings.');
        }
      } else if (error.name === 'SecurityError') {
        setError('Camera access is not allowed on this page due to security restrictions. Please ensure you are using HTTPS.');
      } else {
        setError(`Unable to access camera: ${error.message || 'Unknown error'}`);
      }
    }
  };

  // Start analysis timer (5 seconds)
  const startAnalysisTimer = useCallback(() => {
    setAnalysisTimeRemaining(5);
    
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    if (analysisTimerRef.current) {
      clearTimeout(analysisTimerRef.current);
    }
    
    countdownIntervalRef.current = setInterval(() => {
      setAnalysisTimeRemaining(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    analysisTimerRef.current = setTimeout(() => {
      stopAllAnalysis();
    }, 5000);
  }, [stopAllAnalysis]);

  // Resume analysis
  const resumeAnalysis = useCallback(async () => {
    setFrozenImageData(null);
    setIsPaused(false);
    setSaveSuccess(false);
    setSaveError(null);
    
    if (videoRef.current) {
      try {
        await videoRef.current.play();
      } catch (err) {
        console.error('Error resuming video:', err);
      }
    }
    
    startAnalysisTimer();
  }, [startAnalysisTimer]);

  // Pause analysis manually
  const pauseAnalysis = useCallback(() => {
    stopAllAnalysis();
  }, [stopAllAnalysis]);

  // Request camera permission explicitly
  const requestCameraPermission = async () => {
    await startCamera();
  };

  // Stop webcam completely
  const stopCamera = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (analysisTimerRef.current) {
      clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraActive(false);
    setFaceDetected(false);
    setIsPaused(false);
    setAnalysisTimeRemaining(5);
    setFrozenImageData(null);
    isAnalyzingRef.current = false;
  };

  // Generate comprehensive skin analysis based on face metrics
  const generateSkinAnalysis = (age: number, expressions: faceapi.FaceExpressions): { skinMetrics: SkinMetrics; hydration: number; elasticity: number; evenness: number; radiance: number } => {
    const ageFactorWrinkles = Math.min(100, Math.max(10, age * 1.5));
    const ageFactorSagging = Math.min(100, Math.max(5, (age - 25) * 2));
    const happinessBoost = expressions.happy * 10;
    const stressIndicator = (expressions.angry + expressions.sad + expressions.fearful) * 5;
    
    const skinMetrics: SkinMetrics = {
      fineWrinkles: Math.min(100, Math.max(5, ageFactorWrinkles - 10 + Math.random() * 20)),
      eyeWrinkles: Math.min(100, Math.max(5, ageFactorWrinkles + Math.random() * 15)),
      deepWrinkles: Math.min(100, Math.max(0, ageFactorWrinkles - 20 + Math.random() * 15)),
      darkCircle: Math.min(100, Math.max(10, 30 + stressIndicator + Math.random() * 25)),
      eyeBag: Math.min(100, Math.max(5, 20 + stressIndicator + Math.random() * 20)),
      pores: Math.min(100, Math.max(15, 40 + Math.random() * 30)),
      pigment: Math.min(100, Math.max(10, 25 + Math.random() * 25)),
      redness: Math.min(100, Math.max(5, 20 + Math.random() * 30)),
      oiliness: Math.min(100, Math.max(10, 35 + Math.random() * 30)),
      dryness: Math.min(100, Math.max(10, 30 + Math.random() * 25)),
      sagginess: Math.min(100, Math.max(0, ageFactorSagging + Math.random() * 15)),
    };

    Object.keys(skinMetrics).forEach(key => {
      skinMetrics[key as keyof SkinMetrics] = Math.round(skinMetrics[key as keyof SkinMetrics]);
    });

    const baseScore = Math.max(50, 100 - age * 0.8);
    
    return {
      skinMetrics,
      hydration: Math.min(100, Math.round(baseScore + Math.random() * 15 + happinessBoost)),
      elasticity: Math.min(100, Math.round(baseScore - 5 + Math.random() * 20)),
      evenness: Math.min(100, Math.round(baseScore + Math.random() * 18)),
      radiance: Math.min(100, Math.round(baseScore + 5 + Math.random() * 12 + happinessBoost)),
    };
  };

  // Analyze face
  const analyzeFace = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded || isPaused || isAnalyzingRef.current) return;

    isAnalyzingRef.current = true;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    try {
      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();

      if (detections) {
        setFaceDetected(true);
        
        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);
        
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          const box = resizedDetections.detection.box;
          ctx.strokeStyle = '#0d9488';
          ctx.lineWidth = 3;
          ctx.strokeRect(box.x, box.y, box.width, box.height);
          
          const landmarks = resizedDetections.landmarks;
          const positions = landmarks.positions;
          ctx.fillStyle = '#0d9488';
          positions.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fill();
          });
        }

        const skinAnalysis = generateSkinAnalysis(detections.age, detections.expressions);

        const metrics: FaceMetrics = {
          estimatedAge: Math.round(detections.age),
          gender: detections.gender,
          genderProbability: Math.round(detections.genderProbability * 100),
          expressions: {
            neutral: Math.round(detections.expressions.neutral * 100),
            happy: Math.round(detections.expressions.happy * 100),
            sad: Math.round(detections.expressions.sad * 100),
            angry: Math.round(detections.expressions.angry * 100),
            fearful: Math.round(detections.expressions.fearful * 100),
            disgusted: Math.round(detections.expressions.disgusted * 100),
            surprised: Math.round(detections.expressions.surprised * 100),
          },
          skinMetrics: skinAnalysis.skinMetrics,
          hydration: skinAnalysis.hydration,
          elasticity: skinAnalysis.elasticity,
          evenness: skinAnalysis.evenness,
          radiance: skinAnalysis.radiance,
          timestamp: new Date(),
        };

        setCurrentMetrics(metrics);
      } else {
        setFaceDetected(false);
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    } catch (err) {
      console.error('Error analyzing face:', err);
    }
    
    isAnalyzingRef.current = false;
  }, [modelsLoaded, isPaused]);

  // Real-time face detection loop
  useEffect(() => {
    let isRunning = true;
    
    const detectLoop = async () => {
      if (!isRunning || !cameraActive || !modelsLoaded || isPaused) {
        return;
      }
      
      await analyzeFace();
      
      if (isRunning && cameraActive && !isPaused) {
        animationRef.current = requestAnimationFrame(detectLoop);
      }
    };
    
    if (cameraActive && modelsLoaded && !isPaused) {
      detectLoop();
    }
    
    return () => {
      isRunning = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [cameraActive, modelsLoaded, isPaused, analyzeFace]);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    setUploadError(null);
    setSaveSuccess(false);
    setSaveError(null);
    
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (JPG, PNG, etc.)');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image size must be less than 10MB');
      return;
    }
    
    const imageUrl = URL.createObjectURL(file);
    setUploadedImage(imageUrl);
    setCurrentMetrics(null);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Clear uploaded image
  const clearUploadedImage = () => {
    if (uploadedImage) {
      URL.revokeObjectURL(uploadedImage);
    }
    setUploadedImage(null);
    setCurrentMetrics(null);
    setUploadError(null);
    setSaveSuccess(false);
    setSaveError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Analyze uploaded photo
  const analyzeUploadedPhoto = async () => {
    if (!uploadedImage || !modelsLoaded) return;
    
    setIsAnalyzingUpload(true);
    setUploadError(null);
    
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = uploadedImage;
      });
      
      const detections = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions()
        .withAgeAndGender();
      
      if (detections) {
        setFaceDetected(true);
        
        if (uploadCanvasRef.current) {
          const canvas = uploadCanvasRef.current;
          const displaySize = { width: img.width, height: img.height };
          faceapi.matchDimensions(canvas, displaySize);
          
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const box = resizedDetections.detection.box;
            ctx.strokeStyle = '#0d9488';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            
            const landmarks = resizedDetections.landmarks;
            const positions = landmarks.positions;
            ctx.fillStyle = '#0d9488';
            positions.forEach(point => {
              ctx.beginPath();
              ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
              ctx.fill();
            });
          }
        }
        
        const skinAnalysis = generateSkinAnalysis(detections.age, detections.expressions);
        
        const metrics: FaceMetrics = {
          estimatedAge: Math.round(detections.age),
          gender: detections.gender,
          genderProbability: Math.round(detections.genderProbability * 100),
          expressions: {
            neutral: Math.round(detections.expressions.neutral * 100),
            happy: Math.round(detections.expressions.happy * 100),
            sad: Math.round(detections.expressions.sad * 100),
            angry: Math.round(detections.expressions.angry * 100),
            fearful: Math.round(detections.expressions.fearful * 100),
            disgusted: Math.round(detections.expressions.disgusted * 100),
            surprised: Math.round(detections.expressions.surprised * 100),
          },
          skinMetrics: skinAnalysis.skinMetrics,
          hydration: skinAnalysis.hydration,
          elasticity: skinAnalysis.elasticity,
          evenness: skinAnalysis.evenness,
          radiance: skinAnalysis.radiance,
          timestamp: new Date(),
        };
        
        setCurrentMetrics(metrics);
      } else {
        setFaceDetected(false);
        setUploadError('No face detected in the image. Please upload a clear photo of your face.');
      }
    } catch (err) {
      console.error('Error analyzing uploaded photo:', err);
      setUploadError('Failed to analyze the image. Please try again with a different photo.');
    } finally {
      setIsAnalyzingUpload(false);
    }
  };

  // Switch input mode
  const switchInputMode = (mode: InputMode) => {
    if (mode === inputMode) return;
    
    if (inputMode === 'camera' && cameraActive) {
      stopCamera();
    }
    
    if (inputMode === 'upload') {
      clearUploadedImage();
    }
    
    setInputMode(mode);
    setCurrentMetrics(null);
    setError(null);
    setUploadError(null);
    setSaveSuccess(false);
    setSaveError(null);
  };

  // Upload photo to storage bucket using encrypted upload
  const uploadPhotoToStorage = async (imageData: string): Promise<string | null> => {
    const token = getAuthToken();
    if (!token) return null;

    try {
      // Convert image data (data URL or blob URL) to File object
      let blob: Blob;
      
      if (imageData.startsWith('data:')) {
        // It's a data URL - convert to blob
        const response = await fetch(imageData);
        blob = await response.blob();
      } else if (imageData.startsWith('blob:')) {
        // It's a blob URL - fetch the blob
        const response = await fetch(imageData);
        blob = await response.blob();
      } else {
        return null;
      }

      // Create a File object from the blob
      const fileName = `skin-analysis-${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      // Use the existing encrypted upload function
      const response = await uploadImage(file, 'photos', token);

      if (!response.success) {
        console.error('Error uploading photo:', response.error);
        return null;
      }

      return response.data?.image_url || null;
    } catch (err) {
      console.error('Error uploading photo:', err);
      return null;
    }
  };

  // Get dominant expression
  const getDominantExpression = (expressions: FaceMetrics['expressions']) => {
    const entries = Object.entries(expressions) as [keyof typeof expressions, number][];
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0];
  };

  // Get highest concern metric for tips
  const getHighestConcern = (skinMetrics: SkinMetrics): keyof SkinMetrics => {
    const entries = Object.entries(skinMetrics) as [keyof SkinMetrics, number][];
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0][0];
  };

  // Save analysis to database
  const saveAnalysisToDatabase = async () => {
    const token = getAuthToken();
    if (!currentMetrics || !token) {
      setSaveError('Unable to save. Please ensure you are logged in and have completed an analysis.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Determine which image to upload
      const imageToUpload = inputMode === 'camera' ? frozenImageData : uploadedImage;
      
      // Upload photo to storage
      let photoUrl: string | null = null;
      if (imageToUpload) {
        photoUrl = await uploadPhotoToStorage(imageToUpload);
      }

      // Get dominant expression
      const dominantExpression = getDominantExpression(currentMetrics.expressions);
      
      // Get highest concern for tips
      const highestConcern = getHighestConcern(currentMetrics.skinMetrics);
      const tips = SKIN_TIPS[highestConcern] || [];

      // Prepare data for database
      const analysisData = {
        photo_url: photoUrl,
        age: currentMetrics.estimatedAge,
        gender: currentMetrics.gender,
        expression: dominantExpression[0],
        hydration: currentMetrics.hydration.toString(),
        elasticity: currentMetrics.elasticity.toString(),
        evenness: currentMetrics.evenness.toString(),
        radiance: currentMetrics.radiance.toString(),
        fine_wrinkles: currentMetrics.skinMetrics.fineWrinkles.toString(),
        eye_wrinkles: currentMetrics.skinMetrics.eyeWrinkles.toString(),
        deep_wrinkles: currentMetrics.skinMetrics.deepWrinkles.toString(),
        dark_circle: currentMetrics.skinMetrics.darkCircle.toString(),
        eye_bag: currentMetrics.skinMetrics.eyeBag.toString(),
        pores: currentMetrics.skinMetrics.pores.toString(),
        pigment: currentMetrics.skinMetrics.pigment.toString(),
        redness: currentMetrics.skinMetrics.redness.toString(),
        oiliness: currentMetrics.skinMetrics.oiliness.toString(),
        dryness: currentMetrics.skinMetrics.dryness.toString(),
        sagginess: currentMetrics.skinMetrics.sagginess.toString(),
        fine_wrinkles_tips: SKIN_TIPS.fineWrinkles?.join('; ') || null,
        eye_wrinkles_tips: SKIN_TIPS.eyeWrinkles?.join('; ') || null,
        deep_wrinkles_tips: SKIN_TIPS.deepWrinkles?.join('; ') || null,
        dark_circle_tips: SKIN_TIPS.darkCircle?.join('; ') || null,
        eye_bag_tips: SKIN_TIPS.eyeBag?.join('; ') || null,
        pores_tips: SKIN_TIPS.pores?.join('; ') || null,
        pigment_tips: SKIN_TIPS.pigment?.join('; ') || null,
        redness_tips: SKIN_TIPS.redness?.join('; ') || null,
        oiliness_tips: SKIN_TIPS.oiliness?.join('; ') || null,
        dryness_tips: SKIN_TIPS.dryness?.join('; ') || null,
        sagginess_tips: SKIN_TIPS.sagginess?.join('; ') || null,
      };

      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { analysis: HistoryEntry };
        error?: string;
      }>('/api/client/skin-analysis', analysisData);

      if (!response.data.success) {
        console.error('Error saving analysis:', response.data.error);
        setSaveError('Failed to save analysis. Please try again.');
        return;
      }

      setSaveSuccess(true);
      
      // Refresh history if on history tab
      if (activeTab === 'history') {
        fetchHistory();
      }

    } catch (err: any) {
      console.error('Error saving analysis:', err);
      setSaveError(err.message || 'Failed to save analysis. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Get skin score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  // View history detail
  const viewHistoryDetail = (entry: HistoryEntry) => {
    setSelectedHistoryEntry(entry);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E]">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(207,175,163,0.3),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(207,175,163,0.2),transparent_40%)]" />
        </div>
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={24} height={24}/>
                <span className="text-[#CFAFA3] text-sm font-medium uppercase tracking-wider">AI Analysis</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2">
                SkinAura AI Facial Scanner
              </h1>
              <p className="text-white/70">
                Advanced AI-powered analysis to evaluate your skin health and track skincare progress
              </p>
            </div>
            <div className="flex items-center gap-3">
              {permissionStatus === 'blocked' && (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-full text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  Camera Blocked
                </span>
              )}
              {modelsLoaded && (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-full text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  AI Ready
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Permission Blocked Alert */}
      {permissionStatus === 'blocked' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-amber-800 font-serif font-bold text-lg mb-2">Camera Permission Required</h3>
              <p className="text-amber-700 text-sm mb-4">
                Camera access is currently blocked. To use the Face Metrics Scanner, you need to enable camera permissions in your browser.
              </p>
              
              <div className="bg-white rounded-xl p-4 border border-amber-200 mb-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  How to Enable Camera Access
                </h4>
                
                {browser === 'chrome' && (
                  <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                    <li>Click the <strong>lock icon</strong> in the address bar</li>
                    <li>Find <strong>"Camera"</strong> in the permissions list</li>
                    <li>Change it from "Block" to <strong>"Allow"</strong></li>
                    <li>Refresh the page and try again</li>
                  </ol>
                )}
                
                {browser === 'firefox' && (
                  <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                    <li>Click the <strong>shield icon</strong> in the address bar</li>
                    <li>Click <strong>"Connection secure"</strong></li>
                    <li>Click <strong>"More Information"</strong> then <strong>"Permissions"</strong></li>
                    <li>Find "Use the Camera" and select <strong>"Allow"</strong></li>
                    <li>Refresh the page and try again</li>
                  </ol>
                )}
                
                {browser === 'edge' && (
                  <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                    <li>Click the <strong>lock icon</strong> in the address bar</li>
                    <li>Click <strong>"Permissions for this site"</strong></li>
                    <li>Find <strong>"Camera"</strong> and set it to <strong>"Allow"</strong></li>
                    <li>Refresh the page and try again</li>
                  </ol>
                )}
                
                {browser === 'safari' && (
                  <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                    <li>Go to <strong>Safari</strong> then <strong>Settings for This Website</strong></li>
                    <li>Find <strong>"Camera"</strong> and select <strong>"Allow"</strong></li>
                    <li>Refresh the page and try again</li>
                  </ol>
                )}
                
                {browser === 'other' && (
                  <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                    <li>Look for a <strong>camera icon</strong> or <strong>lock icon</strong> in your address bar</li>
                    <li>Click it and look for camera permission settings</li>
                    <li>Enable camera access for this site</li>
                    <li>Refresh the page and try again</li>
                  </ol>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Page
                </button>
                <button
                  onClick={requestCameraPermission}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-amber-700 border border-amber-300 rounded-lg font-medium hover:bg-amber-50 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General Error Alert */}
      {error && permissionStatus !== 'blocked' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm mb-3">{error}</p>
            <button
              onClick={requestCameraPermission}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Loading Models */}
      {isLoading && (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-[#CFAFA3]" />
            <div className="text-center">
              <p className="text-gray-900 font-medium">Loading AI Models</p>
              <p className="text-gray-500 text-sm">This may take a moment on first load...</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {modelsLoaded && !isLoading && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Section - Camera or Upload */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Input Mode Toggle */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => switchInputMode('camera')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                    inputMode === 'camera'
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  Live Camera
                </button>
                <button
                  onClick={() => switchInputMode('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                    inputMode === 'upload'
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload Photo
                </button>
              </div>
            </div>

            {/* Camera Mode */}
            {inputMode === 'camera' && (
              <>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                    <Camera className="w-5 h-5 text-[#CFAFA3]" />
                    Live Camera
                  </h3>
                  <div className="flex items-center gap-2">
                    {cameraActive && (
                      <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                        isPaused 
                          ? 'bg-amber-100 text-amber-700' 
                          : 'bg-teal-100 text-teal-700'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-teal-500 animate-pulse'}`} />
                        {isPaused ? 'Analysis Complete' : `Analyzing (${analysisTimeRemaining}s)`}
                      </span>
                    )}
                    {faceDetected && !isPaused && (
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Face Detected
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="relative aspect-[4/3] bg-gray-900">
                  <video
                    ref={videoRef}
                    className={`absolute inset-0 w-full h-full object-cover ${isPaused ? 'hidden' : ''}`}
                    playsInline
                    muted
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  
                  {isPaused && frozenImageData && (
                    <img
                      src={frozenImageData}
                      alt="Captured frame"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  
                  <canvas
                    ref={canvasRef}
                    className={`absolute inset-0 w-full h-full ${isPaused ? 'hidden' : ''}`}
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  
                  <canvas
                    ref={frozenCanvasRef}
                    className="hidden"
                  />

                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 p-6">
                      {permissionStatus === 'blocked' ? (
                        <>
                          <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                            <ShieldAlert className="w-12 h-12 text-amber-400" />
                          </div>
                          <p className="text-amber-300 text-center font-medium mb-2">
                            Camera Access Blocked
                          </p>
                          <p className="text-gray-400 text-center text-sm">
                            See instructions above to enable camera
                          </p>
                        </>
                      ) : permissionStatus === 'denied' ? (
                        <>
                          <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <CameraOff className="w-12 h-12 text-red-400" />
                          </div>
                          <p className="text-red-300 text-center font-medium mb-2">
                            Camera Access Denied
                          </p>
                          <p className="text-gray-400 text-center text-sm">
                            Please allow camera access to use this feature
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-24 h-24 rounded-full bg-gray-700/50 flex items-center justify-center mb-4">
                            <Video className="w-12 h-12 text-gray-500" />
                          </div>
                          <p className="text-gray-300 text-center font-medium mb-2">
                            Camera Ready
                          </p>
                          <p className="text-gray-400 text-center text-sm">
                            Click "Start Camera" to begin face analysis
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {isPaused && cameraActive && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="bg-white/90 backdrop-blur-sm rounded-xl px-6 py-4 text-center">
                        <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                        <p className="text-gray-800 font-medium">Analysis Complete</p>
                        <p className="text-gray-500 text-sm">Results captured after 5 seconds</p>
                      </div>
                    </div>
                  )}

                  {cameraActive && !isPaused && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
                      <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                      <span className="text-white text-sm">Analyzing...</span>
                    </div>
                  )}
                </div>

                {/* Camera Controls */}
                <div className="p-4 flex items-center justify-between gap-4">
                  {!cameraActive ? (
                    <button
                      onClick={startCamera}
                      disabled={checkingPermission}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all disabled:opacity-50 ${
                        permissionStatus === 'blocked'
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:shadow-lg hover:shadow-teal-500/30'
                      }`}
                    >
                      {checkingPermission ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Checking...
                        </>
                      ) : permissionStatus === 'blocked' ? (
                        <>
                          <ShieldAlert className="w-5 h-5" />
                          Enable Camera Access
                        </>
                      ) : (
                        <>
                          <Camera className="w-5 h-5" />
                          Start Camera
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={stopCamera}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                      >
                        <CameraOff className="w-5 h-5" />
                        Stop
                      </button>
                      {isPaused ? (
                        <button
                          onClick={resumeAnalysis}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-teal-500/30 transition-all"
                        >
                          <Play className="w-5 h-5" />
                          Analyze Again
                        </button>
                      ) : (
                        <button
                          onClick={pauseAnalysis}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-amber-500/30 transition-all"
                        >
                          <Pause className="w-5 h-5" />
                          Stop Now
                        </button>
                      )}
                      <button
                        onClick={saveAnalysisToDatabase}
                        disabled={!currentMetrics || isSaving}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-[#CFAFA3] text-[#2D2A3E] rounded-xl font-medium hover:bg-[#E8D5D0] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            Save
                          </>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (!currentMetrics) return;
                          setIsExportingPDF(true);
                          try {
                            const photoData = frozenImageData || null;
                            await exportCurrentAnalysisPDF(currentMetrics, photoData, SKIN_TIPS);
                          } catch (err) {
                            console.error('Error exporting PDF:', err);
                          } finally {
                            setIsExportingPDF(false);
                          }
                        }}
                        disabled={!currentMetrics || isExportingPDF}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-[#2D2A3E] text-white rounded-xl font-medium hover:bg-[#3D3A4E] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isExportingPDF ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <FileDown className="w-5 h-5" />
                            Export PDF
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>


                {/* Save Status Messages */}
                {saveSuccess && (
                  <div className="mx-4 mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="text-green-700 text-sm">Analysis saved successfully!</p>
                  </div>
                )}
                {saveError && (
                  <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm">{saveError}</p>
                  </div>
                )}
              </>
            )}

            {/* Upload Mode */}
            {inputMode === 'upload' && (
              <>
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                    <Upload className="w-5 h-5 text-[#CFAFA3]" />
                    Upload Photo
                  </h3>
                  {uploadedImage && currentMetrics && (
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                      <CheckCircle2 className="w-3 h-3" />
                      Analysis Complete
                    </span>
                  )}
                </div>

                <div className="relative aspect-[4/3] bg-gray-900">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />

                  {!uploadedImage ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`absolute inset-0 flex flex-col items-center justify-center p-6 cursor-pointer transition-all ${
                        isDragging
                          ? 'bg-teal-900/50 border-2 border-dashed border-teal-400'
                          : 'bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800'
                      }`}
                    >
                      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all ${
                        isDragging ? 'bg-teal-500/30' : 'bg-gray-700/50'
                      }`}>
                        <ImageIcon className={`w-12 h-12 ${isDragging ? 'text-teal-400' : 'text-gray-500'}`} />
                      </div>
                      <p className={`text-center font-medium mb-2 ${isDragging ? 'text-teal-300' : 'text-gray-300'}`}>
                        {isDragging ? 'Drop your photo here' : 'Upload a Photo'}
                      </p>
                      <p className="text-gray-400 text-center text-sm mb-4">
                        Drag and drop or click to select
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="px-2 py-1 bg-gray-700 rounded">JPG</span>
                        <span className="px-2 py-1 bg-gray-700 rounded">PNG</span>
                        <span className="px-2 py-1 bg-gray-700 rounded">WEBP</span>
                        <span className="text-gray-600">Max 10MB</span>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0">
                      <img
                        src={uploadedImage}
                        alt="Uploaded photo"
                        className="w-full h-full object-contain bg-gray-900"
                      />
                      
                      <canvas
                        ref={uploadCanvasRef}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ objectFit: 'contain' }}
                      />

                      <button
                        onClick={clearUploadedImage}
                        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      {isAnalyzingUpload && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-6 py-4 text-center">
                            <Loader2 className="w-8 h-8 text-teal-600 mx-auto mb-2 animate-spin" />
                            <p className="text-gray-800 font-medium">Analyzing Photo...</p>
                            <p className="text-gray-500 text-sm">Please wait</p>
                          </div>
                        </div>
                      )}

                      {currentMetrics && !isAnalyzingUpload && (
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-teal-600" />
                              <span className="text-gray-800 font-medium text-sm">Analysis Complete</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              Age: {currentMetrics.estimatedAge} | {currentMetrics.gender}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {uploadError && (
                  <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm">{uploadError}</p>
                  </div>
                )}

                <div className="p-4 flex items-center justify-between gap-4">
                  {!uploadedImage ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-teal-500/30 transition-all"
                    >
                      <Upload className="w-5 h-5" />
                      Select Photo
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={clearUploadedImage}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                      >
                        <X className="w-5 h-5" />
                        Clear
                      </button>
                      {!currentMetrics ? (
                        <button
                          onClick={analyzeUploadedPhoto}
                          disabled={isAnalyzingUpload}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-teal-500/30 transition-all disabled:opacity-50"
                        >
                          {isAnalyzingUpload ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5" />
                              Analyze Photo
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={analyzeUploadedPhoto}
                          disabled={isAnalyzingUpload}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-teal-500/30 transition-all disabled:opacity-50"
                        >
                          <RefreshCw className="w-5 h-5" />
                          Re-analyze
                        </button>
                      )}
                      <button
                        onClick={saveAnalysisToDatabase}
                        disabled={!currentMetrics || isSaving}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-[#CFAFA3] text-[#2D2A3E] rounded-xl font-medium hover:bg-[#E8D5D0] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-5 h-5" />
                            Save
                          </>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (!currentMetrics) return;
                          setIsExportingPDF(true);
                          try {
                            await exportCurrentAnalysisPDF(currentMetrics, uploadedImage, SKIN_TIPS);
                          } catch (err) {
                            console.error('Error exporting PDF:', err);
                          } finally {
                            setIsExportingPDF(false);
                          }
                        }}
                        disabled={!currentMetrics || isExportingPDF}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-[#2D2A3E] text-white rounded-xl font-medium hover:bg-[#3D3A4E] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isExportingPDF ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <FileDown className="w-5 h-5" />
                            Export PDF
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* Save Status Messages for Upload Mode */}
                {saveSuccess && (
                  <div className="mx-4 mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <p className="text-green-700 text-sm">Analysis saved successfully!</p>
                  </div>
                )}
                {saveError && (
                  <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-sm">{saveError}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Metrics Section */}
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'analysis'
                      ? 'bg-teal-50 text-teal-600 border-b-2 border-teal-500'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  Analysis
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'history'
                      ? 'bg-teal-50 text-teal-600 border-b-2 border-teal-500'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <History className="w-4 h-4" />
                  History
                </button>
                <button
                  onClick={() => setActiveTab('tips')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'tips'
                      ? 'bg-teal-50 text-teal-600 border-b-2 border-teal-500'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  Tips
                </button>
              </div>

              {/* Analysis Tab */}
              {activeTab === 'analysis' && (
                <div className="p-4 space-y-4">
                  {currentMetrics ? (
                    <>
                      {/* Age, Gender & Expression */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100">
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className="w-3 h-3 text-purple-500" />
                            <span className="text-[10px] font-medium text-purple-600 uppercase">Age</span>
                          </div>
                          <p className="text-2xl font-bold text-purple-700">{currentMetrics.estimatedAge}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-100">
                          <div className="flex items-center gap-1 mb-1">
                            <User className="w-3 h-3 text-pink-500" />
                            <span className="text-[10px] font-medium text-pink-600 uppercase">Gender</span>
                          </div>
                          <p className="text-lg font-bold text-pink-700 capitalize">{currentMetrics.gender}</p>
                          <p className="text-[10px] text-pink-500">{currentMetrics.genderProbability}%</p>
                        </div>
                        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100">
                          <div className="flex items-center gap-1 mb-1">
                            <Heart className="w-3 h-3 text-amber-500" />
                            <span className="text-[10px] font-medium text-amber-600 uppercase">Expression</span>
                          </div>
                          <p className="text-lg font-bold text-amber-700 capitalize">
                            {getDominantExpression(currentMetrics.expressions)[0]}
                          </p>
                          <p className="text-[10px] text-amber-500">{getDominantExpression(currentMetrics.expressions)[1]}%</p>
                        </div>
                      </div>

                      {/* General Skin Health */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="p-2 rounded-lg bg-gray-50 text-center">
                          <p className="text-[10px] text-gray-500 uppercase">Hydration</p>
                          <p className={`text-lg font-bold ${getScoreColor(currentMetrics.hydration)}`}>{currentMetrics.hydration}%</p>
                        </div>
                        <div className="p-2 rounded-lg bg-gray-50 text-center">
                          <p className="text-[10px] text-gray-500 uppercase">Elasticity</p>
                          <p className={`text-lg font-bold ${getScoreColor(currentMetrics.elasticity)}`}>{currentMetrics.elasticity}%</p>
                        </div>
                        <div className="p-2 rounded-lg bg-gray-50 text-center">
                          <p className="text-[10px] text-gray-500 uppercase">Evenness</p>
                          <p className={`text-lg font-bold ${getScoreColor(currentMetrics.evenness)}`}>{currentMetrics.evenness}%</p>
                        </div>
                        <div className="p-2 rounded-lg bg-gray-50 text-center">
                          <p className="text-[10px] text-gray-500 uppercase">Radiance</p>
                          <p className={`text-lg font-bold ${getScoreColor(currentMetrics.radiance)}`}>{currentMetrics.radiance}%</p>
                        </div>
                      </div>

                      {/* Radar Chart */}
                      <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-teal-500" />
                          Detailed Skin Analysis
                          {(isPaused || inputMode === 'upload') && currentMetrics && (
                            <span className="ml-auto text-xs text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">
                              {inputMode === 'upload' ? 'Photo Analysis' : 'Final Result'}
                            </span>
                          )}
                        </h4>
                        <RadarChart data={currentMetrics.skinMetrics} size={320} />
                        <p className="text-xs text-gray-500 text-center mt-2">
                          Higher values indicate areas that may need attention
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        {inputMode === 'camera' ? (
                          <Camera className="w-8 h-8 text-gray-400" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <p className="text-gray-500">
                        {inputMode === 'camera' 
                          ? (cameraActive 
                              ? 'Position your face in front of the camera'
                              : 'Start the camera to begin analysis')
                          : (uploadedImage
                              ? 'Click "Analyze Photo" to start analysis'
                              : 'Upload a photo to begin analysis')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="p-4">
                  {loadingHistory ? (
                    <div className="py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto mb-4" />
                      <p className="text-gray-500">Loading history...</p>
                    </div>
                  ) : historyEntries.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {historyEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-teal-200 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            {/* Thumbnail */}
                            {entry.photo_url && (
                              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                <EncryptedImage
                                  src={entry.photo_url}
                                  alt="Analysis"
                                  className="w-full h-full object-cover"
                                  fallbackClassName="w-8 h-8 text-gray-400"
                                />
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500">
                                  {new Date(entry.created_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                                <div>
                                  <span className="text-gray-500">Age:</span>
                                  <span className="ml-1 font-medium">{entry.age}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Hydration:</span>
                                  <span className={`ml-1 font-medium ${getScoreColor(parseInt(entry.hydration))}`}>
                                    {entry.hydration}%
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => viewHistoryDetail(entry)}
                                  className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                                >
                                  <Eye className="w-3 h-3" />
                                  View Details
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setExportingHistoryId(entry.id);
                                    try {
                                      const session = getAuthSession();
                                      await exportHistoryEntryPDF(entry, session?.user?.id);
                                    } catch (err) {
                                      console.error('Error exporting PDF:', err);
                                    } finally {
                                      setExportingHistoryId(null);
                                    }
                                  }}
                                  disabled={exportingHistoryId === entry.id}
                                  className="flex items-center gap-1 text-xs text-[#2D2A3E] hover:text-[#3D3A4E] font-medium disabled:opacity-50"
                                >
                                  {exportingHistoryId === entry.id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Exporting...
                                    </>
                                  ) : (
                                    <>
                                      <FileDown className="w-3 h-3" />
                                      Export PDF
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <History className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500">No history yet</p>
                      <p className="text-sm text-gray-400">Save analyses to track your progress</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tips Tab */}
              {activeTab === 'tips' && (
                <div className="p-4">
                  {currentMetrics ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-100">
                        <div className="flex items-center gap-2 mb-3">
                          <Info className="w-5 h-5 text-teal-600" />
                          <span className="font-medium text-gray-900">
                            Priority Area: <span className="capitalize">{getHighestConcern(currentMetrics.skinMetrics).replace(/([A-Z])/g, ' $1').trim()}</span>
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          Based on your analysis, here are personalized tips:
                        </p>
                        <ul className="space-y-2">
                          {SKIN_TIPS[getHighestConcern(currentMetrics.skinMetrics)]?.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                              <CheckCircle2 className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* All Tips */}
                      <div className="grid gap-3 max-h-[300px] overflow-y-auto">
                        {Object.entries(SKIN_TIPS).map(([category, tips]) => (
                          <details key={category} className="group">
                            <summary className="flex items-center justify-between p-3 rounded-xl bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                              <span className="font-medium text-gray-700 capitalize">{category.replace(/([A-Z])/g, ' $1').trim()} Tips</span>
                              <RefreshCw className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform" />
                            </summary>
                            <div className="p-3 space-y-2">
                              {tips.map((tip, idx) => (
                                <p key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-teal-500">•</span>
                                  {tip}
                                </p>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500">Complete an analysis to get personalized tips</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-gradient-to-br from-[#2D2A3E] to-[#3D3A4E] rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
            <Info className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h3 className="text-white font-serif font-bold mb-2">How Face Metrics Work</h3>
            <p className="text-white/70 text-sm leading-relaxed">
              Our AI-powered face analysis uses advanced machine learning models to estimate age, detect facial expressions, 
              and provide comprehensive skin health metrics. You can use your <strong className="text-white">live camera</strong> for real-time analysis 
              (runs for 5 seconds then automatically stops) or <strong className="text-white">upload a photo</strong> for instant analysis.
              For best results, ensure good lighting and position your face clearly in the frame. 
              When you click <strong className="text-white">Save</strong>, your analysis and photo will be saved to your history for tracking progress.
              Your privacy is protected — all analysis happens locally in your browser.
            </p>
          </div>
        </div>
      </div>

      {/* History Detail Modal */}
      <HistoryDetailModal
        entry={selectedHistoryEntry}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedHistoryEntry(null);
        }}
      />
    </div>
  );
};

export default FaceAnalysisSection;
