import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Eye, EyeOff } from 'lucide-react';
import { PhotoAnnotation } from './progressPhotosTypes';
import { EncryptedImage } from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface AnnotationViewerProps {
  imageUrl: string;
  annotations: PhotoAnnotation[];
  showControls?: boolean;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AnnotationViewer: React.FC<AnnotationViewerProps> = ({
  imageUrl,
  annotations,
  showControls = true,
  className = '',
}) => {
  const [zoom, setZoom] = useState(1);
  const [showMarkup, setShowMarkup] = useState(true);
  
  // Get the latest markup image if available
  const latestMarkup = annotations.length > 0 
    ? annotations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    : null;

  // Determine which image to show
  const displayImage = showMarkup && latestMarkup ? latestMarkup.markup_image : imageUrl;

  return (
    <div className={`relative ${className}`}>
      {/* Controls */}
      {showControls && (
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button
            onClick={() => setZoom(z => Math.min(z + 0.25, 2))}
            className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
            className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
            title="Reset Zoom"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          {latestMarkup && (
            <button
              onClick={() => setShowMarkup(!showMarkup)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                showMarkup ? 'bg-[#CFAFA3] text-white' : 'bg-black/50 text-white hover:bg-black/70'
              }`}
              title={showMarkup ? 'Show Original' : 'Show Markup'}
            >
              {showMarkup ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  Hide Markups
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  Show Markups
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Image display */}
      <div className="w-full h-full overflow-hidden flex items-center justify-center bg-gray-900">
        <div 
          className="relative transition-transform duration-200" 
          style={{ transform: `scale(${zoom})` }}
        >
          <EncryptedImage
            src={displayImage}
            alt={showMarkup && latestMarkup ? "Photo with professional markup" : "Progress photo"}
            className="max-w-full max-h-[550px] object-contain"
            fallbackIcon="user"
            showFallback={true}
          />
        </div>
      </div>

      {/* Markup indicator */}
      {showMarkup && latestMarkup && (
        <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-[#CFAFA3] text-white text-xs font-medium rounded-full">
          Viewing Professional Markup
        </div>
      )}
    </div>
  );
};

export default AnnotationViewer;
