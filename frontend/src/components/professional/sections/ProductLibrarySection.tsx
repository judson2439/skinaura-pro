import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Package,
  Loader2,
  Edit,
  Trash2,
  ExternalLink,
  Heart,
  DollarSign,
  Image as ImageIcon,
  Tag,
  Star,
  X,
  Sparkles,
  Upload,
  FileSpreadsheet,
  ShoppingBag,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { Product, PRODUCT_CATEGORIES, MOCK_PRODUCTS } from '@/components/professional/modals/productLibraryTypes';
import AddProductModal from '@/components/professional/modals/AddProductModal';
import AIPhotoScanModal from '@/components/professional/modals/AIPhotoScanModal';
import EditProductModal from '@/components/professional/modals/EditProductModal';
import CSVProductImport from '@/components/professional/modals/CSVProductImport';
import ShopifyProductImport from '@/components/professional/modals/ShopifyProductImport';
import { EncryptedImage } from '@/components/ui/encrypted-image';
import { apiClient } from '@/lib/apiClient';
import { uploadImage } from '@/lib/encryption';
import { getAuthToken, getAuthSession } from '@/lib/authStorage';
import { CustomSelect, createOptions } from '@/components/ui/custom-select';


// ============================================================================
// TYPES
// ============================================================================

interface ProductLibrarySectionProps {
  onNavigateToView?: (viewId: string) => void;
}

type TabType = 'products' | 'import';
type ImportMethodType = 'none' | 'csv' | 'shopify';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Upload image to backend with encryption support using generic image endpoint
const uploadProductImage = async (file: File): Promise<string | null> => {
  try {
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return null;
    
    // Use the generic image upload utility with 'products' category
    const result = await uploadImage(file, 'products', token);
    
    if (result.success && result.data?.image_url) {
      return result.data.image_url;
    }
    
    console.error('Image upload error:', result.error);
    return null;
  } catch (error) {
    console.error('Image upload error:', error);
    return null;
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

const ProductLibrarySection: React.FC<ProductLibrarySectionProps> = ({
  onNavigateToView,
}) => {
  const session = getAuthSession();
  const user = session?.user;

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [importMethod, setImportMethod] = useState<ImportMethodType>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRecommendModal, setShowRecommendModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auto-open Shopify import if returning from OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const shop = urlParams.get('shop');
    
    if (code && state && shop) {
      setActiveTab('import');
      setImportMethod('shopify');
    }
  }, []);

  // Fetch products from backend API
  const fetchProducts = async () => {
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    
    if (!token) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { products: Product[] };
        error?: string;
      }>('/api/products');

      if (response.data.success && response.data.data) {
        setProducts(response.data.data.products || []);
      } else {
        console.error('Error fetching products:', response.data.error);
        // Fall back to mock data if error
        setProducts(MOCK_PRODUCTS);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts(MOCK_PRODUCTS);
    } finally {
      setLoading(false);
    }
  };



  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Stats calculations
  const totalProducts = products.length;
  const productsWithImages = products.filter(p => p.image_url).length;
  const categoriesCount = new Set(products.map(p => p.category)).size;
  const brandsCount = new Set(products.map(p => p.brand)).size;

  // Filtered products
  const filteredProducts = products.filter(product => {
    const matchesSearch =
      searchQuery === '' ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.ingredients.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      categoryFilter === 'all' || product.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Handlers
  const handleAddProduct = async (
    productData: Omit<Product, 'id' | 'created_at'>,
    imageFile?: File
  ) => {
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    setSaving(true);
    try {
      // Upload image if provided
      let imageUrl = productData.image_url;
      if (imageFile) {
        const uploadedUrl = await uploadProductImage(imageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      apiClient.setAuthToken(token);
      
      const response = await apiClient.post<{
        success: boolean;
        data?: { product: Product };
        error?: string;
      }>('/api/products', {
        name: productData.name,
        brand: productData.brand || null,
        category: productData.category || null,
        description: productData.description || null,
        price: productData.price || null,
        image_url: imageUrl || null,
        purchase_url: productData.purchase_url || null,
        ingredients: productData.ingredients || [],
        skin_types: productData.skin_types || [],
        concerns: productData.concerns || [],
        usage_instructions: productData.usage_instructions || null,
      });

      if (response.data.success && response.data.data?.product) {
        setProducts(prev => [response.data.data!.product, ...prev]);
      } else {
        console.error('Error adding product:', response.data.error);
        // Fall back to local state update
        const newProduct: Product = {
          ...productData,
          image_url: imageUrl,
          id: `p${Date.now()}`,
          created_at: new Date().toISOString(),
        };
        setProducts(prev => [newProduct, ...prev]);
      }

      setShowAddModal(false);
      setShowPhotoModal(false);
    } catch (error) {
      console.error('Error adding product:', error);
    } finally {
      setSaving(false);
    }
  };



  const handleAddProductFromPhoto = async (
    productData: Omit<Product, 'id' | 'created_at'>,
    imageFile?: File
  ) => {
    // Use the same handler as handleAddProduct
    await handleAddProduct(productData, imageFile);
  };

  const handleUpdateProduct = async (
    productId: string,
    data: Partial<Product>,
    imageFile?: File
  ) => {
    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    setSaving(true);
    try {
      // Upload new image if provided
      let imageUrl = data.image_url;
      if (imageFile) {
        const uploadedUrl = await uploadProductImage(imageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      apiClient.setAuthToken(token);
      
      const response = await apiClient.patch<{
        success: boolean;
        data?: { product: Product };
        error?: string;
      }>(`/api/products/${productId}`, {
        name: data.name,
        brand: data.brand || null,
        category: data.category || null,
        description: data.description || null,
        price: data.price || null,
        image_url: imageUrl || null,
        purchase_url: data.purchase_url || null,
        ingredients: data.ingredients || [],
        skin_types: data.skin_types || [],
        concerns: data.concerns || [],
        usage_instructions: data.usage_instructions || null,
      });

      if (response.data.success) {
        // Refresh products from database
        await fetchProducts();
      } else {
        console.error('Error updating product:', response.data.error);
        // Fall back to local state update
        setProducts(prev =>
          prev.map(p =>
            p.id === productId
              ? { ...p, ...data, image_url: imageUrl || p.image_url, updated_at: new Date().toISOString() }
              : p
          )
        );
      }

      setShowEditModal(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error('Error updating product:', error);
    } finally {
      setSaving(false);
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  // Close delete confirmation modal
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setProductToDelete(null);
  };

  // Confirm and execute delete
  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    const authSession = getAuthSession();
    const token = authSession?.token || getAuthToken();
    if (!token) return;

    setDeleting(true);
    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.delete<{
        success: boolean;
        message?: string;
        error?: string;
      }>(`/api/products/${productToDelete.id}`);

      if (response.data.success) {
        setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      } else {
        console.error('Error deleting product:', response.data.error);
        // Fall back to local state update
        setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
    } finally {
      setDeleting(false);
      closeDeleteModal();
    }
  };




  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Product Library</h2>
          <p className="text-gray-500">Manage your skincare product catalog with AI-powered recognition</p>
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
            onClick={() => setShowPhotoModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={16} height={16}/> AI Photo Scan
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'products'
              ? 'border-[#CFAFA3] text-[#CFAFA3]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            My Products ({totalProducts})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'import'
              ? 'border-[#CFAFA3] text-[#CFAFA3]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Bulk Import
          </div>
        </button>
      </div>

      {/* Products Tab Content */}
      {activeTab === 'products' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#CFAFA3]/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-[#CFAFA3]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
                  <p className="text-xs text-gray-500">Total Products</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{productsWithImages}</p>
                  <p className="text-xs text-gray-500">With Photos</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{categoriesCount}</p>
                  <p className="text-xs text-gray-500">Categories</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{brandsCount}</p>
                  <p className="text-xs text-gray-500">Brands</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by name, brand, or ingredient..."
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
              <CustomSelect
                value={categoryFilter}
                onChange={(value) => setCategoryFilter(value)}
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...createOptions([...PRODUCT_CATEGORIES])
                ]}
                placeholder="All Categories"
                className="min-w-[180px]"
              />
            </div>
          </div>


          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#CFAFA3] animate-spin" />
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredProducts.length === 0 && (
            <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
              <div className="w-16 h-16 rounded-full bg-[#CFAFA3]/10 flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-[#CFAFA3]" />
              </div>
              <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">
                {searchQuery || categoryFilter !== 'all' ? 'No Products Found' : 'No Products Yet'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery || categoryFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Add your first product using AI photo recognition or manually'}
              </p>
              {!searchQuery && categoryFilter === 'all' && (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setShowPhotoModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={20} height={20}/> AI Photo Scan
                  </button>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-[#CFAFA3] text-[#CFAFA3] rounded-xl font-medium hover:bg-[#CFAFA3]/5 transition-all"
                  >
                    <Plus className="w-5 h-5" /> Add Manually
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Products Grid */}
          {!loading && filteredProducts.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Product Image */}
                  <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-50">
                    <EncryptedImage
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      fallbackIcon="package"
                      showFallback={true}
                    />
                    {/* Price badge */}
                    {product.price && (
                      <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 text-gray-900 text-sm font-medium rounded-full flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {Number(product.price).toFixed(2)}
                      </div>
                    )}
                    {/* Category badge */}
                    <div className="absolute top-3 left-3">
                      <span className="px-2 py-1 bg-[#CFAFA3] text-white text-xs font-medium rounded-full">
                        {product.category}
                      </span>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-5">
                    <p className="text-xs text-[#CFAFA3] font-medium mb-1">{product.brand}</p>
                    <h4 className="font-medium text-gray-900 line-clamp-1 mb-2">{product.name}</h4>

                    {product.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{product.description}</p>
                    )}

                    {/* Skin Types */}
                    {product.skin_types && product.skin_types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {product.skin_types.slice(0, 3).map((type, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-[#CFAFA3]/10 text-[#CFAFA3] text-xs rounded-full"
                          >
                            {type}
                          </span>
                        ))}
                        {product.skin_types.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                            +{product.skin_types.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit Product"
                        >
                          <Edit className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(product)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>

                        {product.purchase_url && (
                          <a
                            href={product.purchase_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Product"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowRecommendModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#CFAFA3]/10 text-[#CFAFA3] rounded-lg text-sm font-medium hover:bg-[#CFAFA3]/20 transition-colors"
                      >
                        <Heart className="w-4 h-4" /> Recommend
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Import Tab Content */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Import Method Selection */}
          {importMethod === 'none' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* CSV Import Card */}
              <div
                onClick={() => setImportMethod('csv')}
                className="bg-white rounded-2xl p-8 border-2 border-gray-100 hover:border-[#CFAFA3] cursor-pointer transition-all hover:shadow-lg group"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">CSV Bulk Import</h3>
                <p className="text-gray-500 mb-4">
                  Upload a CSV file with your product data including names, brands, categories, prices, and image URLs.
                </p>
                <div className="flex items-center gap-2 text-[#CFAFA3] font-medium">
                  <span>Get Started</span>
                  <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                </div>
              </div>

              {/* Shopify Import Card */}
              <div
                onClick={() => setImportMethod('shopify')}
                className="bg-white rounded-2xl p-8 border-2 border-gray-100 hover:border-green-500 cursor-pointer transition-all hover:shadow-lg group"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ShoppingBag className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">Shopify Import</h3>
                <p className="text-gray-500 mb-4">
                  Connect your Shopify store and import products directly with images, prices, and descriptions.
                </p>
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <span>Connect Store</span>
                  <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                </div>
              </div>
            </div>
          )}
          {/* CSV Import Component */}
          {importMethod === 'csv' && (
            <div>
              <button
                onClick={() => setImportMethod('none')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
                <span>Back to Import Options</span>
              </button>
              <CSVProductImport 
                userId={user?.id || ''} 
                onImportComplete={() => {
                  fetchProducts();
                  setActiveTab('products');
                }}
              />
            </div>
          )}


          {/* Shopify Import Component */}
          {importMethod === 'shopify' && (
            <div>
              <button
                onClick={() => setImportMethod('none')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
                <span>Back to Import Options</span>
              </button>
              <ShopifyProductImport 
                onImportComplete={() => {
                  fetchProducts();
                  setActiveTab('products');
                  setImportMethod('none');
                }}
              />
            </div>
          )}

        </div>
      )}

      {/* Modals */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddProduct}
        saving={saving}
      />

      <AIPhotoScanModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onAdd={handleAddProductFromPhoto}
        saving={saving}
      />

      <EditProductModal
        isOpen={showEditModal}
        product={selectedProduct}
        onClose={() => {
          setShowEditModal(false);
          setSelectedProduct(null);
        }}
        onUpdate={handleUpdateProduct}
        saving={saving}
      />

      {/* Recommend Product Modal */}
      {showRecommendModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-serif font-bold">Recommend Product</h3>
              <button
                onClick={() => {
                  setShowRecommendModal(false);
                  setSelectedProduct(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-4">
              <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden">
                {selectedProduct.image_url ? (
                  <EncryptedImage
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                    fallbackClassName="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden"
                  />
                ) : (
                  <Package className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-xs text-[#CFAFA3] font-medium">{selectedProduct.brand}</p>
                <p className="font-medium text-gray-900">{selectedProduct.name}</p>
                <p className="text-sm text-gray-500">{selectedProduct.category}</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 text-center mb-4">
              To recommend this product to a client, go to their profile and use the product recommendation feature.
            </p>

            <button
              onClick={() => {
                setShowRecommendModal(false);
                setSelectedProduct(null);
              }}
              className="w-full py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              Got It
            </button>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-in fade-in zoom-in duration-200">
            {/* Warning Icon */}
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-serif font-bold text-gray-900 text-center mb-2">
              Delete Product
            </h3>

            {/* Description */}
            <p className="text-gray-500 text-center mb-6">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>

            {/* Product Preview */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-6">
              <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                <EncryptedImage
                  src={productToDelete.image_url}
                  alt={productToDelete.name}
                  className="w-full h-full object-cover"
                  fallbackIcon="package"
                  showFallback={true}
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#CFAFA3] font-medium">{productToDelete.brand}</p>
                <p className="font-medium text-gray-900 truncate">{productToDelete.name}</p>
                <p className="text-sm text-gray-500">{productToDelete.category}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteProduct}
                disabled={deleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
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
      )}
    </div>
  );
};

export default ProductLibrarySection;
