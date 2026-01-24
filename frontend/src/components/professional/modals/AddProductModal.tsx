import React, { useState, useRef } from 'react';
import { X, Plus, Loader2, DollarSign, Image as ImageIcon, Link, Upload, Camera } from 'lucide-react';
import { PRODUCT_CATEGORIES, SKIN_TYPES } from './productLibraryTypes';
import { CustomSelect, createOptions } from '@/components/ui/custom-select';
import CameraCapture from '@/components/ui/CameraCapture';

// ============================================================================
// TYPES
// ============================================================================

interface AddProductModalProps {
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

const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  saving = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [productIngredients, setProductIngredients] = useState('');
  const [productSkinTypes, setProductSkinTypes] = useState<string[]>([]);
  const [productInstructions, setProductInstructions] = useState('');

  // Image upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Camera modal state
  const [showCamera, setShowCamera] = useState(false);

  // Category options for select
  const categoryOptions = [
    { value: '', label: 'Select category...' },
    ...createOptions([...PRODUCT_CATEGORIES])
  ];

  const resetForm = () => {
    setProductName('');
    setProductBrand('');
    setProductCategory('');
    setProductDescription('');
    setProductPrice('');
    setProductImageUrl('');
    setProductUrl('');
    setProductIngredients('');
    setProductSkinTypes([]);
    setProductInstructions('');
    setSelectedFile(null);
    setImagePreview(null);
    setShowCamera(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Handle camera capture
  const handleCameraCapture = (file: File, previewUrl: string) => {
    setSelectedFile(file);
    setImagePreview(previewUrl);
    setShowCamera(false);
    // Clear URL input when file is captured
    setProductImageUrl('');
  };

  const toggleSkinType = (type: string) => {
    setProductSkinTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Clear URL input when file is selected
      setProductImageUrl('');
    }
  };

  const clearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!productName.trim() || !productBrand.trim() || !productCategory) return;

    await onAdd(
      {
        name: productName.trim(),
        brand: productBrand.trim(),
        category: productCategory,
        description: productDescription.trim() || undefined,
        price: productPrice ? parseFloat(productPrice) : undefined,
        image_url: productImageUrl.trim() || undefined,
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-xl font-serif font-bold">Add New Product</h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Image Upload Section */}
          <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
          {imagePreview ? (
            <div className="relative w-full h-48 rounded-xl overflow-hidden bg-gray-100">
              <img
                src={imagePreview}
                alt="Product preview"
                className="w-full h-full object-cover"
              />
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50/50">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <ImageIcon className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-3">Add a photo of your product</p>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#CFAFA3] text-white text-sm rounded-lg font-medium hover:bg-[#B89A8E] transition-colors"
                >
                  <Camera className="w-4 h-4" /> Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  <Upload className="w-4 h-4" /> Upload
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3">PNG, JPG up to 10MB</p>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
              placeholder="e.g., Vitamin C Brightening Serum"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand *</label>
            <input
              type="text"
              value={productBrand}
              onChange={(e) => setProductBrand(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
              placeholder="e.g., SkinAura Essentials"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
            <CustomSelect
              value={productCategory}
              onChange={(value) => setProductCategory(value)}
              options={categoryOptions}
              placeholder="Select category..."
            />
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
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none resize-none transition-all"
            rows={2}
            placeholder="Brief product description..."
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Key Ingredients (comma-separated)</label>
          <textarea
            value={productIngredients}
            onChange={(e) => setProductIngredients(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none resize-none transition-all"
            rows={2}
            placeholder="e.g., Vitamin C, Hyaluronic Acid, Niacinamide"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Skin Type Compatibility</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Usage Instructions</label>
          <textarea
            value={productInstructions}
            onChange={(e) => setProductInstructions(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none resize-none transition-all"
            rows={2}
            placeholder="e.g., Apply 3-4 drops to clean skin morning and evening..."
          />
        </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image URL {selectedFile ? '(Using uploaded image)' : '(Optional)'}
              </label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={productImageUrl}
                  onChange={(e) => setProductImageUrl(e.target.value)}
                  disabled={!!selectedFile}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none disabled:bg-gray-100 disabled:text-gray-400 transition-all"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Purchase URL (Optional)</label>
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="flex gap-3 p-6 pt-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !productName.trim() || !productBrand.trim() || !productCategory}
            className="flex-1 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Product
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

export default AddProductModal;
