import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Camera,
  Package,
  Edit,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import AddProductModal, { PRODUCT_CATEGORIES } from '../modals/AddProductModal';
import AddProductPhotoModal from '../modals/AddProductPhotoModal';
import EditProductModal from '../modals/EditProductModal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
}

interface DeleteConfirmation {
  id: string;
  name: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const MyProductsSection: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productNotes, setProductNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // ============================================================================
  // FETCH PRODUCTS
  // ============================================================================

  const fetchProducts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('client_products')
        .select('*')
        .eq('client_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        toast({
          title: 'Error',
          description: 'Failed to load products. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      setProducts(data || []);
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
  }, [user]);

  // ============================================================================
  // UPLOAD IMAGE
  // ============================================================================

  const uploadProductImage = async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `client-products/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  // ============================================================================
  // DELETE IMAGE
  // ============================================================================

  const deleteProductImage = async (imageUrl: string): Promise<void> => {
    try {
      const urlParts = imageUrl.split('/progress-photos/');
      if (urlParts.length < 2) return;

      const filePath = urlParts[1];
      await supabase.storage.from('progress-photos').remove([filePath]);
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
    setSelectedFile(null);
    setPhotoPreview(null);
  };

  // ============================================================================
  // ADD PRODUCT MANUALLY
  // ============================================================================

  const handleAddProduct = async () => {
    if (!productName.trim() || !user) return;
    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('client_products')
        .insert({
          client_id: user.id,
          name: productName.trim(),
          brand: productBrand.trim() || null,
          category: productCategory || null,
          notes: productNotes.trim() || null,
          image_url: null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding product:', error);
        toast({
          title: 'Error',
          description: 'Failed to add product. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Add to local state
      setProducts(prev => [data, ...prev]);
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
    }
  };

  // ============================================================================
  // ADD PRODUCT FROM PHOTO
  // ============================================================================

  const handleAddProductFromPhoto = async () => {
    if (!productName.trim() || !selectedFile || !user) return;
    setSaving(true);
    setUploading(true);

    try {
      // Step 1: Upload image
      const imageUrl = await uploadProductImage(selectedFile);

      if (!imageUrl) {
        toast({
          title: 'Error',
          description: 'Failed to upload image. Please try again.',
          variant: 'destructive',
        });
        setSaving(false);
        setUploading(false);
        return;
      }

      setUploading(false);

      // Step 2: Insert product with image URL
      const { data, error } = await supabase
        .from('client_products')
        .insert({
          client_id: user.id,
          name: productName.trim(),
          brand: productBrand.trim() || null,
          category: productCategory || null,
          notes: productNotes.trim() || null,
          image_url: imageUrl,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding product:', error);
        // Delete uploaded image if product insert fails
        await deleteProductImage(imageUrl);
        toast({
          title: 'Error',
          description: 'Failed to add product. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Add to local state
      setProducts(prev => [data, ...prev]);
      setShowPhotoModal(false);
      resetForm();

      toast({
        title: 'Success',
        description: 'Product added successfully with photo!',
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

  // Close photo modal
  const closePhotoModal = () => {
    setShowPhotoModal(false);
    resetForm();
  };

  // ============================================================================
  // UPDATE PRODUCT
  // ============================================================================

  const handleUpdateProduct = async () => {
    if (!selectedProduct || !productName.trim()) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('client_products')
        .update({
          name: productName.trim(),
          brand: productBrand.trim() || null,
          category: productCategory || null,
          notes: productNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedProduct.id);

      if (error) {
        console.error('Error updating product:', error);
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
    if (!deleteConfirmation) return;

    setIsDeleting(true);

    try {
      // Find the product to get image URL
      const productToDelete = products.find(p => p.id === deleteConfirmation.id);

      // Soft delete from database (set is_active to false)
      const { error } = await supabase
        .from('client_products')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', deleteConfirmation.id);

      if (error) {
        console.error('Error deleting product:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete product. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Delete image from storage if exists
      if (productToDelete?.image_url && productToDelete.image_url.includes('progress-photos')) {
        await deleteProductImage(productToDelete.image_url);
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
          <p className="text-sm text-gray-500">Track the products you're currently using</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { resetForm(); setShowPhotoModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            <Camera className="w-4 h-4" /> Add with Photo
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
                onClick={() => { resetForm(); setShowPhotoModal(true); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-teal-500 text-teal-600 rounded-xl font-medium hover:bg-teal-50 transition-all"
              >
                <Camera className="w-5 h-5" /> Upload Product Photo
              </button>
              <button
                onClick={() => { resetForm(); setShowAddModal(true); }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
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
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                {/* Badge for photo vs manual */}
                <div className="absolute top-3 left-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    hasImage(product)
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-teal-100 text-teal-700'
                  }`}>
                    {hasImage(product) ? 'Photo' : 'Manual'}
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

      {/* Add Product Modal (Manual) */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={closeAddModal}
        onSubmit={handleAddProduct}
        saving={saving}
        productName={productName}
        setProductName={setProductName}
        productBrand={productBrand}
        setProductBrand={setProductBrand}
        productCategory={productCategory}
        setProductCategory={setProductCategory}
        productNotes={productNotes}
        setProductNotes={setProductNotes}
      />

      {/* Add Product from Photo Modal */}
      <AddProductPhotoModal
        isOpen={showPhotoModal}
        onClose={closePhotoModal}
        onSubmit={handleAddProductFromPhoto}
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
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        photoPreview={photoPreview}
        setPhotoPreview={setPhotoPreview}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        onSubmit={handleUpdateProduct}
        saving={saving}
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
