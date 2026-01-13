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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getAuthSession } from '@/lib/authStorage';

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

// ============================================================================
// COMPONENT
// ============================================================================

const ShopifyProductImport: React.FC<ShopifyProductImportProps> = ({
  onImportComplete,
}) => {
  const session = getAuthSession();
  const user = session?.user;
  
  // State
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [storeUrl, setStoreUrl] = useState<string>('');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch products from Shopify via edge function
  const fetchProducts = async (cursor?: string) => {
    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      let data, fnError;
      try {
        const response = await supabase.functions.invoke('shopify-products', {
          body: { 
            limit: 50,
            cursor: cursor || undefined
          },
        });
        data = response.data;
        fnError = response.error;
      } catch (fetchError: any) {
        // Handle network errors like "fetch failed"
        console.error('Network error calling Shopify function:', fetchError);
        throw new Error('Shopify integration is not configured or unavailable. Please contact support.');
      }

      if (fnError) {
        // Check if error message contains HTML (indicates function doesn't exist)
        const errorMsg = fnError.message || '';
        if (errorMsg.includes('<html') || errorMsg.includes('<!DOCTYPE') || 
            errorMsg.includes('Unexpected token') || errorMsg.includes('is not valid JSON') ||
            errorMsg.includes('fetch failed') || errorMsg.includes('Failed to fetch')) {
          throw new Error('Shopify integration is not configured or unavailable. Please contact support.');
        }
        throw new Error(fnError.message || 'Failed to fetch products');
      }

      if (data?.error) {
        throw new Error(data.message || data.error);
      }

      if (cursor) {
        // Append to existing products
        setProducts(prev => [...prev, ...(data?.products || [])]);
      } else {
        setProducts(data?.products || []);
      }
      
      setStoreUrl(data?.storeUrl || '');
      setHasMore(data?.hasMore || false);
      setNextCursor(data?.nextCursor || null);
      setConnected(true);

    } catch (err) {
      console.error('Error fetching Shopify products:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Shopify';
      // Make the error message more user-friendly
      if (errorMessage.includes('fetch failed') || errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('NetworkError') || errorMessage.includes('network')) {
        setError('Shopify integration is not configured or unavailable. Please contact support.');
      } else {
        setError(errorMessage);
      }
      setConnected(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };


  // Load products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

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
    if (selectedProducts.size === 0 || !user) return;

    setImporting(true);
    setError(null);
    let successCount = 0;

    try {
      const productsToImport = products.filter(p => selectedProducts.has(p.shopify_id));

      // Import products one by one to the database
      for (const product of productsToImport) {
        try {
          const { error: insertError } = await supabase
            .from('products')
            .insert({
              professional_id: user.id,
              name: product.title,
              brand: product.vendor || null,
              category: mapProductTypeToCategory(product.product_type),
              description: product.description || null,
              price: product.price || null,
              image_url: product.image_url || null,
              purchase_url: product.url || null,
              ingredients: [], // Shopify doesn't provide ingredients
              skin_types: [],
              concerns: product.tags.slice(0, 5), // Use tags as concerns
              is_active: true,
              is_global: false,
            });

          if (!insertError) {
            successCount++;
          } else {
            console.error('Error importing product:', product.title, insertError);
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
    setConnected(false);
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
                {connected 
                  ? `Connected to ${storeUrl}` 
                  : loading 
                    ? 'Connecting to your store...'
                    : 'Import products from your Shopify store'}
              </p>
            </div>
          </div>
          {connected && !importComplete && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading || loadingMore}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh Products"
              >
                <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
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
        {loading && !connected && (
          <div className="py-12 text-center">
            <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Connecting to Shopify...</p>
            <p className="text-sm text-gray-500 mt-1">Fetching your products</p>
          </div>
        )}

        {/* No Products State */}
        {connected && !loading && products.length === 0 && !importComplete && (
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
        {connected && !importComplete && products.length > 0 && (
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
