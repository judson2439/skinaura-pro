import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  AnnotationData,
  Annotation,
  DrawingPath,
  TextAnnotation,
  ShapeAnnotation,
  MarkerAnnotation,
  PhotoAnnotation
} from '@/hooks/usePhotoAnnotations';
import { Loader2, ChevronLeft, ChevronRight, Edit, Calendar, MessageSquare, ZoomIn, ZoomOut } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AnnotationViewerProps {
  imageUrl: string;
  annotations: PhotoAnnotation[];
  onClose?: () => void;
  onEdit?: (annotation: PhotoAnnotation) => void;
  showControls?: boolean;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AnnotationViewer: React.FC<AnnotationViewerProps> = ({
  imageUrl,
  annotations,
  onClose,
  onEdit,
  showControls = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [currentAnnotationIndex, setCurrentAnnotationIndex] = useState(0);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [zoom, setZoom] = useState(1);

  const currentAnnotation = annotations[currentAnnotationIndex];

  // Load image and set canvas size
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      
      // Calculate canvas size to fit container while maintaining aspect ratio
      const container = containerRef.current;
      if (container) {
        const maxWidth = container.clientWidth - 40;
        const maxHeight = window.innerHeight - 200;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        
        setCanvasSize({
          width: img.width * scale,
          height: img.height * scale,
        });
      }
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw everything on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    
    if (!canvas || !ctx || !img) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Draw annotations if enabled and we have annotation data
    if (showAnnotations && currentAnnotation?.annotation_data?.annotations) {
      const annotationData = currentAnnotation.annotation_data;
      
      // Calculate scale factor if the annotation was made at a different canvas size
      const scaleX = canvas.width / (annotationData.width || canvas.width);
      const scaleY = canvas.height / (annotationData.height || canvas.height);
      
      annotationData.annotations.forEach((ann) => {
        drawAnnotation(ctx, ann, scaleX, scaleY);
      });
    }
  }, [currentAnnotation, showAnnotations]);

  useEffect(() => {
    if (imageLoaded) {
      draw();
    }
  }, [imageLoaded, draw, currentAnnotationIndex, showAnnotations]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, ann: Annotation, scaleX: number, scaleY: number) => {
    ctx.save();
    
    if (ann.type === 'pen' || ann.type === 'highlighter') {
      const path = ann as DrawingPath;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width * Math.min(scaleX, scaleY);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = path.opacity;
      
      if (path.points.length > 0) {
        ctx.moveTo(path.points[0].x * scaleX, path.points[0].y * scaleY);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x * scaleX, path.points[i].y * scaleY);
        }
      }
      ctx.stroke();
    } else if (ann.type === 'text') {
      const text = ann as TextAnnotation;
      const scaledFontSize = text.fontSize * Math.min(scaleX, scaleY);
      ctx.font = `${scaledFontSize}px Arial`;
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x * scaleX, text.y * scaleY);
    } else if (ann.type === 'arrow' || ann.type === 'line' || ann.type === 'circle' || ann.type === 'rectangle') {
      const shape = ann as ShapeAnnotation;
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.width * Math.min(scaleX, scaleY);
      
      const startX = shape.startX * scaleX;
      const startY = shape.startY * scaleY;
      const endX = shape.endX * scaleX;
      const endY = shape.endY * scaleY;
      
      if (shape.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      } else if (shape.type === 'arrow') {
        // Draw line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Draw arrowhead
        const angle = Math.atan2(endY - startY, endX - startX);
        const headLength = 15 * Math.min(scaleX, scaleY);
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLength * Math.cos(angle - Math.PI / 6),
          endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLength * Math.cos(angle + Math.PI / 6),
          endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      } else if (shape.type === 'circle') {
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        const radiusX = Math.abs(endX - startX) / 2;
        const radiusY = Math.abs(endY - startY) / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (shape.type === 'rectangle') {
        ctx.strokeRect(
          Math.min(startX, endX),
          Math.min(startY, endY),
          Math.abs(endX - startX),
          Math.abs(endY - startY)
        );
      }
    } else if (ann.type === 'marker') {
      const marker = ann as MarkerAnnotation;
      const x = marker.x * scaleX;
      const y = marker.y * scaleY;
      const markerScale = Math.min(scaleX, scaleY);
      
      // Draw marker pin
      ctx.fillStyle = marker.color;
      ctx.beginPath();
      ctx.arc(x, y - 12 * markerScale, 10 * markerScale, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw pin point
      ctx.beginPath();
      ctx.moveTo(x - 6 * markerScale, y - 8 * markerScale);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 6 * markerScale, y - 8 * markerScale);
      ctx.fill();
      
      // Draw label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${12 * markerScale}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(marker.label, x, y - 8 * markerScale);
      ctx.textAlign = 'left';
    }
    
    ctx.restore();
  };

  const goToPrevious = () => {
    setCurrentAnnotationIndex((prev) => (prev > 0 ? prev - 1 : annotations.length - 1));
  };

  const goToNext = () => {
    setCurrentAnnotationIndex((prev) => (prev < annotations.length - 1 ? prev + 1 : 0));
  };

  if (annotations.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 bg-gray-50 rounded-xl ${className}`}>
        <Edit className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-500 text-center">No annotations available for this photo</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Canvas Container */}
      <div ref={containerRef} className="relative flex items-center justify-center bg-gray-900 rounded-xl overflow-hidden">
        {!imageLoaded ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        ) : (
          <div className="relative" style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}>
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="rounded-lg"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>
        )}

        {/* Toggle Annotations Button */}
        {showControls && (
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`absolute top-3 left-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              showAnnotations
                ? 'bg-[#CFAFA3] text-white'
                : 'bg-white/90 text-gray-700 hover:bg-white'
            }`}
          >
            {showAnnotations ? 'Hide Markup' : 'Show Markup'}
          </button>
        )}

        {/* Zoom Controls */}
        {showControls && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 rounded-lg p-1">
            <button
              onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-xs font-medium text-gray-600 px-2">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(Math.min(2, zoom + 0.25))}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        )}

        {/* Navigation Arrows (if multiple annotations) */}
        {showControls && annotations.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-lg"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </>
        )}
      </div>

      {/* Annotation Info */}
      {showControls && currentAnnotation && (
        <div className="mt-4 p-4 bg-white rounded-xl border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900">
                {currentAnnotation.title || 'Professional Markup'}
              </h4>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(currentAnnotation.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
                {annotations.length > 1 && (
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                    {currentAnnotationIndex + 1} of {annotations.length}
                  </span>
                )}
              </div>
            </div>
            {onEdit && (
              <button
                onClick={() => onEdit(currentAnnotation)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#CFAFA3]/10 text-[#CFAFA3] rounded-lg text-sm font-medium hover:bg-[#CFAFA3]/20 transition-colors"
              >
                <Edit className="w-4 h-4" /> Edit
              </button>
            )}
          </div>
          
          {currentAnnotation.notes && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-[#CFAFA3]" />
                <span className="text-xs font-medium text-gray-500">Professional Notes</span>
              </div>
              <p className="text-sm text-gray-700">{currentAnnotation.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Pagination Dots (if multiple annotations) */}
      {showControls && annotations.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {annotations.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentAnnotationIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentAnnotationIndex
                  ? 'bg-[#CFAFA3] w-6'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnotationViewer;

