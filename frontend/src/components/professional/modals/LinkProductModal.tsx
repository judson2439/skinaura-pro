import React, { useState, useEffect } from 'react';
import { X, Link2, Package, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import EncryptedImage from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  price: number | null;
  currency: string | null;
}

interface LinkedProduct {
  id: string;
  routine_step_id: string;
  product_id: string;
  notes: string | null;
  product?: Product;
}

interface LinkProductModalProps {
  isOpen: boolean;
  stepId: string;
  stepName: string;
  professionalId: string;
  existingLink?: LinkedProduct | null;
  onClose: () => void;
  onSave: (linkedProduct: LinkedProduct) => void;
  onUnlink: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const LinkProductModal: React.FC<LinkProductModalProps> = ({
  isOpen,
  stepId,
  stepName,
  professionalId,
  existingLink,
  onClose,
  onSave,
  onUnlink,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch products when modal opens
  useEffect(() => {
    if (isOpen && professionalId) {
      fetchProducts();
    }
  }, [isOpen, professionalId]);

  // Set existing link data when modal opens
  useEffect(() => {
    if (isOpen && existingLink) {
      setSelectedProductId(existingLink.product_id);
      setNotes(existingLink.notes || '');
    } else if (isOpen) {
      setSelectedProductId('');
      setNotes('');
    }
  }, [isOpen, existingLink]);

  const fetchProducts = async () => {
    const token = getAuthToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { products: Product[] };
        error?: string;
      }>('/api/professional/products/list');

      if (response.data.success && response.data.data) {
        setProducts(response.data.data.products);
      } else {
        console.error('Error fetching products:', response.data.error);
        setError('Failed to load products');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProductId) {
      setError('Please select a product');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      apiClient.setAuthToken(token);

      if (existingLink) {
        // Update existing link
        const response = await apiClient.put<{
          success: boolean;
          data?: { linkedProduct: LinkedProduct };
          error?: string;
        }>(`/api/professional/routine-step-products/${existingLink.id}`, {
          product_id: selectedProductId,
          notes: notes || null,
        });

        if (response.data.success && response.data.data) {
          onSave(response.data.data.linkedProduct);
        } else {
          throw new Error(response.data.error || 'Failed to update product link');
        }
      } else {
        // Create new link
        const response = await apiClient.post<{
          success: boolean;
          data?: { linkedProduct: LinkedProduct };
          error?: string;
        }>(`/api/professional/routine-steps/${stepId}/link-product`, {
          product_id: selectedProductId,
          notes: notes || null,
        });

        if (response.data.success && response.data.data) {
          onSave(response.data.data.linkedProduct);
        } else {
          throw new Error(response.data.error || 'Failed to link product');
        }
      }

      handleClose();
    } catch (err) {
      console.error('Error saving product link:', err);
      setError('Failed to save product link');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!existingLink) return;

    const token = getAuthToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.delete<{
        success: boolean;
        error?: string;
      }>(`/api/professional/routine-step-products/${existingLink.id}`);

      if (response.data.success) {
        onUnlink();
        handleClose();
      } else {
        throw new Error(response.data.error || 'Failed to unlink product');
      }
    } catch (err) {
      console.error('Error unlinking product:', err);
      setError('Failed to unlink product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setSelectedProductId('');
    setNotes('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#CFAFA3]/20 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-[#CFAFA3]" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold">Link Product</h3>
              <p className="text-sm text-gray-500">Step: {stepName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Product *
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none text-sm"
              >
                <option value="">Choose a product...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.brand ? `${product.brand} - ` : ''}{product.name}
                    {product.category ? ` (${product.category})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Product Preview */}
            {selectedProduct && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                {selectedProduct.image_url ? (
                  <EncryptedImage
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-12 h-12 rounded-lg object-cover"
                    fallbackClassName="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{selectedProduct.name}</p>
                  {selectedProduct.brand && (
                    <p className="text-xs text-gray-500">{selectedProduct.brand}</p>
                  )}
                  {selectedProduct.price && (
                    <p className="text-xs text-[#CFAFA3] font-medium">
                      {selectedProduct.currency || 'USD'} {Number(selectedProduct.price).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none text-sm resize-none"
                rows={3}
                placeholder="Add any special instructions or notes about this product..."
              />
            </div>

            {/* No Products Message */}
            {products.length === 0 && (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No products available</p>
                <p className="text-xs text-gray-400 mt-1">Add products to your library first</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
          {existingLink && (
            <button
              onClick={handleUnlink}
              disabled={isSaving}
              className="px-4 py-3 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Unlink
            </button>
          )}
          <button
            onClick={handleClose}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedProductId}
            className="flex-1 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                {existingLink ? 'Update Link' : 'Link Product'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkProductModal;
