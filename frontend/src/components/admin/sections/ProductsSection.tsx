/**
 * @fileoverview Admin Products Section Component
 * Displays and manages all products on the platform.
 */

import React, { useState, useEffect } from 'react';
import {
  Package,
  CheckCircle,
  Globe,
  Tag,
  Search,
  Download,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import { Product, PRODUCT_CATEGORIES } from '../types';
import ProductDetailModal from '../modals/ProductDetailModal';
import ProductDeleteModal from '../modals/ProductDeleteModal';
import EncryptedImage from '@/components/ui/encrypted-image';

interface ProductsSectionProps {
  onProductsLoaded?: (products: Product[]) => void;
}

const ProductsSection: React.FC<ProductsSectionProps> = ({ onProductsLoaded }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [productCurrentPage, setProductCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductDetailModalOpen, setIsProductDetailModalOpen] = useState(false);
  const [productDetailModalMode, setProductDetailModalMode] = useState<'view' | 'edit'>('view');
  const [isProductDeleteModalOpen, setIsProductDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const productsPerPage = 10;

  // Fetch products from backend API
  const fetchProducts = async () => {
    const authToken = getAuthToken();
    if (!authToken) return;

    setIsLoadingProducts(true);
    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.get<{
        success: boolean;
        data?: { products: Product[]; total: number };
      }>('/api/admin/products');

      if (response.data.success && response.data.data) {
        setProducts(response.data.data.products || []);
        setTotalProducts(response.data.data.total || 0);
        onProductsLoaded?.(response.data.data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Filter products based on search and filters
  useEffect(() => {
    let filtered = [...products];

    if (productSearchQuery) {
      const query = productSearchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.brand?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.professional_name?.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(product => product.is_active === true);
      } else if (statusFilter === 'inactive') {
        filtered = filtered.filter(product => product.is_active === false);
      } else if (statusFilter === 'global') {
        filtered = filtered.filter(product => product.is_global === true);
      }
    }

    setFilteredProducts(filtered);
    setProductCurrentPage(1);
  }, [products, productSearchQuery, categoryFilter, statusFilter]);

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Paginated products
  const paginatedProducts = filteredProducts.slice(
    (productCurrentPage - 1) * productsPerPage,
    productCurrentPage * productsPerPage
  );

  const totalProductPages = Math.ceil(filteredProducts.length / productsPerPage);

  // Product stats
  const activeProductsCount = products.filter(p => p.is_active).length;
  const globalProductsCount = products.filter(p => p.is_global).length;
  const categoriesCount = new Set(products.map(p => p.category).filter(Boolean)).size;

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductDetailModalMode('view');
    setIsProductDetailModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductDetailModalMode('edit');
    setIsProductDetailModalOpen(true);
  };

  const handleSaveProduct = async (updatedProduct: Product) => {
    const authToken = getAuthToken();
    if (!authToken) return;

    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.put<{
        success: boolean;
        error?: string;
      }>(`/api/admin/products/${updatedProduct.id}`, {
        name: updatedProduct.name,
        brand: updatedProduct.brand,
        category: updatedProduct.category,
        description: updatedProduct.description,
        price: updatedProduct.price,
        is_active: updatedProduct.is_active,
        is_global: updatedProduct.is_global,
      });

      if (response.data.success) {
        setProducts(products.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct, updated_at: new Date().toISOString() } : p));
        setIsProductDetailModalOpen(false);
      } else {
        throw new Error(response.data.error || 'Failed to update product');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Failed to update product. Please try again.');
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setIsProductDeleteModalOpen(true);
  };

  const confirmDeleteProduct = async () => {
    const authToken = getAuthToken();
    if (!productToDelete || !authToken) return;
    
    setIsDeletingProduct(true);
    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.delete<{
        success: boolean;
        error?: string;
      }>(`/api/admin/products/${productToDelete.id}`);

      if (response.data.success) {
        setProducts(products.filter(p => p.id !== productToDelete.id));
        setIsProductDeleteModalOpen(false);
        setProductToDelete(null);
      } else {
        throw new Error(response.data.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product. Please try again.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const handleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAllProducts = () => {
    if (selectedProducts.size === paginatedProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(paginatedProducts.map(p => p.id)));
    }
  };

  const handleBulkDeleteProducts = async () => {
    const authToken = getAuthToken();
    if (selectedProducts.size === 0 || !authToken) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedProducts.size} product(s)?`)) return;

    setIsDeletingProduct(true);
    try {
      apiClient.setAuthToken(authToken);
      const response = await apiClient.post<{
        success: boolean;
        error?: string;
      }>('/api/admin/products/bulk-delete', {
        productIds: Array.from(selectedProducts),
      });

      if (response.data.success) {
        setProducts(products.filter(p => !selectedProducts.has(p.id)));
        setSelectedProducts(new Set());
      } else {
        throw new Error(response.data.error || 'Failed to delete products');
      }
    } catch (error) {
      console.error('Error deleting products:', error);
      alert('Failed to delete products. Please try again.');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const exportProducts = () => {
    const csvContent = [
      ['ID', 'Name', 'Brand', 'Category', 'Price', 'Active', 'Global', 'Professional', 'Created At'].join(','),
      ...filteredProducts.map(product => [
        product.id,
        product.name,
        product.brand || '',
        product.category || '',
        product.price || '',
        product.is_active ? 'Yes' : 'No',
        product.is_global ? 'Yes' : 'No',
        product.professional_name || '',
        product.created_at || '',
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return `${diffMinutes} min ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage all products across the platform ({totalProducts} total products)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportProducts}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={fetchProducts}
            disabled={isLoadingProducts}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex-1 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Search by name, brand, or professional..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-gray-300 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-gray-300 text-sm"
            >
              <option value="all">All Categories</option>
              {PRODUCT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-100 border-0 rounded-xl focus:ring-2 focus:ring-gray-300 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="global">Global</option>
            </select>
          </div>

          {selectedProducts.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{selectedProducts.size} selected</span>
              <button
                onClick={handleBulkDeleteProducts}
                disabled={isDeletingProduct}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
              <p className="text-xs text-gray-500">Total Products</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeProductsCount}</p>
              <p className="text-xs text-gray-500">Active Products</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{globalProductsCount}</p>
              <p className="text-xs text-gray-500">Global Products</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Tag className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{categoriesCount}</p>
              <p className="text-xs text-gray-500">Categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoadingProducts ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProducts.size === paginatedProducts.length && paginatedProducts.length > 0}
                        onChange={handleSelectAllProducts}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Product</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Category</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Price</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Professional</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Created</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.id)}
                          onChange={() => handleSelectProduct(product.id)}
                          className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <EncryptedImage
                              src={product.image_url}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover"
                              fallbackClassName="w-10 h-10 rounded-lg bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
                              <Package className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.brand || 'No brand'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#CFAFA3]/20 text-[#2D2A3E]">
                          {product.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {product.price ? `$${product.price.toFixed(2)}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {product.is_global && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              <Globe className="w-3 h-3" />
                              Global
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-gray-900">{product.professional_name || 'N/A'}</p>
                          <p className="text-xs text-gray-500">{product.professional_email || ''}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(product.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleViewProduct(product)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <button 
                            onClick={() => handleEditProduct(product)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4 text-gray-500" />
                          </button>
                          {product.purchase_url && (
                            <a
                              href={product.purchase_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View Product URL"
                            >
                              <ExternalLink className="w-4 h-4 text-gray-500" />
                            </a>
                          )}
                          <button 
                            onClick={() => handleDeleteProduct(product)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {((productCurrentPage - 1) * productsPerPage) + 1} to {Math.min(productCurrentPage * productsPerPage, filteredProducts.length)} of {filteredProducts.length} products
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setProductCurrentPage(p => Math.max(1, p - 1))}
                  disabled={productCurrentPage === 1}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalProductPages) }, (_, i) => {
                    let pageNum;
                    if (totalProductPages <= 5) {
                      pageNum = i + 1;
                    } else if (productCurrentPage <= 3) {
                      pageNum = i + 1;
                    } else if (productCurrentPage >= totalProductPages - 2) {
                      pageNum = totalProductPages - 4 + i;
                    } else {
                      pageNum = productCurrentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setProductCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          productCurrentPage === pageNum
                            ? 'bg-gray-900 text-white'
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setProductCurrentPage(p => Math.min(totalProductPages, p + 1))}
                  disabled={productCurrentPage === totalProductPages}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Product Modals */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={isProductDetailModalOpen}
        onClose={() => setIsProductDetailModalOpen(false)}
        onSave={handleSaveProduct}
        mode={productDetailModalMode}
      />

      <ProductDeleteModal
        product={productToDelete}
        isOpen={isProductDeleteModalOpen}
        onClose={() => {
          setIsProductDeleteModalOpen(false);
          setProductToDelete(null);
        }}
        onConfirm={confirmDeleteProduct}
        isDeleting={isDeletingProduct}
      />
    </div>
  );
};

export default ProductsSection;
