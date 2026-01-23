import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Image, CheckCircle, AlertCircle } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface UploadLogoSectionProps {
  onNavigateToView?: (viewId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const UploadLogoSection: React.FC<UploadLogoSectionProps> = ({ onNavigateToView }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate and process the file
  const processFile = useCallback((file: File) => {
    setError(null);

    // Check if file is PNG
    if (file.type !== 'image/png') {
      setError('Only PNG files are allowed. Please select a .png file.');
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB.');
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSelectedFile(file);
  }, []);

  // Handle file input change
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  // Handle click on drop zone
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Remove selected file
  const handleRemove = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
          <Upload className="w-6 h-6 text-[#2D2A3E]" />
        </div>
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#2D2A3E]">Upload Logo</h2>
          <p className="text-gray-500">Customize your branding</p>
        </div>
      </div>

      {/* Upload Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,image/png"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Drop Zone */}
        {!selectedFile ? (
          <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
              ${isDragging 
                ? 'border-[#CFAFA3] bg-[#CFAFA3]/10 scale-[1.02]' 
                : 'border-gray-200 hover:border-[#CFAFA3] hover:bg-gray-50'
              }
            `}
          >
            <div className={`
              w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors
              ${isDragging ? 'bg-[#CFAFA3]/20' : 'bg-gray-100'}
            `}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-[#CFAFA3]' : 'text-gray-400'}`} />
            </div>
            <p className="text-gray-700 font-medium mb-2">
              {isDragging ? 'Drop your PNG file here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-gray-500 text-sm mb-4">PNG files only (max 5MB)</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D2A3E] text-white rounded-lg text-sm font-medium hover:bg-[#3D3A4E] transition-colors">
              <Image className="w-4 h-4" />
              Select PNG File
            </div>
          </div>
        ) : (
          /* Preview Section */
          <div className="space-y-6">
            {/* Success Message */}
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-green-700 font-medium">Logo uploaded successfully</p>
                <p className="text-green-600 text-sm">{selectedFile.name}</p>
              </div>
              <button
                onClick={handleRemove}
                className="p-2 hover:bg-green-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-green-600" />
              </button>
            </div>

            {/* Image Preview */}
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 mb-4">Preview</p>
              <div className="relative p-4 bg-gray-50 rounded-xl border border-gray-200">
                {/* Checkerboard pattern for transparency */}
                <div 
                  className="absolute inset-4 rounded-lg"
                  style={{
                    backgroundImage: `linear-gradient(45deg, #e0e0e0 25%, transparent 25%), 
                                      linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), 
                                      linear-gradient(45deg, transparent 75%, #e0e0e0 75%), 
                                      linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)`,
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  }}
                />
                <img
                  src={previewUrl || ''}
                  alt="Logo preview"
                  className="relative max-w-[300px] max-h-[200px] object-contain"
                />
              </div>
              <p className="text-xs text-gray-400 mt-3">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-3">
              <button
                onClick={handleRemove}
                className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Remove
              </button>
              <button
                onClick={handleClick}
                className="px-6 py-2.5 bg-[#2D2A3E] text-white rounded-lg font-medium hover:bg-[#3D3A4E] transition-colors"
              >
                Replace Logo
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-3 p-4 mt-4 bg-red-50 rounded-xl border border-red-100">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Logo Requirements</h4>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• Format: PNG only (supports transparency)</li>
            <li>• Maximum size: 5MB</li>
            <li>• Recommended dimensions: 500x500px or larger</li>
            <li>• Square or horizontal logos work best</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UploadLogoSection;
