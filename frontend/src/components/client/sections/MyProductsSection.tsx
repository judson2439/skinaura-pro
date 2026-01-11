import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Package,
  Edit,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import AddProductModal, { PRODUCT_CATEGORIES } from '../modals/AddProductModal';
import ClientAIPhotoScanModal from '../modals/ClientAIPhotoScanModal';
import EditProductModal from '../modals/EditProductModal';
import { EncryptedImage } from '@/components/ui/encrypted-image';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/lib/encryption';

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  client_id: string;
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  notes?: string;
  image_url?: string;
  purchase_date?: string;
  expiry_date?: string;
  is_active?: boolean;
  rating?: number;
  created_at: string;
  updated_at?: string;
  added_via: 'manual' | 'photo';
}

interface DeleteConfirmation {
  id: string;
  name: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const MyProductsSection: React.FC = () => {
  const { toast } = useToast();
  
  // Get auth token for API calls
  const authToken = getAuthToken();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAIPhotoModal, setShowAIPhotoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states (for manual add/edit modals)
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productNotes, setProductNotes] = useState('');

  // ============================================================================
  // FETCH PRODUCTS
  // ============================================================================

  const fetchProducts = async () => {
    const token = getAuthToken();
    if (!token) return;

    try {
      setLoading(true);
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { products: Product[] };
        error?: string;
      }>('/api/client/products');

      if (!response.data.success) {
        console.error('Error fetching products:', response.data.error);
        toast({
          title: 'Error',
          description: 'Failed to load products. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setProducts(response.data.data?.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to load products. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [authToken]);

  // ============================================================================
  // UPLOAD IMAGE
  // ============================================================================

  const uploadProductImage = async (file: File): Promise<string | null> => {
    const token = getAuthToken();
    if (!token) return null;

    try {
      // Use the uploadImage utility from encryption.ts
      const response = await uploadImage(file, 'products', token);

      if (!response.success || !response.data?.image_url) {
        console.error('Upload error:', response.error);
        return null;
      }

      return response.data.image_url;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  // ============================================================================
  // DELETE IMAGE
  // ============================================================================

  const deleteProductImage = async (imageUrl: string): Promise<void> => {
    const token = getAuthToken();
    if (!token) return;

    try {
      // Extract category and filename from URL like /api/images/products/filename.enc
      const match = imageUrl.match(/\/api\/images\/(\w+)\/([^/]+)$/);
      if (!match) return;

      const [, category, filename] = match;
      
      apiClient.setAuthToken(token);
      await apiClient.delete(`/api/images/${category}/${filename}`);
    } catch (error) {
      console.error('Image delete error:', error);
    }
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.brand?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Reset form
  const resetForm = () => {
    setProductName('');
    setProductBrand('');
    setProductCategory('');
    setProductNotes('');
  };

  // ============================================================================
  // ADD PRODUCT MANUALLY (with optional image)
  // ============================================================================

  const handleAddProduct = async (imageFile?: File) => {
    const token = getAuthToken();
    if (!productName.trim() || !token) return;
    setSaving(true);

    try {
      // Step 1: Upload image if provided
      let imageUrl: string | null = null;
      if (imageFile) {
        setUploading(true);
        const uploadedUrl = await uploadProductImage(imageFile);
        setUploading(false);
        
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      // Step 2: Create product
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { product: Product };
        error?: string;
      }>('/api/client/products', {
        name: productName.trim(),
        brand: productBrand.trim() || null,
        category: productCategory || null,
        notes: productNotes.trim() || null,
        image_url: imageUrl,
      });

      if (!response.data.success || !response.data.data?.product) {
        console.error('Error adding product:', response.data.error);
        // Delete uploaded image if product insert fails
        if (imageUrl) {
          await deleteProductImage(imageUrl);
        }
        toast({
          title: 'Error',
          description: 'Failed to add product. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Add to local state
      setProducts(prev => [response.data.data!.product, ...prev]);
      setShowAddModal(false);
      resetForm();

      toast({
        title: 'Success',
        description: 'Product added successfully!',
      });
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: 'Error',
        description: 'Failed to add product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // ============================================================================
  // ADD PRODUCT FROM AI PHOTO SCAN
  // ============================================================================

  const handleAddProductFromAI = async (
    productData: {
      name: string;
      brand: string | null;
      category: string | null;
      notes: string | null;
      image_url: string | null;
    },
    imageFile?: File
  ) => {
    const token = getAuthToken();
    if (!productData.name.trim() || !token) return;
    setSaving(true);

    try {
      // Step 1: Upload image if provided
      let imageUrl = productData.image_url;
      if (imageFile) {
        setUploading(true);
        const uploadedUrl = await uploadProductImage(imageFile);
        setUploading(false);
        
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      // Step 2: Insert product with image URL
      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { product: Product };
        error?: string;
      }>('/api/client/products', {
        name: productData.name.trim(),
        brand: productData.brand || null,
        category: productData.category || null,
        notes: productData.notes || null,
        image_url: imageUrl,
      });

      if (!response.data.success || !response.data.data?.product) {
        console.error('Error adding product:', response.data.error);
        // Delete uploaded image if product insert fails
        if (imageUrl && imageUrl !== productData.image_url) {
          await deleteProductImage(imageUrl);
        }
        toast({
          title: 'Error',
          description: 'Failed to add product. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Add to local state
      setProducts(prev => [response.data.data!.product, ...prev]);
      setShowAIPhotoModal(false);

      toast({
        title: 'Success',
        description: 'Product added successfully!',
      });
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: 'Error',
        description: 'Failed to add product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // Open edit modal
  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setProductName(product.name);
    setProductBrand(product.brand || '');
    setProductCategory(product.category || '');
    setProductNotes(product.notes || '');
    setShowEditModal(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedProduct(null);
    resetForm();
  };

  // Close add modal
  const closeAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  // ============================================================================
  // UPDATE PRODUCT
  // ============================================================================

  const handleUpdateProduct = async (imageFile?: File, removeImage?: boolean) => {
    const token = getAuthToken();
    if (!selectedProduct || !productName.trim() || !token) return;
    setSaving(true);

    try {
      // Step 1: Handle image changes
      let newImageUrl: string | null | undefined = undefined; // undefined means no change
      
      if (imageFile) {
        // Upload new image
        setUploading(true);
        const uploadedUrl = await uploadProductImage(imageFile);
        setUploading(false);
        
        if (uploadedUrl) {
          newImageUrl = uploadedUrl;
          // Delete old image if exists
          if (selectedProduct.image_url) {
            await deleteProductImage(selectedProduct.image_url);
          }
        }
      } else if (removeImage && selectedProduct.image_url) {
        // Remove existing image
        await deleteProductImage(selectedProduct.image_url);
        newImageUrl = null;
      }

      // Step 2: Update product
      apiClient.setAuthToken(token);
      
      const updateData: Record<string, unknown> = {
        name: productName.trim(),
        brand: productBrand.trim() || null,
        category: productCategory || null,
        notes: productNotes.trim() || null,
      };
      
      // Only include image_url if it changed
      if (newImageUrl !== undefined) {
        updateData.image_url = newImageUrl;
      }
      
      const response = await apiClient.put<{
        success: boolean;
        data?: { product: Product };
        error?: string;
      }>(`/api/client/products/${selectedProduct.id}`, updateData);

      if (!response.data.success) {
        console.error('Error updating product:', response.data.error);
        toast({
          title: 'Error',
          description: 'Failed to update product. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Update local state
      setProducts(prev => prev.map(p =>
        p.id === selectedProduct.id
          ? {
              ...p,
              name: productName.trim(),
              brand: productBrand.trim() || undefined,
              category: productCategory || undefined,
              notes: productNotes.trim() || undefined,
              image_url: newImageUrl !== undefined ? (newImageUrl || undefined) : p.image_url,
              updated_at: new Date().toISOString(),
            }
          : p
      ));

      closeEditModal();

      toast({
        title: 'Success',
        description: 'Product updated successfully!',
      });
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: 'Error',
        description: 'Failed to update product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // ============================================================================
  // DELETE PRODUCT
  // ============================================================================

  const openDeleteConfirmation = (product: Product) => {
    setDeleteConfirmation({
      id: product.id,
      name: product.name,
    });
  };

  const closeDeleteConfirmation = () => {
    if (isDeleting) return;
    setDeleteConfirmation(null);
  };

  const handleConfirmDelete = async () => {
    const token = getAuthToken();
    if (!deleteConfirmation || !token) return;

    setIsDeleting(true);

    try {
      apiClient.setAuthToken(token);

      // Soft delete from database (set is_active to false)
      const response = await apiClient.delete<{
        success: boolean;
        data?: { image_url: string | null };
        error?: string;
      }>(`/api/client/products/${deleteConfirmation.id}`);

      if (!response.data.success) {
        console.error('Error deleting product:', response.data.error);
        toast({
          title: 'Error',
          description: 'Failed to delete product. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Delete image from storage if exists
      const imageUrl = response.data.data?.image_url;
      if (imageUrl && imageUrl.includes('/api/images/')) {
        await deleteProductImage(imageUrl);
      }

      // Update local state
      setProducts(prev => prev.filter(p => p.id !== deleteConfirmation.id));

      toast({
        title: 'Success',
        description: 'Product deleted successfully!',
      });

      setDeleteConfirmation(null);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================================
  // DELETE CONFIRM MODAL
  // ============================================================================

  const DeleteConfirmModal = () => {
    if (!deleteConfirmation) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>

          <h3 className="text-xl font-serif font-bold text-center mb-2">Delete Product</h3>
          <p className="text-gray-600 text-center mb-6">
            Are you sure you want to delete <span className="font-semibold text-gray-900">"{deleteConfirmation.name}"</span>? This action cannot be undone.
          </p>

          <div className="flex gap-3">
            <button
              onClick={closeDeleteConfirmation}
              disabled={isDeleting}
              className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Check if product has image (for badge display)
  const hasImage = (product: Product) => !!product.image_url;

  return (
    <div className="space-y-6">
      {/* Header with Add Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-gray-900">My Products</h2>
          <p className="text-sm text-gray-500">Track the products you're currently using with AI-powered recognition</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchProducts()}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
            title="Refresh products"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAIPhotoModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <img 
              className="text-[#2D2A3E]" 
              src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} 
              width={16} 
              height={16}
              alt="AI"
            /> AI Photo Scan
          </button>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-teal-400 outline-none"
          >
            <option value="all">All Categories</option>
            {PRODUCT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredProducts.length === 0 && (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-teal-600" />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">
            {searchQuery || categoryFilter !== 'all' ? 'No Products Found' : 'No Products Yet'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchQuery || categoryFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Add the skincare products you\'re currently using to track your routine'}
          </p>
          {!searchQuery && categoryFilter === 'all' && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setShowAIPhotoModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <img 
                  className="text-[#2D2A3E]" 
                  src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} 
                  width={20} 
                  height={20}
                  alt="AI"
                /> AI Photo Scan
              </button>
              <button
                onClick={() => { resetForm(); setShowAddModal(true); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-teal-500 text-teal-600 rounded-xl font-medium hover:bg-teal-50 transition-all"
              >
                <Plus className="w-5 h-5" /> Add Manually
              </button>
            </div>
          )}
        </div>
      )}

      {/* Products Grid */}
      {!loading && filteredProducts.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Product Image */}
              <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-50">
                <EncryptedImage
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  fallbackIcon="package"
                  showFallback={true}
                />
                {/* Badge for photo vs manual */}
                <div className="absolute top-3 left-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    hasImage(product)
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-teal-100 text-teal-700'
                  }`}>
                    {hasImage(product) ? 'AI Scan' : 'Manual'}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4">
                {product.brand && (
                  <p className="text-xs text-teal-600 font-medium mb-1">{product.brand}</p>
                )}
                <h4 className="font-medium text-gray-900 line-clamp-1 mb-1">{product.name}</h4>
                {product.category && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {product.category}
                  </span>
                )}
                {product.notes && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{product.notes}</p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">
                    Added {new Date(product.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(product)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => openDeleteConfirmation(product)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal (Manual with optional image) */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={closeAddModal}
        onSubmit={handleAddProduct}
        saving={saving}
        uploading={uploading}
        productName={productName}
        setProductName={setProductName}
        productBrand={productBrand}
        setProductBrand={setProductBrand}
        productCategory={productCategory}
        setProductCategory={setProductCategory}
        productNotes={productNotes}
        setProductNotes={setProductNotes}
      />

      {/* AI Photo Scan Modal */}
      <ClientAIPhotoScanModal
        isOpen={showAIPhotoModal}
        onClose={() => setShowAIPhotoModal(false)}
        onAdd={handleAddProductFromAI}
        saving={saving}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        onSubmit={handleUpdateProduct}
        saving={saving}
        uploading={uploading}
        product={selectedProduct}
        productName={productName}
        setProductName={setProductName}
        productBrand={productBrand}
        setProductBrand={setProductBrand}
        productCategory={productCategory}
        setProductCategory={setProductCategory}
        productNotes={productNotes}
        setProductNotes={setProductNotes}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal />
    </div>
  );
};

export default MyProductsSection;
