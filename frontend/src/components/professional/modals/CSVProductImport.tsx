import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Info,
} from 'lucide-react';
import { getAuthToken } from '@/lib/authStorage';
import { apiClient } from '@/lib/apiClient';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// TYPES
// ============================================================================

interface CSVProductImportProps {
  userId: string;
  onImportComplete?: () => void;
}

interface CSVProduct {
  name: string;
  brand: string;
  category: string;
  description?: string;
  price?: number;
  image_url?: string;
  purchase_url?: string;
  ingredients?: string[];
  skin_types?: string[];
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_CATEGORIES = [
  'Cleanser',
  'Toner',
  'Serum',
  'Moisturizer',
  'Sunscreen',
  'Treatment',
  'Eye Cream',
  'Mask',
  'Oil',
  'Exfoliant',
  'Essence',
  'Mist',
  'Lip Care',
  'Body Care',
];

const VALID_SKIN_TYPES = [
  'Normal',
  'Dry',
  'Oily',
  'Combination',
  'Sensitive',
  'Acne-Prone',
  'Mature',
  'All Skin Types',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Parse CSV value that may contain commas within quotes
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

// Parse array field from CSV (pipe-separated values)
const parseArrayField = (value: string): string[] => {
  if (!value || value.trim() === '') return [];
  return value.split('|').map(v => v.trim()).filter(v => v !== '');
};

// ============================================================================
// COMPONENT
// ============================================================================

const CSVProductImport: React.FC<CSVProductImportProps> = ({ userId, onImportComplete }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedProducts, setParsedProducts] = useState<CSVProduct[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Process the selected file
  const processFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a CSV file (.csv extension)');
      return;
    }
    
    setSelectedFile(file);
    setResult(null);
    setParseError(null);
    setValidationErrors([]);
    parseCSV(file);
  };

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, []);

  // Parse CSV file
  const parseCSV = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setParseError('CSV file must contain a header row and at least one data row.');
        return;
      }

      // Parse headers
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
      const requiredHeaders = ['name', 'brand', 'category'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

      if (missingHeaders.length > 0) {
        setParseError(`Missing required columns: ${missingHeaders.join(', ')}`);
        return;
      }

      const products: CSVProduct[] = [];
      const errors: ValidationError[] = [];
      
      // Parse each data row
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        
        // Skip empty rows
        if (values.every(v => !v || v.trim() === '')) continue;
        
        const product: CSVProduct = {
          name: '',
          brand: '',
          category: '',
        };

        headers.forEach((header, index) => {
          const value = values[index]?.replace(/^"|"$/g, '') || '';
          
          switch (header) {
            case 'name':
              product.name = value;
              break;
            case 'brand':
              product.brand = value;
              break;
            case 'category':
              product.category = value;
              // Validate category
              if (value && !VALID_CATEGORIES.includes(value)) {
                errors.push({
                  row: i + 1,
                  field: 'category',
                  message: `Invalid category "${value}". Valid options: ${VALID_CATEGORIES.join(', ')}`
                });
              }
              break;
            case 'description':
              product.description = value || undefined;
              break;
            case 'price':
              if (value) {
                const price = parseFloat(value.replace(/[^0-9.]/g, ''));
                if (!isNaN(price) && price >= 0) {
                  product.price = price;
                } else {
                  errors.push({
                    row: i + 1,
                    field: 'price',
                    message: `Invalid price "${value}". Must be a positive number.`
                  });
                }
              }
              break;
            case 'image_url':
            case 'image':
              if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
                product.image_url = value;
              } else if (value) {
                errors.push({
                  row: i + 1,
                  field: 'image_url',
                  message: `Invalid image URL "${value}". Must start with http:// or https://`
                });
              }
              break;
            case 'purchase_url':
            case 'url':
              if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
                product.purchase_url = value;
              } else if (value) {
                errors.push({
                  row: i + 1,
                  field: 'purchase_url',
                  message: `Invalid purchase URL "${value}". Must start with http:// or https://`
                });
              }
              break;
            case 'ingredients':
              product.ingredients = parseArrayField(value);
              break;
            case 'skin_types':
              const skinTypes = parseArrayField(value);
              // Validate skin types
              skinTypes.forEach(st => {
                if (!VALID_SKIN_TYPES.includes(st)) {
                  errors.push({
                    row: i + 1,
                    field: 'skin_types',
                    message: `Invalid skin type "${st}". Valid options: ${VALID_SKIN_TYPES.join(', ')}`
                  });
                }
              });
              product.skin_types = skinTypes.filter(st => VALID_SKIN_TYPES.includes(st));
              break;
          }
        });

        // Validate required fields
        if (!product.name) {
          errors.push({ row: i + 1, field: 'name', message: 'Name is required' });
        }
        if (!product.brand) {
          errors.push({ row: i + 1, field: 'brand', message: 'Brand is required' });
        }
        if (!product.category) {
          errors.push({ row: i + 1, field: 'category', message: 'Category is required' });
        }

        // Only add product if it has required fields
        if (product.name && product.brand && product.category) {
          products.push(product);
        }
      }

      setValidationErrors(errors);
      setParsedProducts(products);
      
      if (products.length === 0 && errors.length > 0) {
        setParseError('No valid products found. Please check the validation errors below.');
      }
    } catch (error) {
      console.error('CSV parse error:', error);
      setParseError('Failed to parse CSV file. Please check the format and try again.');
    }
  };

  // Import products to database
  const handleImport = async () => {
    const authToken = getAuthToken();
    if (parsedProducts.length === 0 || !authToken) return;

    setImporting(true);

    try {
      // Prepare products for bulk import
      const productsToInsert = parsedProducts.map(product => ({
        name: product.name,
        brand: product.brand || null,
        category: product.category || null,
        description: product.description || null,
        price: product.price || null,
        image_url: product.image_url || null,
        purchase_url: product.purchase_url || null,
        ingredients: product.ingredients || [],
        skin_types: product.skin_types || [],
        concerns: [],
        is_active: true,
        is_global: false,
      }));

      apiClient.setAuthToken(authToken);
      const response = await apiClient.post<{
        success: boolean;
        data?: { success: number; failed: number; errors: string[] };
        error?: string;
      }>('/api/professional/products/bulk-import', { products: productsToInsert });

      const successCount = response.data.data?.success || 0;
      const failedCount = response.data.data?.failed || 0;
      const errors = response.data.data?.errors || [];

      setResult({
        success: successCount,
        failed: failedCount,
        errors,
      });

      if (successCount > 0) {
        toast({
          title: 'Import Successful',
          description: `${successCount} product${successCount > 1 ? 's' : ''} imported successfully.`,
        });
        
        // Callback to refresh products list
        if (onImportComplete) {
          onImportComplete();
        }
      }

      if (failedCount > 0) {
        toast({
          title: 'Import Partially Failed',
          description: `${failedCount} product${failedCount > 1 ? 's' : ''} failed to import.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      setResult({
        success: 0,
        failed: parsedProducts.length,
        errors: ['An unexpected error occurred. Please try again.'],
      });
      toast({
        title: 'Import Failed',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  // Download CSV template

  const downloadTemplate = () => {
    // Download the template file from public folder
    const link = document.createElement('a');
    link.href = '/product_import_template.csv';
    link.download = 'product_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Template Downloaded',
      description: 'CSV template has been downloaded. Fill it with your products and upload.',
    });
  };


  // Reset import state
  const resetImport = () => {
    setSelectedFile(null);
    setParsedProducts([]);
    setResult(null);
    setParseError(null);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-bold text-gray-900">CSV Bulk Import</h3>
            <p className="text-sm text-gray-500">Upload a CSV file to import multiple products at once</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {!selectedFile && !result && (
          <>
            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-6 ${
                isDragging 
                  ? 'border-teal-400 bg-teal-50' 
                  : 'border-gray-200 hover:border-teal-400'
              }`}
            >
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-teal-500' : 'text-gray-400'}`} />
              <p className="text-gray-700 font-medium mb-2">Click to upload CSV file</p>
              <p className="text-gray-500 text-sm">or drag and drop</p>
            </div>

            {/* Template Download */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">
                    Your CSV file should include the following columns: <strong>name</strong>, <strong>brand</strong>, <strong>category</strong> (required), description, price, image_url, purchase_url, ingredients, skin_types
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    <strong>Note:</strong> For ingredients and skin_types, use pipe (|) to separate multiple values. Example: "Vitamin C|Vitamin E|Hyaluronic Acid"
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    <strong>Valid categories:</strong> {VALID_CATEGORIES.join(', ')}
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    <strong>Valid skin types:</strong> {VALID_SKIN_TYPES.join(', ')}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadTemplate();
                    }}
                    className="inline-flex items-center gap-2 text-sm text-teal-600 font-medium hover:text-teal-700"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Parse Error */}
        {parseError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900">Error parsing file</p>
                <p className="text-sm text-red-700">{parseError}</p>
              </div>
            </div>
            <button
              onClick={resetImport}
              className="mt-3 text-sm text-red-600 font-medium hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && !result && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 mb-2">Validation Warnings ({validationErrors.length})</p>
                <div className="max-h-32 overflow-y-auto">
                  <ul className="text-sm text-amber-700 space-y-1">
                    {validationErrors.slice(0, 10).map((error, i) => (
                      <li key={i}>
                        Row {error.row}: {error.message}
                      </li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="font-medium">...and {validationErrors.length - 10} more warnings</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Parsed Products Preview */}
        {selectedFile && parsedProducts.length > 0 && !result && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{parsedProducts.length} products found</p>
              </div>
              <button
                onClick={resetImport}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Preview Table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Brand</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Price</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Ingredients</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedProducts.slice(0, 10).map((product, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{product.name}</td>
                        <td className="px-4 py-3">{product.brand}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">{product.price ? `$${product.price.toFixed(2)}` : '-'}</td>
                        <td className="px-4 py-3">
                          {product.ingredients && product.ingredients.length > 0 
                            ? product.ingredients.slice(0, 2).join(', ') + (product.ingredients.length > 2 ? '...' : '')
                            : '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedProducts.length > 10 && (
                <div className="px-4 py-2 bg-gray-50 text-sm text-gray-500 text-center">
                  +{parsedProducts.length - 10} more products
                </div>
              )}
            </div>

            {/* Import Button */}
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Import {parsedProducts.length} Products
                </>
              )}
            </button>
          </div>
        )}

        {/* Import Result */}
        {result && (
          <div className={`p-6 rounded-xl ${result.failed === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-center gap-3 mb-4">
              {result.failed === 0 ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <AlertCircle className="w-8 h-8 text-amber-500" />
              )}
              <div>
                <h4 className="font-medium text-gray-900">Import Complete</h4>
                <p className="text-sm text-gray-600">
                  {result.success} product{result.success !== 1 ? 's' : ''} imported successfully
                  {result.failed > 0 && `, ${result.failed} failed`}
                </p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-amber-800 mb-2">Errors:</p>
                <ul className="text-sm text-amber-700 list-disc list-inside">
                  {result.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={resetImport}
              className="text-sm text-gray-600 font-medium hover:text-gray-900"
            >
              Import more products
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVProductImport;
