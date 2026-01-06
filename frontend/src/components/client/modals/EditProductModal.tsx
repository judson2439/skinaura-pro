import React from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { PRODUCT_CATEGORIES } from './AddProductModal';

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
  added_via: 'manual' | 'photo';
  created_at: string;
}

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
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
  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif font-bold">Edit Product</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Show existing image if available */}
        {product.image_url && (
          <div className="mb-4 rounded-xl overflow-hidden">
            <img src={product.image_url} alt={product.name} className="w-full h-32 object-cover" />
          </div>
        )}

        <div className="space-y-4">
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
            onClick={onSubmit}
            disabled={saving || !productName.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;

