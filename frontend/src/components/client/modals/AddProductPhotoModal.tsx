import React, { useRef } from 'react';
import { X, Check, Loader2, Camera, Upload } from 'lucide-react';
import { PRODUCT_CATEGORIES } from './AddProductModal';

// ============================================================================
// TYPES
// ============================================================================

interface AddProductPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  uploading: boolean;
  productName: string;
  setProductName: (value: string) => void;
  productBrand: string;
  setProductBrand: (value: string) => void;
  productCategory: string;
  setProductCategory: (value: string) => void;
  productNotes: string;
  setProductNotes: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  photoPreview: string | null;
  setPhotoPreview: (preview: string | null) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AddProductPhotoModal: React.FC<AddProductPhotoModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  saving,
  uploading,
  productName,
  setProductName,
  productBrand,
  setProductBrand,
  productCategory,
  setProductCategory,
  productNotes,
  setProductNotes,
  selectedFile,
  setSelectedFile,
  photoPreview,
  setPhotoPreview,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoPreview(null);
    setSelectedFile(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
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

      <div className="bg-white rounded-2xl p-6 w-full max-w-md my-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif font-bold">Add Product with Photo</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo Upload Area */}
        <div className="mb-6">
          {photoPreview ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={photoPreview} alt="Product preview" className="w-full h-48 object-cover" />
              <button
                onClick={clearPhoto}
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-teal-600" />
              </div>
              <p className="text-gray-600 mb-4">Take a photo or upload an image of your product</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition-colors"
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

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none"
              placeholder="e.g., Vitamin C Serum"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
            <input
              type="text"
              value={productBrand}
              onChange={(e) => setProductBrand(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none"
              placeholder="e.g., The Ordinary"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={productNotes}
              onChange={(e) => setProductNotes(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none resize-none"
              rows={2}
              placeholder="Any notes about this product..."
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
            onClick={onSubmit}
            disabled={saving || uploading || !productName.trim() || !selectedFile}
            className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving || uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploading ? 'Uploading...' : 'Saving...'}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> Add Product
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProductPhotoModal;

