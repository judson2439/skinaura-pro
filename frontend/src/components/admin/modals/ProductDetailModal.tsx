/**
 * @fileoverview Product Detail Modal Component
 */

import React, { useState, useEffect } from 'react';
import { X, Edit, Save, Package, Globe, Lock } from 'lucide-react';
import { Product, PRODUCT_CATEGORIES } from '../types';
import EncryptedImage from '@/components/ui/encrypted-image';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  mode: 'view' | 'edit';
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, isOpen, onClose, onSave, mode }) => {
  const [editedProduct, setEditedProduct] = useState<Product | null>(null);
  const [isEditing, setIsEditing] = useState(mode === 'edit');

  useEffect(() => {
    setEditedProduct(product);
    setIsEditing(mode === 'edit');
  }, [product, mode]);

  if (!isOpen || !product || !editedProduct) return null;

  const handleSave = () => {
    if (editedProduct) {
      onSave(editedProduct);
      setIsEditing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            {editedProduct.image_url ? (
              <EncryptedImage
                src={editedProduct.image_url}
                alt={editedProduct.name}
                className="w-12 h-12 rounded-lg object-cover"
                fallbackClassName="w-12 h-12 rounded-lg bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editedProduct.name}</h2>
              <p className="text-sm text-gray-500">{editedProduct.brand || 'No brand'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Product Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProduct.name || ''}
                    onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                  />
                ) : (
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{editedProduct.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedProduct.brand || ''}
                    onChange={(e) => setEditedProduct({ ...editedProduct, brand: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                  />
                ) : (
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{editedProduct.brand || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                {isEditing ? (
                  <select
                    value={editedProduct.category || ''}
                    onChange={(e) => setEditedProduct({ ...editedProduct, category: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    {PRODUCT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{editedProduct.category || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                {isEditing ? (
                  <input
                    type="number"
                    step="0.01"
                    value={editedProduct.price || ''}
                    onChange={(e) => setEditedProduct({ ...editedProduct, price: parseFloat(e.target.value) || null })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                  />
                ) : (
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">
                    {editedProduct.price ? `$${editedProduct.price.toFixed(2)}` : 'N/A'}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                {isEditing ? (
                  <textarea
                    value={editedProduct.description || ''}
                    onChange={(e) => setEditedProduct({ ...editedProduct, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                  />
                ) : (
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{editedProduct.description || 'N/A'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Active</label>
                {isEditing ? (
                  <select
                    value={editedProduct.is_active ? 'true' : 'false'}
                    onChange={(e) => setEditedProduct({ ...editedProduct, is_active: e.target.value === 'true' })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                ) : (
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      editedProduct.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {editedProduct.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Global Product</label>
                {isEditing ? (
                  <select
                    value={editedProduct.is_global ? 'true' : 'false'}
                    onChange={(e) => setEditedProduct({ ...editedProduct, is_global: e.target.value === 'true' })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                  >
                    <option value="true">Global (visible to all)</option>
                    <option value="false">Private (owner only)</option>
                  </select>
                ) : (
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      editedProduct.is_global ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {editedProduct.is_global ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {editedProduct.is_global ? 'Global' : 'Private'}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Skin Types & Concerns */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Target Audience</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Skin Types</label>
                <div className="px-4 py-2.5 bg-gray-50 rounded-xl">
                  {editedProduct.skin_types && editedProduct.skin_types.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {editedProduct.skin_types.map((type, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#CFAFA3]/20 text-[#2D2A3E]"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No skin types specified</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Concerns</label>
                <div className="px-4 py-2.5 bg-gray-50 rounded-xl">
                  {editedProduct.concerns && editedProduct.concerns.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {editedProduct.concerns.map((concern, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
                        >
                          {concern}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No concerns specified</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Owner Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Owner Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Professional</label>
                <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">
                  {editedProduct.professional_name || 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Professional Email</label>
                <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">
                  {editedProduct.professional_email || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Timestamps</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{formatDate(editedProduct.created_at)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{formatDate(editedProduct.updated_at)}</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-500 text-sm font-mono">{editedProduct.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {isEditing && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
            <button
              onClick={() => {
                setEditedProduct(product);
                setIsEditing(false);
              }}
              className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailModal;
