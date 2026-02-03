/**
 * EncryptedImage Component
 * Displays images that are stored encrypted on the server.
 * Images are encrypted on frontend before upload, stored encrypted on server,
 * and decrypted on frontend when displaying.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User, Package } from 'lucide-react';
import { getAuthSession, getAuthToken } from '@/lib/authStorage';
import { decryptFileToBlob } from '@/lib/encryption';

interface EncryptedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  showFallback?: boolean;
  fallbackIcon?: 'user' | 'package';
}

// Encrypted image data format from backend
interface EncryptedImageData {
  encrypted: string;  // Base64 encoded encrypted data
  iv: string;         // Base64 encoded IV
  mimeType: string;   // Original mime type
}

/**
 * Component to display encrypted images from the backend
 * Fetches encrypted data and decrypts it client-side
 */
export const EncryptedImage: React.FC<EncryptedImageProps> = ({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  showFallback = true,
  fallbackIcon = 'user',
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchAndDecryptImage = useCallback(async (url: string) => {
    try {
      setLoading(true);
      setError(false);

      // Get auth token (optional for image fetching, but included for consistency)
      const authSession = getAuthSession();
      const token = authSession?.token || getAuthToken();

      // Fetch encrypted image data
      const response = await fetch(url, {
        method: 'GET',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      // Check if response is JSON (encrypted data) or binary (legacy)
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        // New format: JSON with encrypted data - decrypt client-side
        const encryptedData: EncryptedImageData = await response.json();
        
        if (!encryptedData.encrypted || !encryptedData.iv) {
          throw new Error('Invalid encrypted image data');
        }

        // Decrypt the image data
        const decryptedBlob = await decryptFileToBlob(
          encryptedData.encrypted,
          encryptedData.iv,
          encryptedData.mimeType || 'image/jpeg'
        );

        // Create object URL from decrypted blob
        const objectUrl = URL.createObjectURL(decryptedBlob);
        setImageSrc(objectUrl);
      } else {
        // Legacy format: direct binary image (fallback)
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching/decrypting image:', err);
      setError(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Cleanup previous object URL
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    // If it's a data URL, use it directly
    if (src.startsWith('data:')) {
      setImageSrc(src);
      setLoading(false);
      return;
    }

    // If it's already a blob URL, use it directly
    if (src.startsWith('blob:')) {
      setImageSrc(src);
      setLoading(false);
      return;
    }

    // Normalize /uploads/category/filename (encrypted) to /api/images/category/filename
    // so we use the decrypt endpoint instead of static file (which would serve raw JSON).
    let normalizedSrc = src;
    const uploadsMatch = src.match(/\/uploads\/([^/]+)\/([^/?#]+)$/);
    if (uploadsMatch) {
      const [, category, filename] = uploadsMatch;
      if (filename.startsWith('enc_')) {
        normalizedSrc = `/api/images/${category}/${filename}`;
      }
    }

    // Check if this is an encrypted image URL (from our backend)
    const isEncryptedImage = normalizedSrc.includes('/api/products/image/') || 
                             normalizedSrc.includes('/api/images/') ||
                             normalizedSrc.includes('/api/photos/');

    if (isEncryptedImage) {
      // Construct full URL if needed
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const fullUrl = normalizedSrc.startsWith('http') ? normalizedSrc : 
                      normalizedSrc.startsWith('/') ? `${apiBaseUrl}${normalizedSrc}` : `${apiBaseUrl}/${normalizedSrc}`;
      
      fetchAndDecryptImage(fullUrl);
    } else {
      // Regular image URL (external or legacy unencrypted)
      if (src.startsWith('http://') || src.startsWith('https://')) {
        setImageSrc(src);
      } else {
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
        setImageSrc(src.startsWith('/') ? `${apiBaseUrl}${src}` : `${apiBaseUrl}/${src}`);
      }
      setLoading(false);
    }
  }, [src, fetchAndDecryptImage]);

  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const FallbackIcon = fallbackIcon === 'package' ? Package : User;

  // Show fallback
  if (error || !imageSrc) {
    if (!showFallback) return null;
    
    return (
      <div 
        className={`flex items-center justify-center bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] ${fallbackClassName || className}`}
      >
        <FallbackIcon className="w-1/2 h-1/2 text-white/80" />
      </div>
    );
  }

  return (
    <>
      {loading && showFallback && (
        <div 
          className={`flex items-center justify-center bg-gray-200 animate-pulse ${className}`}
        >
          <FallbackIcon className="w-1/2 h-1/2 text-gray-400" />
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
