import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Package,
  RefreshCw,
  Check,
  X,
  Info,
  Link,
  Unlink,
  Store,
} from 'lucide-react';
import { getAuthSession } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';

// ============================================================================
// TYPES
// ============================================================================

interface ShopifyProductImportProps {
  onImportComplete?: () => void;
}

interface ShopifyProduct {
  shopify_id: string;
  title: string;
  vendor: string;
  product_type: string;
  description: string;
  price: number;
  image_url: string | null;
  url: string;
  tags: string[];
  sku: string | null;
  inventory_quantity: number | null;
}

interface ConnectionStatus {
  connected: boolean;
  shop_domain?: string;
  connected_at?: string;
}

// Map Shopify product types to our categories
const mapProductTypeToCategory = (productType: string): string => {
  const typeMap: Record<string, string> = {
    'cleanser': 'Cleanser',
    'cleansers': 'Cleanser',
    'face wash': 'Cleanser',
    'toner': 'Toner',
    'toners': 'Toner',
    'serum': 'Serum',
    'serums': 'Serum',
    'moisturizer': 'Moisturizer',
    'moisturizers': 'Moisturizer',
    'cream': 'Moisturizer',
    'creams': 'Moisturizer',
    'lotion': 'Moisturizer',
    'sunscreen': 'Sunscreen',
    'spf': 'Sunscreen',
    'sun protection': 'Sunscreen',
    'mask': 'Mask',
    'masks': 'Mask',
    'face mask': 'Mask',
    'eye cream': 'Eye Cream',
    'eye': 'Eye Cream',
    'exfoliator': 'Exfoliator',
    'exfoliant': 'Exfoliator',
    'scrub': 'Exfoliator',
    'oil': 'Face Oil',
    'face oil': 'Face Oil',
    'facial oil': 'Face Oil',
    'mist': 'Mist',
    'spray': 'Mist',
    'essence': 'Essence',
    'treatment': 'Treatment',
    'spot treatment': 'Treatment',
    'acne': 'Treatment',
    'retinol': 'Treatment',
    'lip': 'Lip Care',
    'lip balm': 'Lip Care',
    'lip care': 'Lip Care',
    'body': 'Body Care',
    'body lotion': 'Body Care',
    'body cream': 'Body Care',
    'hand cream': 'Body Care',
  };

  const lowerType = productType.toLowerCase().trim();
  
  // Check for exact match first
  if (typeMap[lowerType]) {
    return typeMap[lowerType];
  }
  
  // Check if any key is contained in the product type
  for (const [key, value] of Object.entries(typeMap)) {
    if (lowerType.includes(key)) {
      return value;
    }
  }
  
  return 'Other';
};

/**
 * Strip HTML tags from a string and convert to plain text
 * Also handles common HTML entities
 */
const stripHtmlTags = (html: string | null | undefined): string => {
  if (!html) return '';
  
  // Create a temporary DOM element to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Get text content (strips all HTML tags)
  let text = tempDiv.textContent || tempDiv.innerText || '';
  
  // Clean up whitespace (multiple spaces, newlines, etc.)
  text = text
    .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
    .replace(/^\s+|\s+$/g, '') // Trim leading/trailing whitespace
    .trim();
  
  return text;
};

// ============================================================================
// COMPONENT
// ============================================================================

const ShopifyProductImport: React.FC<ShopifyProductImportProps> = ({
  onImportComplete,
}) => {
  const session = getAuthSession();
  const user = session?.user;
  const token = session?.token;
  
  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [shopDomainInput, setShopDomainInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  
  // Products state
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Check connection status on mount or handle OAuth callback
  useEffect(() => {
    const initializeComponent = async () => {
      // Check if we're returning from OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const shop = urlParams.get('shop');
      
      if (code && state && shop) {
        // Clean up URL immediately to prevent re-processing on re-renders
        window.history.replaceState({}, document.title, window.location.pathname);
        // Handle the OAuth callback first
        await handleOAuthCallback(code, state, shop);
      } else {
        // No OAuth callback, just check connection status
        await checkConnectionStatus();
      }
    };
    
    initializeComponent();
  }, []);

  // Fetch products when connected
  useEffect(() => {
    if (connectionStatus?.connected) {
      fetchProducts();
    }
  }, [connectionStatus?.connected]);

  const checkConnectionStatus = async () => {
    setCheckingConnection(true);
    setError(null);

    try {
      apiClient.setAuthToken(token || null);
      const response = await apiClient.get<{ success: boolean; data?: ConnectionStatus; error?: string }>(
        '/api/professional/shopify/status'
      );

      if (response.data.success && response.data.data) {
        setConnectionStatus(response.data.data);
      } else {
        setError(response.data.error || 'Failed to check connection status');
      }
    } catch (err) {
      console.error('Error checking Shopify status:', err);
      setError('Failed to check Shopify connection status');
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleConnect = async () => {
    if (!shopDomainInput.trim()) {
      setError('Please enter your Shopify store URL');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      apiClient.setAuthToken(token || null);
      const response = await apiClient.post<{ 
        success: boolean; 
        data?: { auth_url: string; shop_domain: string }; 
        error?: string 
      }>(
        '/api/professional/shopify/connect',
        { shop_domain: shopDomainInput.trim() }
      );

      if (response.data.success && response.data.data?.auth_url) {
        // Redirect to Shopify OAuth
        window.location.href = response.data.data.auth_url;
      } else {
        setError(response.data.error || 'Failed to initiate Shopify connection');
        setConnecting(false);
      }
    } catch (err) {
      console.error('Error connecting to Shopify:', err);
      setError('Failed to connect to Shopify. Please try again.');
      setConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string, state: string, shop: string) => {
    setConnecting(true);
    setCheckingConnection(true);
    setError(null);

    try {
      apiClient.setAuthToken(token || null);
      const response = await apiClient.post<{ 
        success: boolean; 
        message?: string;
        data?: { shop_domain: string }; 
        error?: string 
      }>(
        '/api/professional/shopify/callback',
        { code, state, shop }
      );

      if (response.data.success) {
        // Refresh connection status
        await checkConnectionStatus();
      } else {
        console.error('❌ OAuth callback failed:', response.data.error);
        setError(response.data.error || 'Failed to complete Shopify connection');
        setCheckingConnection(false);
      }
    } catch (err: any) {
      console.error('❌ Error handling OAuth callback:', err);
      const errorMessage = err?.data?.error || 'Failed to complete Shopify connection. Please try again.';
      setError(errorMessage);
      setCheckingConnection(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Shopify store?')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      apiClient.setAuthToken(token || null);
      const response = await apiClient.delete<{ success: boolean; message?: string; error?: string }>(
        '/api/professional/shopify/disconnect'
      );

      if (response.data.success) {
        setConnectionStatus({ connected: false });
        setProducts([]);
        setSelectedProducts(new Set());
        setShopDomainInput('');
      } else {
        setError(response.data.error || 'Failed to disconnect Shopify store');
      }
    } catch (err) {
      console.error('Error disconnecting Shopify:', err);
      setError('Failed to disconnect Shopify store. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  const fetchProducts = async (cursor?: string) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      apiClient.setAuthToken(token || null);
      
      let path = '/api/professional/shopify/products';
      if (cursor) {
        path += `?cursor=${encodeURIComponent(cursor)}`;
      }

      const response = await apiClient.get<{
        success: boolean;
        data?: {
          products: ShopifyProduct[];
          storeUrl: string;
          hasMore: boolean;
          nextCursor: string | null;
        };
        error?: string;
      }>(path);

      if (response.data.success && response.data.data) {
        if (cursor) {
          setProducts(prev => [...prev, ...(response.data.data?.products || [])]);
        } else {
          setProducts(response.data.data.products || []);
        }
        setHasMore(response.data.data.hasMore || false);
        setNextCursor(response.data.data.nextCursor || null);
      } else {
        setError(response.data.error || 'Failed to fetch products');
      }
    } catch (err: any) {
      console.error('Error fetching Shopify products:', err);
      
      // If token is invalid, prompt to reconnect
      if (err?.status === 401) {
        setConnectionStatus({ connected: false });
      }
      
      setError('Failed to fetch products from Shopify');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const toggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const selectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.shopify_id)));
    }
  };

  const handleImport = async () => {
    if (selectedProducts.size === 0 || !user || !token) return;

    setImporting(true);
    setError(null);
    let successCount = 0;

    try {
      const productsToImport = products.filter(p => selectedProducts.has(p.shopify_id));

      apiClient.setAuthToken(token);

      // Import products one by one to the database
      for (const product of productsToImport) {
        try {
          // Use Shopify's public image URL directly (no encryption)
          const finalImageUrl = product.image_url || null;

          // Strip HTML from description
          const plainTextDescription = stripHtmlTags(product.description);

          // Create product via backend API
          const response = await apiClient.post<{
            success: boolean;
            data?: { product: unknown };
            error?: string;
          }>('/api/products', {
            name: product.title,
            brand: product.vendor || null,
            category: mapProductTypeToCategory(product.product_type),
            description: plainTextDescription || null,
            price: product.price || null,
            image_url: finalImageUrl,
            purchase_url: product.url || null,
            ingredients: [], // Shopify doesn't provide ingredients
            skin_types: [],
            concerns: product.tags.slice(0, 5), // Use tags as concerns
          });

          if (response.data.success) {
            successCount++;
          } else {
            console.error('Error importing product:', product.title, response.data.error);
          }
        } catch (err) {
          console.error('Error importing product:', product.title, err);
        }
      }

      setImportedCount(successCount);
      setImportComplete(true);

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      console.error('Error during import:', err);
      setError('Failed to import some products. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleRefresh = () => {
    setProducts([]);
    setSelectedProducts(new Set());
    setNextCursor(null);
    fetchProducts();
  };

  const handleReset = () => {
    setProducts([]);
    setSelectedProducts(new Set());
    setImportComplete(false);
    setImportedCount(0);
    setError(null);
    setNextCursor(null);
    fetchProducts();
  };

  const loadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchProducts(nextCursor);
    }
  };

  // Loading state while checking connection
  if (checkingConnection) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-gray-900">Shopify Import</h3>
              <p className="text-sm text-gray-500">Checking connection status...</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="py-12 text-center">
            <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Checking Shopify connection...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not connected - show connection form
  if (!connectionStatus?.connected) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-gray-900">Connect Shopify Store</h3>
              <p className="text-sm text-gray-500">Import products directly from your Shopify store</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700">Connection Error</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="p-1 hover:bg-red-100 rounded"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-700">
                <p className="font-medium mb-1">How to connect your Shopify store:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Enter your Shopify store URL below</li>
                  <li>Click "Connect Store" to authorize access</li>
                  <li>You'll be redirected to Shopify to approve the connection</li>
                  <li>Once approved, you can import your products</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Store URL Input */}
          <div className="space-y-4">
            <div>
              <label htmlFor="shopDomain" className="block text-sm font-medium text-gray-700 mb-2">
                Shopify Store Name or URL
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="shopDomain"
                    type="text"
                    value={shopDomainInput}
                    onChange={(e) => setShopDomainInput(e.target.value)}
                    placeholder="your-store-name"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={connecting}
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <p>Enter your store name or URL. Examples:</p>
                <ul className="list-disc list-inside pl-2 text-gray-400">
                  <li><span className="text-gray-600">your-store-name</span> (just the name)</li>
                  <li><span className="text-gray-600">your-store.myshopify.com</span></li>
                </ul>
              </div>
            </div>

            <button
              onClick={handleConnect}
              disabled={connecting || !shopDomainInput.trim()}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Connecting to Shopify...
                </>
              ) : (
                <>
                  <Link className="w-5 h-5" />
                  Connect Store
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Connected - show products or import results
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-gray-900">Shopify Import</h3>
              <p className="text-sm text-gray-500">
                Connected to {connectionStatus.shop_domain}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!importComplete && (
              <>
                <button
                  onClick={handleRefresh}
                  disabled={loading || loadingMore}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Refresh Products"
                >
                  <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
                  title="Disconnect Store"
                >
                  {disconnecting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Unlink className="w-5 h-5" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700">Error</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="mt-2 text-sm text-red-700 font-medium hover:underline"
                >
                  Try Again
                </button>
              </div>
              <button
                onClick={() => setError(null)}
                className="p-1 hover:bg-red-100 rounded"
              >
                <X className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && products.length === 0 && (
          <div className="py-12 text-center">
            <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Fetching products from Shopify...</p>
            <p className="text-sm text-gray-500 mt-1">This may take a moment</p>
          </div>
        )}

        {/* No Products State */}
        {!loading && products.length === 0 && !importComplete && (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Products Found</h4>
            <p className="text-gray-500 mb-4">
              Your Shopify store doesn't have any active products to import.
            </p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Products List */}
        {!importComplete && products.length > 0 && (
          <div>
            {/* Info Banner */}
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl mb-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-700">
                <p className="font-medium">Products loaded from your Shopify store</p>
                <p className="mt-0.5">Select the products you want to import to your library.</p>
              </div>
            </div>

            {/* Select All */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedProducts.size === products.length && products.length > 0
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  {selectedProducts.size === products.length && products.length > 0 && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </button>
                <span className="text-sm text-gray-600">
                  {selectedProducts.size === products.length
                    ? 'Deselect All'
                    : `Select All (${products.length})`}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {selectedProducts.size} selected
              </span>
            </div>

            {/* Products Grid */}
            <div className="grid sm:grid-cols-2 gap-4 mb-4 max-h-96 overflow-y-auto pr-1">
              {products.map((product) => (
                <div
                  key={product.shopify_id}
                  onClick={() => toggleProduct(product.shopify_id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedProducts.has(product.shopify_id)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <button
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedProducts.has(product.shopify_id)
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedProducts.has(product.shopify_id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </button>
                  <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{product.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {product.vendor && `${product.vendor} • `}
                      {product.product_type || 'Uncategorized'}
                    </p>
                    <p className="text-sm font-medium text-green-600">
                      ${product.price.toFixed(2)}
                    </p>
                  </div>
                  {product.url && (
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-2 mb-4 text-sm text-green-600 font-medium hover:bg-green-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  <>
                    Load More Products
                  </>
                )}
              </button>
            )}

            {/* Import Button */}
            <button
              onClick={handleImport}
              disabled={importing || selectedProducts.size === 0}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Importing {selectedProducts.size} Products...
                </>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5" />
                  Import {selectedProducts.size} Products
                </>
              )}
            </button>
          </div>
        )}

        {/* Import Complete */}
        {importComplete && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Import Successful!</h4>
            <p className="text-gray-500 mb-6">
              {importedCount} product{importedCount !== 1 ? 's have' : ' has'} been imported to your library.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setImportComplete(false);
                  setSelectedProducts(new Set());
                }}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Import More
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopifyProductImport;
