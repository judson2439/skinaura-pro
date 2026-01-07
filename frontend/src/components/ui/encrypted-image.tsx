/**
 * EncryptedImage Component
 * Displays images that are stored encrypted on the server
 * The server decrypts them on-the-fly when requested
 */

import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface EncryptedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  showFallback?: boolean;
}

/**
 * Component to display encrypted images from the backend
 * The backend handles decryption, so we just need to fetch the image URL
 */
export const EncryptedImage: React.FC<EncryptedImageProps> = ({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  showFallback = true,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    // If it's already a full URL or data URL, use it directly
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      setImageSrc(src);
      setLoading(false);
      return;
    }

    // For API paths, construct the full URL
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const fullUrl = src.startsWith('/') ? `${apiBaseUrl}${src}` : `${apiBaseUrl}/${src}`;
    
    setImageSrc(fullUrl);
    setLoading(false);
  }, [src]);

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  // Show fallback avatar
  if (error || !imageSrc) {
    if (!showFallback) return null;
    
    return (
      <div 
        className={`flex items-center justify-center bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] ${fallbackClassName || className}`}
      >
        <User className="w-1/2 h-1/2 text-white/80" />
      </div>
    );
  }

  return (
    <>
      {loading && showFallback && (
        <div 
          className={`flex items-center justify-center bg-gray-200 animate-pulse ${className}`}
        >
          <User className="w-1/2 h-1/2 text-gray-400" />
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        className={`${className} ${loading ? 'hidden' : ''}`}
        onError={handleError}
        onLoad={handleLoad}
      />
    </>
  );
};

export default EncryptedImage;

