import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, DollarSign, Camera, Link, Check } from 'lucide-react';
import { Product, PRODUCT_CATEGORIES, SKIN_TYPES } from './productLibraryTypes';
import { EncryptedImage } from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface EditProductModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onUpdate: (
    productId: string,
    data: Partial<Product>,
    imageFile?: File
  ) => Promise<void>;
  saving?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  product,
  onClose,
  onUpdate,
  saving = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [productIngredients, setProductIngredients] = useState('');
  const [productSkinTypes, setProductSkinTypes] = useState<string[]>([]);
  const [productInstructions, setProductInstructions] = useState('');

  // Photo states
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLocalPreview, setIsLocalPreview] = useState(false); // true if preview is from local file selection
  const [uploading, setUploading] = useState(false);

  // Initialize form with product data
  useEffect(() => {
    if (product) {
      setProductName(product.name);
      setProductBrand(product.brand);
      setProductCategory(product.category);
      setProductDescription(product.description || '');
      setProductPrice(product.price?.toString() || '');
      setProductUrl(product.purchase_url || '');
      setProductIngredients(product.ingredients.join(', '));
      setProductSkinTypes(product.skin_types);
      setProductInstructions(product.usage_instructions || '');
      setPhotoPreview(product.image_url || null);
      setIsLocalPreview(false); // Reset - this is an existing encrypted image
    }
  }, [product]);

  const resetForm = () => {
    setProductName('');
    setProductBrand('');
    setProductCategory('');
    setProductDescription('');
    setProductPrice('');
    setProductUrl('');
    setProductIngredients('');
    setProductSkinTypes([]);
    setProductInstructions('');
    setPhotoPreview(null);
    setSelectedFile(null);
    setIsLocalPreview(false);
    setUploading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsLocalPreview(true); // Mark as local file preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleSkinType = (type: string) => {
    setProductSkinTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    if (!product || !productName.trim() || !productBrand.trim() || !productCategory) return;

    setUploading(true);
    try {
      await onUpdate(
        product.id,
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
          image_url: isLocalPreview ? undefined : product.image_url,
        },
        selectedFile || undefined
      );
      handleClose();
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          className="hidden"
        />

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif font-bold">Edit Product</h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current/New Image */}
        <div className="mb-6">
          {photoPreview ? (
            <div className="relative rounded-xl overflow-hidden">
              {isLocalPreview ? (
                // Local file preview - use regular img tag
                <img src={photoPreview} alt="Product" className="w-full h-48 object-cover" />
              ) : (
                // Existing encrypted image - use EncryptedImage component
                <EncryptedImage
                  src={photoPreview}
                  alt="Product"
                  className="w-full h-48 object-cover"
                  fallbackIcon="package"
                  showFallback={true}
                />
              )}
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white/90 text-gray-700 rounded-lg text-sm font-medium hover:bg-white transition-colors flex items-center gap-1"
                >
                  <Camera className="w-4 h-4" /> Change Photo
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#CFAFA3] transition-colors"
            >
              <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Click to add a product photo</p>
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
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand *</label>
            <input
              type="text"
              value={productBrand}
              onChange={(e) => setProductBrand(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
            <select
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
            >
              <option value="">Select category...</option>
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="number"
                step="0.01"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
            rows={2}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Key Ingredients (comma-separated)</label>
          <textarea
            value={productIngredients}
            onChange={(e) => setProductIngredients(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
            rows={2}
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
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
            rows={2}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Purchase URL</label>
          <div className="relative">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading || !productName.trim() || !productBrand.trim() || !productCategory}
            className="flex-1 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving || uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;

