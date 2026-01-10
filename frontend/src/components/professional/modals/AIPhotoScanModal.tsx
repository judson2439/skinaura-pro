import React, { useState, useRef } from 'react';
import {
  X,
  Loader2,
  DollarSign,
  Camera,
  Upload,
  Sparkles,
  Wand2,
  CheckCircle,
  AlertCircle,
  Check,
  Link,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  SKIN_TYPES,
  AIProductResult,
  getConfidenceBadge,
} from './productLibraryTypes';
import { apiClient } from '@/lib/apiClient';
import { getAuthSession, getAuthToken } from '@/lib/authStorage';

// ============================================================================
// TYPES
// ============================================================================

interface AIPhotoScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: {
    name: string;
    brand: string;
    category: string;
    description?: string;
    price?: number;
    image_url?: string;
    purchase_url?: string;
    ingredients: string[];
    skin_types: string[];
    usage_instructions?: string;
  }, imageFile?: File) => Promise<void>;
  saving?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AIPhotoScanModal: React.FC<AIPhotoScanModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  saving = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Photo states
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIProductResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productIngredients, setProductIngredients] = useState('');
  const [productSkinTypes, setProductSkinTypes] = useState<string[]>([]);
  const [productInstructions, setProductInstructions] = useState('');
  const [productUrl, setProductUrl] = useState('');

  const resetForm = () => {
    setPhotoPreview(null);
    setSelectedFile(null);
    setAnalyzing(false);
    setAiResult(null);
    setAiError(null);
    setUploading(false);
    setProductName('');
    setProductBrand('');
    setProductCategory('');
    setProductDescription('');
    setProductPrice('');
    setProductIngredients('');
    setProductSkinTypes([]);
    setProductInstructions('');
    setProductUrl('');
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
      const authSession = getAuthSession();
      const token = authSession?.token || getAuthToken();
      
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
          ingredients?: string[];
          skinTypes?: string[];
          usageInstructions?: string;
          confidence?: string;
        };
        error?: string;
      }>('/api/ai/product-recognition', {
        imageBase64: base64Image,
      }, {
        timeout: 60000, // 60 seconds timeout for AI processing
      });

      const data = response.data;
      console.log('AI product recognition response:', data);

      if (!data.success) {
        throw new Error(data.error || 'AI analysis failed');
      }

      const productData = data.product;
      console.log('Product data from AI:', productData);

      if (!productData) {
        throw new Error('No product data in AI response');
      }

      // Parse the response from the backend
      const result: AIProductResult = {
        name: productData.name || undefined,
        brand: productData.brand || undefined,
        category: productData.category || undefined,
        description: productData.description || undefined,
        ingredients: productData.ingredients || [],
        skinTypes: productData.skinTypes || [],
        usageInstructions: productData.usageInstructions || undefined,
        confidence: (productData.confidence as 'high' | 'medium' | 'low') || 'medium',
      };

      console.log('Parsed AI result:', result);
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
      if (result.description) setProductDescription(result.description);
      if (result.ingredients && result.ingredients.length > 0) {
        setProductIngredients(result.ingredients.join(', '));
      }
      if (result.skinTypes && result.skinTypes.length > 0) {
        console.log('AI returned skinTypes:', result.skinTypes);
        // Map AI skin types to our predefined skin types
        const mappedSkinTypes: string[] = [];
        result.skinTypes.forEach(type => {
          // Try exact match first (case-insensitive)
          const exactMatch = SKIN_TYPES.find(
            st => st.toLowerCase() === type.toLowerCase()
          );
          if (exactMatch) {
            mappedSkinTypes.push(exactMatch);
          } else {
            // Try partial match
            const partialMatch = SKIN_TYPES.find(
              st => st.toLowerCase().includes(type.toLowerCase()) || 
                    type.toLowerCase().includes(st.toLowerCase())
            );
            if (partialMatch) {
              mappedSkinTypes.push(partialMatch);
            }
          }
        });
        console.log('Mapped skinTypes:', mappedSkinTypes);
        if (mappedSkinTypes.length > 0) {
          setProductSkinTypes(mappedSkinTypes);
        }
      }
      if (result.usageInstructions) {
        console.log('AI returned usageInstructions:', result.usageInstructions);
        setProductInstructions(result.usageInstructions);
      }
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




  const toggleSkinType = (type: string) => {
    setProductSkinTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    if (!productName.trim() || !productBrand.trim() || !productCategory) return;

    setUploading(true);
    try {
      await onAdd(
        {
          name: productName.trim(),
          brand: productBrand.trim(),
          category: productCategory,
          description: productDescription.trim() || undefined,
          price: productPrice ? parseFloat(productPrice) : undefined,
          purchase_url: productUrl.trim() || undefined,
          ingredients: productIngredients
            .split(',')
            .map(i => i.trim())
            .filter(Boolean),
          skin_types: productSkinTypes,
          usage_instructions: productInstructions.trim() || undefined,
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
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8">
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          className="hidden"
        />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelect}
          className="hidden"
        />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-serif font-bold flex items-center gap-2">
              <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={20} height={20}/>
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
                  onClick={() => photoInputRef.current?.click()}
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
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Name *
              {aiResult?.name && <span className="ml-2 text-xs text-purple-500">(AI detected)</span>}
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none ${
                aiResult?.name ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'
              }`}
              placeholder="e.g., Vitamin C Serum"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Brand *
              {aiResult?.brand && <span className="ml-2 text-xs text-purple-500">(AI detected)</span>}
            </label>
            <input
              type="text"
              value={productBrand}
              onChange={(e) => setProductBrand(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none ${
                aiResult?.brand ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'
              }`}
              placeholder="e.g., The Ordinary"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
              {aiResult?.category && <span className="ml-2 text-xs text-purple-500">(AI detected)</span>}
            </label>
            <select
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none ${
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Price (Optional)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                step="0.01"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
            {aiResult?.description && <span className="ml-2 text-xs text-purple-500">(AI detected)</span>}
          </label>
          <textarea
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none ${
              aiResult?.description ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'
            }`}
            rows={2}
            placeholder="Brief product description..."
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Key Ingredients (comma-separated)
            {aiResult?.ingredients && aiResult.ingredients.length > 0 && (
              <span className="ml-2 text-xs text-purple-500">(AI detected)</span>
            )}
          </label>
          <textarea
            value={productIngredients}
            onChange={(e) => setProductIngredients(e.target.value)}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none ${
              aiResult?.ingredients && aiResult.ingredients.length > 0 ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'
            }`}
            rows={2}
            placeholder="e.g., Vitamin C, Hyaluronic Acid, Niacinamide"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Skin Type Compatibility
            {aiResult?.skinTypes && aiResult.skinTypes.length > 0 && (
              <span className="ml-2 text-xs text-purple-500">(AI detected)</span>
            )}
          </label>
          <div className="flex flex-wrap gap-2">
            {SKIN_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => toggleSkinType(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  productSkinTypes.includes(type)
                    ? 'bg-[#CFAFA3] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Usage Instructions
            {aiResult?.usageInstructions && (
              <span className="ml-2 text-xs text-purple-500">(AI detected)</span>
            )}
          </label>
          <textarea
            value={productInstructions}
            onChange={(e) => setProductInstructions(e.target.value)}
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none ${
              aiResult?.usageInstructions ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'
            }`}
            rows={2}
            placeholder="e.g., Apply 3-4 drops to clean skin morning and evening..."
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Purchase URL (Optional)</label>
          <div className="relative">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none transition-all"
              placeholder="https://..."
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
            disabled={saving || uploading || analyzing || !productName.trim() || !productBrand.trim() || !productCategory}
            className="flex-1 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    </div>
  );
};

export default AIPhotoScanModal;
