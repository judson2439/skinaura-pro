import React, { useState, useRef } from 'react';
import {
  X,
  Loader2,
  Camera,
  Upload,
  Wand2,
  CheckCircle,
  AlertCircle,
  Check,
} from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import { PRODUCT_CATEGORIES } from './AddProductModal';
import CameraCapture from '@/components/ui/CameraCapture';

// ============================================================================
// TYPES
// ============================================================================

interface AIProductResult {
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  confidence?: 'high' | 'medium' | 'low';
}

interface ClientAIPhotoScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (productData: {
    name: string;
    brand: string | null;
    category: string | null;
    notes: string | null;
    image_url: string | null;
  }, imageFile?: File) => Promise<void>;
  saving?: boolean;
}

// Confidence badge styling
const getConfidenceBadge = (confidence?: string) => {
  switch (confidence) {
    case 'high':
      return 'bg-green-100 text-green-700';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700';
    case 'low':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

const ClientAIPhotoScanModal: React.FC<ClientAIPhotoScanModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  saving = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo states
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIProductResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Camera modal state
  const [showCamera, setShowCamera] = useState(false);

  // Form states
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productNotes, setProductNotes] = useState('');

  const resetForm = () => {
    setPhotoPreview(null);
    setSelectedFile(null);
    setAnalyzing(false);
    setAiResult(null);
    setAiError(null);
    setUploading(false);
    setShowCamera(false);
    setProductName('');
    setProductBrand('');
    setProductCategory('');
    setProductNotes('');
  };

  // Handle camera capture
  const handleCameraCapture = (file: File, previewUrl: string) => {
    setSelectedFile(file);
    setPhotoPreview(previewUrl);
    setShowCamera(false);
    setAiResult(null);
    setAiError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setAiResult(null);
      setAiError(null);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const analyzeProductImage = async () => {
    if (!selectedFile) return;

    setAnalyzing(true);
    setAiError(null);

    try {
      // Get auth token
      const token = getAuthToken();
      
      if (!token) {
        throw new Error('Please log in to use AI product recognition');
      }

      // Convert the image file to base64
      const base64Image = await fileToBase64(selectedFile);

      // Call backend AI product recognition endpoint
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        product?: {
          name?: string;
          brand?: string;
          category?: string;
          description?: string;
          confidence?: string;
        };
        error?: string;
      }>('/api/ai/product-recognition', {
        imageBase64: base64Image,
      }, {
        timeout: 60000, // 60 seconds timeout for AI processing
      });

      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || 'AI analysis failed');
      }

      const productData = data.product;

      if (!productData) {
        throw new Error('No product data in AI response');
      }

      // Parse the response from the backend
      const result: AIProductResult = {
        name: productData.name || undefined,
        brand: productData.brand || undefined,
        category: productData.category || undefined,
        description: productData.description || undefined,
        confidence: (productData.confidence as 'high' | 'medium' | 'low') || 'medium',
      };

      setAiResult(result);

      // Pre-fill form with AI results
      if (result.name) setProductName(result.name);
      if (result.brand) setProductBrand(result.brand);
      if (result.category) {
        // Try to match the category to our predefined categories
        const matchedCategory = PRODUCT_CATEGORIES.find(
          cat => cat.toLowerCase() === result.category?.toLowerCase()
        );
        setProductCategory(matchedCategory || result.category);
      }
      if (result.description) setProductNotes(result.description);
    } catch (error) {
      console.error('AI analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      // Make the error message more user-friendly
      if (errorMessage.includes('fetch failed') || errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('NetworkError') || errorMessage.includes('network')) {
        setAiError('AI service is currently unavailable. Please enter product details manually.');
      } else {
        setAiError(errorMessage);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!productName.trim()) return;

    setUploading(true);
    try {
      await onAdd(
        {
          name: productName.trim(),
          brand: productBrand.trim() || null,
          category: productCategory || null,
          notes: productNotes.trim() || null,
          image_url: null, // Will be set by parent after upload
        },
        selectedFile || undefined
      );
      handleClose();
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg my-8">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          className="hidden"
        />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-serif font-bold flex items-center gap-2">
              <img 
                className="text-[#2D2A3E]" 
                src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} 
                width={20} 
                height={20}
                alt="AI"
              />
              AI Product Scanner
            </h3>
            <p className="text-sm text-gray-500 mt-1">Upload a photo and let AI identify the product</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo Upload Area */}
        <div className="mb-6">
          {photoPreview ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={photoPreview} alt="Product preview" className="w-full h-64 object-cover" />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => {
                    setPhotoPreview(null);
                    setSelectedFile(null);
                    setAiResult(null);
                    setAiError(null);
                  }}
                  className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* AI Scan Button Overlay */}
              {!aiResult && !analyzing && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                  <button
                    onClick={analyzeProductImage}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Wand2 className="w-5 h-5" />
                    Analyze with AI
                  </button>
                </div>
              )}
              {/* Analyzing Overlay */}
              {analyzing && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                  <p className="text-white font-medium">Analyzing product...</p>
                  <p className="text-white/70 text-sm">AI is identifying your product</p>
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gradient-to-br from-purple-50 to-indigo-50">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <p className="text-gray-700 font-medium mb-2">Upload a product photo</p>
              <p className="text-gray-500 text-sm mb-4">
                AI will automatically identify the product name, brand, and category
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={() => setShowCamera(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                >
                  <Camera className="w-4 h-4" /> Take Photo
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-4 h-4" /> Upload Image
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Recognition Result */}
        {aiResult && (
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-green-900">Product Identified!</h4>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getConfidenceBadge(aiResult.confidence)}`}>
                    {aiResult.confidence} confidence
                  </span>
                </div>
                <p className="text-sm text-green-700">
                  {aiResult.name ? `${aiResult.name}` : 'Unknown product'}
                  {aiResult.brand ? ` by ${aiResult.brand}` : ''}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Form fields have been pre-filled. Review and adjust as needed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Error */}
        {aiError && (
          <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-900">Analysis Failed</h4>
                <p className="text-sm text-red-700">{aiError}</p>
                <button
                  onClick={analyzeProductImage}
                  className="mt-2 text-sm text-red-600 font-medium hover:text-red-800"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Name *
              {aiResult?.name && <span className="ml-2 text-xs text-purple-500">(AI detected)</span>}
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none ${
                aiResult?.name ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'
              }`}
              placeholder="e.g., Vitamin C Serum"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand
              {aiResult?.brand && <span className="ml-2 text-xs text-purple-500">(AI detected)</span>}
            </label>
            <input
              type="text"
              value={productBrand}
              onChange={(e) => setProductBrand(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none ${
                aiResult?.brand ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'
              }`}
              placeholder="e.g., The Ordinary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
              {aiResult?.category && <span className="ml-2 text-xs text-purple-500">(AI detected)</span>}
            </label>
            <select
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none ${
                aiResult?.category ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'
              }`}
            >
              <option value="">Select category...</option>
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
              {aiResult?.description && <span className="ml-2 text-xs text-purple-500">(AI detected)</span>}
            </label>
            <textarea
              value={productNotes}
              onChange={(e) => setProductNotes(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none resize-none ${
                aiResult?.description ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'
              }`}
              rows={3}
              placeholder="Any notes about this product..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading || analyzing || !productName.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving || uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploading ? 'Uploading...' : 'Saving...'}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> {selectedFile ? 'Add Product' : 'Add Without Photo'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Camera Capture Modal */}
      <CameraCapture
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};

export default ClientAIPhotoScanModal;
