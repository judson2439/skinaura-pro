import React, { useRef, useState } from 'react';
import { X, Plus, Loader2, Camera, Upload, Image as ImageIcon } from 'lucide-react';
import EncryptedImage from '@/components/ui/encrypted-image';
import CameraCapture from '@/components/ui/CameraCapture';

// ============================================================================
// CONSTANTS
// ============================================================================

export const PRODUCT_CATEGORIES = [
  'Cleanser',
  'Toner',
  'Serum',
  'Moisturizer',
  'Sunscreen',
  'Eye Cream',
  'Mask',
  'Exfoliant',
  'Treatment',
  'Oil',
  'Mist',
  'Other',
];

// ============================================================================
// TYPES
// ============================================================================

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (imageFile?: File) => void;
  saving: boolean;
  uploading?: boolean;
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

const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  saving,
  uploading = false,
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
  
  // Local state for image
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Camera modal state
  const [showCamera, setShowCamera] = useState(false);

  // Reset local state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPhotoPreview(null);
      setShowCamera(false);
    }
  }, [isOpen]);

  // Handle camera capture
  const handleCameraCapture = (file: File, previewUrl: string) => {
    setSelectedFile(file);
    setPhotoPreview(previewUrl);
    setShowCamera(false);
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
    }
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = () => {
    onSubmit(selectedFile || undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md my-8">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          className="hidden"
        />

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif font-bold">Add Product</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Image Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Image (Optional)
            </label>
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <EncryptedImage 
                  src={photoPreview} 
                  alt="Product preview" 
                  className="w-full h-40 object-cover"
                  fallbackClassName="w-full h-40 object-cover bg-[#CFAFA3]/20 flex items-center justify-center"
                />
                <button
                  onClick={handleRemovePhoto}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50/50">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mb-3">Add a photo of your product</p>
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
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
              rows={3}
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
                <Plus className="w-4 h-4" />
                Add Product
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

export default AddProductModal;
