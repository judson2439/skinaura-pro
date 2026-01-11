import React, { useRef, useState, useEffect } from 'react';
import { X, Check, Loader2, Camera, Upload, Trash2 } from 'lucide-react';
import { PRODUCT_CATEGORIES } from './AddProductModal';
import { EncryptedImage } from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  notes?: string;
  image_url?: string;
  added_via?: 'manual' | 'photo';
  created_at: string;
}

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (imageFile?: File, removeImage?: boolean) => void;
  saving: boolean;
  uploading?: boolean;
  product: Product | null;
  productName: string;
  setProductName: (value: string) => void;
  productBrand: string;
  setProductBrand: (value: string) => void;
  productCategory: string;
  setProductCategory: (value: string) => void;
  productNotes: string;
  setProductNotes: (value: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  saving,
  uploading = false,
  product,
  productName,
  setProductName,
  productBrand,
  setProductBrand,
  productCategory,
  setProductCategory,
  productNotes,
  setProductNotes,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Local state for new image
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  // Reset local state when modal opens/closes or product changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPhotoPreview(null);
      setRemoveExistingImage(false);
    }
  }, [isOpen]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setRemoveExistingImage(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveNewPhoto = () => {
    setSelectedFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleRemoveExistingImage = () => {
    setRemoveExistingImage(true);
    setSelectedFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = () => {
    onSubmit(selectedFile || undefined, removeExistingImage);
  };

  if (!isOpen || !product) return null;

  // Determine what image to show
  const showNewPreview = photoPreview !== null;
  const showExistingImage = !showNewPreview && !removeExistingImage && product.image_url;
  const showUploadArea = !showNewPreview && (removeExistingImage || !product.image_url);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md my-8">
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
          <h3 className="text-xl font-serif font-bold">Edit Product</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Image Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Image
            </label>

            {/* Show new preview */}
            {showNewPreview && (
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <img 
                  src={photoPreview!} 
                  alt="New product preview" 
                  className="w-full h-40 object-cover"
                />
                <button
                  onClick={handleRemoveNewPhoto}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                  title="Remove new image"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                  New Image
                </div>
              </div>
            )}

            {/* Show existing image */}
            {showExistingImage && (
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <EncryptedImage 
                  src={product.image_url} 
                  alt={product.name} 
                  className="w-full h-40 object-cover"
                  fallbackIcon="package"
                  showFallback={true}
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                    title="Change image"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleRemoveExistingImage}
                    className="p-1.5 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition-colors"
                    title="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Show upload area when no image */}
            {showUploadArea && (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50/50">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Camera className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  {removeExistingImage ? 'Image removed. Add a new one?' : 'Add a photo of your product'}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 text-white text-sm rounded-lg font-medium hover:bg-teal-600 transition-colors"
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
                {removeExistingImage && (
                  <button
                    type="button"
                    onClick={() => setRemoveExistingImage(false)}
                    className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Undo removal
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
            <input
              type="text"
              value={productBrand}
              onChange={(e) => setProductBrand(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none"
            >
              <option value="">Select category...</option>
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={productNotes}
              onChange={(e) => setProductNotes(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || uploading || !productName.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving || uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploading ? 'Uploading...' : 'Saving...'}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;
