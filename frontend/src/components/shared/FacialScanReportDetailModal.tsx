import React, { useState } from 'react';
import { X, Target, Info, Heart, Layers, Camera, CheckCircle } from 'lucide-react';
import { EncryptedImage } from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

/** Full skin_analysis row shape (client history / professional report) */
export interface FacialScanReportEntry {
  id: string;
  user_id: string;
  checked?: boolean;
  original_area: string | null;
  skin_health: number | null;
  finewrinkles: number | null;
  eyewrinkles: number | null;
  deepwrinkles: number | null;
  darkcircle: number | null;
  eyebag: number | null;
  pores: number | null;
  pigment: number | null;
  redness: number | null;
  oiliness: number | null;
  acne: number | null;
  finewrinkles_area: string | null;
  eyewrinkles_area: string | null;
  deepwrinkles_area: string | null;
  darkcircle_area: string | null;
  eyebag_area: string | null;
  pores_area: string | null;
  pigment_area: string | null;
  redness_area: string | null;
  oiliness_area: string | null;
  acne_area: string | null;
  created_at: string;
}

interface SkinProblem {
  key: string;
  title: string;
  description: string;
  value: number;
  color: string;
}

interface SkinAttribute {
  key: string;
  label: string;
  color: string;
  areaKey: string;
}

const SKIN_ATTRIBUTES: SkinAttribute[] = [
  { key: 'finewrinkles', label: 'Fine Wrinkles', color: '#71cc51', areaKey: 'finewrinkles_area' },
  { key: 'eyewrinkles', label: 'Eye Wrinkles', color: '#85e065', areaKey: 'eyewrinkles_area' },
  { key: 'deepwrinkles', label: 'Deep Wrinkles', color: '#ff81e3', areaKey: 'deepwrinkles_area' },
  { key: 'darkcircle', label: 'Dark Circle', color: '#aabbcd', areaKey: 'darkcircle_area' },
  { key: 'eyebag', label: 'Eye Bag', color: '#ff7a00', areaKey: 'eyebag_area' },
  { key: 'pores', label: 'Pores', color: '#2af2ff', areaKey: 'pores_area' },
  { key: 'pigment', label: 'Pigment', color: '#cd86f2', areaKey: 'pigment_area' },
  { key: 'redness', label: 'Redness', color: '#ff5959', areaKey: 'redness_area' },
  { key: 'oiliness', label: 'Oiliness', color: '#ffaf14', areaKey: 'oiliness_area' },
  { key: 'acne', label: 'Acne', color: '#cb2e82', areaKey: 'acne_area' },
];

// ============================================================================
// HELPERS
// ============================================================================

function entryToSkinProblems(entry: FacialScanReportEntry): SkinProblem[] {
  return SKIN_ATTRIBUTES.map(attr => {
    const rawValue = entry[attr.key as keyof FacialScanReportEntry];
    const numValue = rawValue !== null && rawValue !== undefined ? Number(rawValue) : 0;
    return {
      key: attr.key,
      title: attr.label,
      description: `${attr.label} analysis from saved scan`,
      value: isNaN(numValue) ? 0 : numValue,
      color: attr.color,
    };
  }).filter(p => p.value > 0).sort((a, b) => b.value - a.value);
}

// ============================================================================
// RADAR CHART
// ============================================================================

interface RadarChartProps {
  data: SkinProblem[];
  size?: number;
}

const RadarChart: React.FC<RadarChartProps> = ({ data, size = 320 }) => {
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
    const invertedValue = 100 - value;
    const r = (invertedValue / 100) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const gridLines = [];
  for (let level = 1; level <= levels; level++) {
    const levelRadius = (level / levels) * radius;
    const points = data.map((_, index) => {
      const angle = (index * angleStep) - (Math.PI / 2);
      return `${centerX + levelRadius * Math.cos(angle)},${centerY + levelRadius * Math.sin(angle)}`;
    }).join(' ');
    gridLines.push(
      <polygon key={`grid-${level}`} points={points} fill="none" stroke="#e5e7eb" strokeWidth="1" />
    );
  }

  const axisLines = data.map((_, index) => {
    const angle = (index * angleStep) - (Math.PI / 2);
    const endX = centerX + radius * Math.cos(angle);
    const endY = centerY + radius * Math.sin(angle);
    return (
      <line key={`axis-${index}`} x1={centerX} y1={centerY} x2={endX} y2={endY} stroke="#e5e7eb" strokeWidth="1" />
    );
  });

  const dataPoints = data.map((problem, index) => {
    const point = getPoint(index, problem.value);
    return `${point.x},${point.y}`;
  }).join(' ');

  const labels = data.map((problem, index) => {
    const angle = (index * angleStep) - (Math.PI / 2);
    const labelRadius = radius + 35;
    const x = centerX + labelRadius * Math.cos(angle);
    const y = centerY + labelRadius * Math.sin(angle);
    let textAnchor: 'start' | 'middle' | 'end' = 'middle';
    if (x < centerX - 10) textAnchor = 'end';
    else if (x > centerX + 10) textAnchor = 'start';
    return (
      <g key={`label-${index}`}>
        <text x={x} y={y - 8} textAnchor={textAnchor} dominantBaseline="middle" className="text-[10px] font-medium fill-gray-600">
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

  const dots = data.map((problem, index) => {
    const point = getPoint(index, problem.value);
    return (
      <circle key={`dot-${index}`} cx={point.x} cy={point.y} r={5} fill={problem.color} stroke="#fff" strokeWidth="2" />
    );
  });

  return (
    <div className="flex justify-center w-full overflow-hidden">
      <svg width={totalWidth} height={totalHeight} viewBox={`0 0 ${totalWidth} ${totalHeight}`} className="max-w-full" style={{ minWidth: '280px' }}>
        {gridLines}
        {axisLines}
        <polygon points={dataPoints} fill="rgba(0, 113, 133, 0.2)" stroke="#007185" strokeWidth="2" />
        {dots}
        {labels}
        <circle cx={centerX} cy={centerY} r="4" fill="#007185" />
      </svg>
    </div>
  );
};

// ============================================================================
// MODAL PROPS
// ============================================================================

export interface FacialScanReportDetailModalProps {
  entry: FacialScanReportEntry;
  clientName?: string;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const FacialScanReportDetailModal: React.FC<FacialScanReportDetailModalProps> = ({ entry, clientName, onClose }) => {
  const [activeAreaFilter, setActiveAreaFilter] = useState<'all' | string>('all');
  const problems = entryToSkinProblems(entry);
  const storedHealth = entry.skin_health !== null ? Number(entry.skin_health) : null;
  const avgScore = storedHealth !== null && !isNaN(storedHealth)
    ? storedHealth
    : (problems.length > 0 ? Math.round(100 - (problems.reduce((sum, p) => sum + p.value, 0) / problems.length)) : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-[#2D2A3E] to-[#3D3A4E] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg">
                {clientName ? `${clientName} – Analysis Details` : 'Analysis Details'}
                {entry.checked && (
                  <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-emerald-300">
                    <CheckCircle className="w-4 h-4" />
                    Checked
                  </span>
                )}
              </h2>
              <p className="text-white/70 text-sm">
                {new Date(entry.created_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors" aria-label="Close">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Image Overlay */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-5 h-5 text-[#007185]" />
                <h3 className="font-medium text-gray-800">Area Visualization</h3>
              </div>
              <div className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden">
                {entry.original_area && (
                  <EncryptedImage
                    src={entry.original_area}
                    alt="Original photo"
                    className="absolute inset-0 w-full h-full object-cover"
                    fallbackIcon="user"
                  />
                )}
                {activeAreaFilter === 'all' ? (
                  SKIN_ATTRIBUTES.map((attr) => {
                    const areaUrl = entry[attr.areaKey as keyof FacialScanReportEntry] as string | null;
                    if (!areaUrl) return null;
                    return (
                      <div key={attr.key} className="absolute inset-0 opacity-60">
                        <EncryptedImage
                          src={areaUrl}
                          alt={`${attr.label} area`}
                          className="w-full h-full object-cover mix-blend-multiply"
                          showFallback={false}
                        />
                      </div>
                    );
                  })
                ) : (
                  (() => {
                    const attr = SKIN_ATTRIBUTES.find(a => a.key === activeAreaFilter);
                    if (!attr) return null;
                    const areaUrl = entry[attr.areaKey as keyof FacialScanReportEntry] as string | null;
                    if (!areaUrl) return null;
                    return (
                      <div className="absolute inset-0 opacity-60">
                        <EncryptedImage src={areaUrl} alt={`${attr.label} area`} className="w-full h-full object-cover mix-blend-multiply" showFallback={false} />
                      </div>
                    );
                  })()
                )}
                {!entry.original_area && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0]">
                    <Camera className="w-16 h-16 text-white/60" />
                  </div>
                )}
              </div>
              {/* Filter Buttons */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Display Filters</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveAreaFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeAreaFilter === 'all' ? 'bg-[#007185] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      All Skin Info
                    </span>
                  </button>
                  {SKIN_ATTRIBUTES.map((attr) => {
                    const rawValue = entry[attr.key as keyof FacialScanReportEntry];
                    const value = rawValue !== null && rawValue !== undefined ? Number(rawValue) : null;
                    const areaUrl = entry[attr.areaKey as keyof FacialScanReportEntry] as string | null;
                    const isActive = activeAreaFilter === attr.key;
                    const hasArea = !!areaUrl;
                    return (
                      <button
                        key={attr.key}
                        type="button"
                        onClick={() => setActiveAreaFilter(attr.key)}
                        disabled={!hasArea}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isActive ? 'text-white shadow-sm' : hasArea ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                        }`}
                        style={isActive ? { backgroundColor: attr.color } : undefined}
                      >
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? 'white' : attr.color }} />
                          {attr.label}
                          {value !== null && !isNaN(value) && value > 0 && (
                            <span className={isActive ? 'text-white/80' : 'text-gray-400'}> ({value.toFixed(0)}%)</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Radar + Details */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-[#007185]" />
                  <h3 className="font-medium text-gray-800">Analysis Overview</h3>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <RadarChart data={problems} size={280} />
                  <p className="text-xs text-gray-500 text-center mt-2">Points closer to edge indicate healthier skin</p>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-5 h-5 text-[#007185]" />
                  <h3 className="font-medium text-gray-800">Detailed Values</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SKIN_ATTRIBUTES.map((attr) => {
                    const rawValue = entry[attr.key as keyof FacialScanReportEntry];
                    const value = rawValue !== null && rawValue !== undefined ? Number(rawValue) : null;
                    if (value === null || isNaN(value) || value === 0) return null;
                    return (
                      <div
                        key={attr.key}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveAreaFilter(attr.key)}
                        onKeyDown={(e) => e.key === 'Enter' && setActiveAreaFilter(attr.key)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          activeAreaFilter === attr.key ? 'border-[#007185] bg-[#007185]/5' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: attr.color }} />
                          <span className="text-sm text-gray-700">{attr.label}</span>
                        </div>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                          value <= 10 ? 'bg-green-100 text-green-700' :
                          value <= 25 ? 'bg-green-50 text-green-600' :
                          value <= 50 ? 'bg-yellow-100 text-yellow-700' :
                          value <= 75 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {value.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#007185] to-[#005a6a] text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-sm">Overall Skin Health</p>
                    <p className="text-3xl font-bold">{avgScore}%</p>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                    <Heart className="w-8 h-8" />
                  </div>
                </div>
                <p className="text-white/70 text-xs mt-2">Based on {problems.length} analyzed areas</p>
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacialScanReportDetailModal;
