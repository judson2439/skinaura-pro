import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Pencil,
  Highlighter,
  Type,
  ArrowRight,
  Minus,
  Circle,
  Square,
  MapPin,
  Undo2,
  Redo2,
  Trash2,
  Save,
  X,
  Palette,
  RotateCcw,
  Loader2,
  MousePointer,
} from 'lucide-react';
import {
  Annotation,
  AnnotationData,
  DrawingPath,
  TextAnnotation,
  ShapeAnnotation,
  MarkerAnnotation,
  AnnotationPoint,
  generateAnnotationId
} from '@/hooks/usePhotoAnnotations';

// ============================================================================
// TYPES
// ============================================================================

interface ImageMarkupEditorProps {
  imageUrl: string;
  initialAnnotations?: AnnotationData;
  onSave: (annotationData: AnnotationData, imageBlob: Blob) => void;
  onCancel: () => void;
  saving?: boolean;
}


type Tool = 'select' | 'pen' | 'highlighter' | 'text' | 'arrow' | 'line' | 'circle' | 'rectangle' | 'marker';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#000000', // Black
  '#FFFFFF', // White
];

// ============================================================================
// COMPONENT
// ============================================================================

const ImageMarkupEditor: React.FC<ImageMarkupEditorProps> = ({
  imageUrl,
  initialAnnotations,
  onSave,
  onCancel,
  saving = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#EF4444');
  const [brushSize, setBrushSize] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations?.annotations || []);
  const [history, setHistory] = useState<Annotation[][]>([initialAnnotations?.annotations || []]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<AnnotationPoint[]>([]);
  const [startPoint, setStartPoint] = useState<AnnotationPoint | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState<AnnotationPoint | null>(null);
  const [markerInput, setMarkerInput] = useState('');
  const [markerPosition, setMarkerPosition] = useState<AnnotationPoint | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [showColorPicker, setShowColorPicker] = useState(false);

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
        const maxHeight = window.innerHeight - 300;
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
    
    // Draw all annotations
    annotations.forEach((ann) => {
      drawAnnotation(ctx, ann, ann.id === selectedAnnotation);
    });
    
    // Draw current path being drawn
    if (isDrawing && currentPath.length > 0 && (tool === 'pen' || tool === 'highlighter')) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = tool === 'highlighter' ? brushSize * 3 : brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = tool === 'highlighter' ? 0.4 : opacity;
      
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    
    // Draw shape preview
    if (isDrawing && startPoint && (tool === 'arrow' || tool === 'line' || tool === 'circle' || tool === 'rectangle')) {
      const endPoint = currentPath[currentPath.length - 1];
      if (endPoint) {
        drawShapePreview(ctx, tool, startPoint, endPoint);
      }
    }
  }, [annotations, currentPath, isDrawing, tool, color, brushSize, opacity, selectedAnnotation]);

  useEffect(() => {
    if (imageLoaded) {
      draw();
    }
  }, [imageLoaded, draw]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, ann: Annotation, isSelected: boolean) => {
    ctx.save();
    
    if (ann.type === 'pen' || ann.type === 'highlighter') {
      const path = ann as DrawingPath;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = path.opacity;
      
      if (path.points.length > 0) {
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
      }
      ctx.stroke();
    } else if (ann.type === 'text') {
      const text = ann as TextAnnotation;
      ctx.font = `${text.fontSize}px Arial`;
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
      
      if (isSelected) {
        const metrics = ctx.measureText(text.text);
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(text.x - 4, text.y - text.fontSize, metrics.width + 8, text.fontSize + 8);
        ctx.setLineDash([]);
      }
    } else if (ann.type === 'arrow' || ann.type === 'line' || ann.type === 'circle' || ann.type === 'rectangle') {
      const shape = ann as ShapeAnnotation;
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.width;
      
      if (shape.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(shape.startX, shape.startY);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();
      } else if (shape.type === 'arrow') {
        // Draw line
        ctx.beginPath();
        ctx.moveTo(shape.startX, shape.startY);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();
        
        // Draw arrowhead
        const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX);
        const headLength = 15;
        ctx.beginPath();
        ctx.moveTo(shape.endX, shape.endY);
        ctx.lineTo(
          shape.endX - headLength * Math.cos(angle - Math.PI / 6),
          shape.endY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(shape.endX, shape.endY);
        ctx.lineTo(
          shape.endX - headLength * Math.cos(angle + Math.PI / 6),
          shape.endY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      } else if (shape.type === 'circle') {
        const centerX = (shape.startX + shape.endX) / 2;
        const centerY = (shape.startY + shape.endY) / 2;
        const radiusX = Math.abs(shape.endX - shape.startX) / 2;
        const radiusY = Math.abs(shape.endY - shape.startY) / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (shape.type === 'rectangle') {
        ctx.strokeRect(
          Math.min(shape.startX, shape.endX),
          Math.min(shape.startY, shape.endY),
          Math.abs(shape.endX - shape.startX),
          Math.abs(shape.endY - shape.startY)
        );
      }
      
      if (isSelected) {
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const minX = Math.min(shape.startX, shape.endX) - 5;
        const minY = Math.min(shape.startY, shape.endY) - 5;
        const maxX = Math.max(shape.startX, shape.endX) + 5;
        const maxY = Math.max(shape.startY, shape.endY) + 5;
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        ctx.setLineDash([]);
      }
    } else if (ann.type === 'marker') {
      const marker = ann as MarkerAnnotation;
      
      // Draw marker pin
      ctx.fillStyle = marker.color;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y - 12, 10, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw pin point
      ctx.beginPath();
      ctx.moveTo(marker.x - 6, marker.y - 8);
      ctx.lineTo(marker.x, marker.y);
      ctx.lineTo(marker.x + 6, marker.y - 8);
      ctx.fill();
      
      // Draw label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(marker.label, marker.x, marker.y - 8);
      ctx.textAlign = 'left';
      
      if (isSelected) {
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(marker.x - 15, marker.y - 27, 30, 32);
        ctx.setLineDash([]);
      }
    }
    
    ctx.restore();
  };

  const drawShapePreview = (ctx: CanvasRenderingContext2D, shapeType: Tool, start: AnnotationPoint, end: AnnotationPoint) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.setLineDash([5, 5]);
    
    if (shapeType === 'line') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (shapeType === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLength = 15;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (shapeType === 'circle') {
      const centerX = (start.x + end.x) / 2;
      const centerY = (start.y + end.y) / 2;
      const radiusX = Math.abs(end.x - start.x) / 2;
      const radiusY = Math.abs(end.y - start.y) / 2;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shapeType === 'rectangle') {
      ctx.strokeRect(
        Math.min(start.x, end.x),
        Math.min(start.y, end.y),
        Math.abs(end.x - start.x),
        Math.abs(end.y - start.y)
      );
    }
    
    ctx.restore();
  };

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>): AnnotationPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(e);
    
    if (tool === 'select') {
      // Check if clicking on an annotation
      const clicked = findAnnotationAtPoint(point);
      setSelectedAnnotation(clicked?.id || null);
      return;
    }
    
    if (tool === 'text') {
      setTextPosition(point);
      setTextInput('');
      return;
    }
    
    if (tool === 'marker') {
      setMarkerPosition(point);
      setMarkerInput('');
      return;
    }
    
    setIsDrawing(true);
    setStartPoint(point);
    setCurrentPath([point]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const point = getCanvasPoint(e);
    setCurrentPath(prev => [...prev, point]);
    draw();
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    if (tool === 'pen' || tool === 'highlighter') {
      if (currentPath.length > 1) {
        const newAnnotation: DrawingPath = {
          id: generateAnnotationId(),
          type: tool,
          points: currentPath,
          color,
          width: tool === 'highlighter' ? brushSize * 3 : brushSize,
          opacity: tool === 'highlighter' ? 0.4 : opacity,
        };
        addAnnotation(newAnnotation);
      }
    } else if ((tool === 'arrow' || tool === 'line' || tool === 'circle' || tool === 'rectangle') && startPoint) {
      const endPoint = currentPath[currentPath.length - 1];
      if (endPoint && (Math.abs(endPoint.x - startPoint.x) > 5 || Math.abs(endPoint.y - startPoint.y) > 5)) {
        const newAnnotation: ShapeAnnotation = {
          id: generateAnnotationId(),
          type: tool as 'arrow' | 'line' | 'circle' | 'rectangle',
          startX: startPoint.x,
          startY: startPoint.y,
          endX: endPoint.x,
          endY: endPoint.y,
          color,
          width: brushSize,
        };
        addAnnotation(newAnnotation);
      }
    }
    
    setCurrentPath([]);
    setStartPoint(null);
  };

  const findAnnotationAtPoint = (point: AnnotationPoint): Annotation | null => {
    // Check in reverse order (top-most first)
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      if (ann.type === 'marker') {
        const marker = ann as MarkerAnnotation;
        if (Math.abs(point.x - marker.x) < 15 && Math.abs(point.y - marker.y + 12) < 15) {
          return ann;
        }
      } else if (ann.type === 'text') {
        const text = ann as TextAnnotation;
        // Rough hit detection for text
        if (point.x >= text.x && point.x <= text.x + 100 && point.y >= text.y - text.fontSize && point.y <= text.y) {
          return ann;
        }
      }
    }
    return null;
  };

  const addAnnotation = (annotation: Annotation) => {
    const newAnnotations = [...annotations, annotation];
    setAnnotations(newAnnotations);
    
    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const addTextAnnotation = () => {
    if (!textPosition || !textInput.trim()) return;
    
    const newAnnotation: TextAnnotation = {
      id: generateAnnotationId(),
      type: 'text',
      x: textPosition.x,
      y: textPosition.y,
      text: textInput,
      color,
      fontSize: brushSize * 6,
    };
    addAnnotation(newAnnotation);
    setTextPosition(null);
    setTextInput('');
  };

  const addMarkerAnnotation = () => {
    if (!markerPosition || !markerInput.trim()) return;
    
    const newAnnotation: MarkerAnnotation = {
      id: generateAnnotationId(),
      type: 'marker',
      x: markerPosition.x,
      y: markerPosition.y,
      label: markerInput.slice(0, 3).toUpperCase(),
      color,
    };
    addAnnotation(newAnnotation);
    setMarkerPosition(null);
    setMarkerInput('');
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAnnotations(history[historyIndex + 1]);
    }
  };

  const deleteSelected = () => {
    if (!selectedAnnotation) return;
    const newAnnotations = annotations.filter(a => a.id !== selectedAnnotation);
    setAnnotations(newAnnotations);
    setSelectedAnnotation(null);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const clearAll = () => {
    if (!window.confirm('Are you sure you want to clear all annotations?')) return;
    setAnnotations([]);
    setSelectedAnnotation(null);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export canvas as blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to export canvas as blob'));
        }
      }, 'image/png', 1.0);
    });

    const annotationData: AnnotationData = {
      annotations,
      width: canvasSize.width,
      height: canvasSize.height,
    };
    
    onSave(annotationData, blob);
  };


  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer className="w-4 h-4" />, label: 'Select' },
    { id: 'pen', icon: <Pencil className="w-4 h-4" />, label: 'Pen' },
    { id: 'highlighter', icon: <Highlighter className="w-4 h-4" />, label: 'Highlighter' },
    { id: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
    { id: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow' },
    { id: 'line', icon: <Minus className="w-4 h-4" />, label: 'Line' },
    { id: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
    { id: 'rectangle', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
    { id: 'marker', icon: <MapPin className="w-4 h-4" />, label: 'Marker' },
  ];

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-serif font-bold text-lg">Image Markup</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={historyIndex === 0}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex === history.length - 1}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo2 className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-gray-200 mx-2" />
          <button
            onClick={deleteSelected}
            disabled={!selectedAnnotation}
            className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete Selected"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={clearAll}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Clear All"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-gray-200 mx-2" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Markup
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Toolbar */}
        <div className="w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 gap-2">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                tool === t.id
                  ? 'bg-[#CFAFA3] text-white'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
          
          <div className="w-8 h-px bg-gray-200 my-2" />
          
          {/* Color Picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-10 h-10 rounded-lg border-2 border-gray-200 flex items-center justify-center"
              style={{ backgroundColor: color }}
              title="Color"
            >
              <Palette className="w-4 h-4" style={{ color: color === '#FFFFFF' || color === '#EAB308' ? '#000' : '#FFF' }} />
            </button>
            
            {showColorPicker && (
              <div className="absolute left-14 top-0 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-10 w-[140px]">
                <div className="grid grid-cols-5 gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setColor(c);
                        setShowColorPicker(false);
                      }}
                      className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                        color === c ? 'ring-2 ring-[#CFAFA3] ring-offset-1' : 'border border-gray-300'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Brush Size */}
          <div className="flex flex-col items-center gap-2 mt-4 px-2">
            <span className="text-xs text-gray-500 font-medium">Size</span>
            <div className="relative h-24 flex items-center justify-center">
              <input
                type="range"
                min="1"
                max="10"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="h-24 w-2 appearance-none bg-gray-200 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#CFAFA3] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#CFAFA3] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                style={{ 
                  writingMode: 'vertical-lr',
                  WebkitAppearance: 'slider-vertical'
                }}
              />
            </div>
            <span className="text-sm font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">{brushSize}</span>
          </div>
        </div>


        <div ref={containerRef} className="flex-1 flex items-center justify-center bg-gray-900 p-4 overflow-auto">
          {!imageLoaded ? (
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="rounded-lg shadow-2xl cursor-crosshair"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          )}
        </div>
      </div>

      {/* Text Input Modal */}
      {textPosition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-medium text-lg mb-4">Add Text Annotation</h3>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
              placeholder="Enter text..."
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setTextPosition(null)}
                className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addTextAnnotation}
                disabled={!textInput.trim()}
                className="flex-1 py-2 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] disabled:opacity-50"
              >
                Add Text
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Marker Input Modal */}
      {markerPosition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-medium text-lg mb-4">Add Marker</h3>
            <p className="text-sm text-gray-500 mb-3">Enter a short label (1-3 characters)</p>
            <input
              type="text"
              value={markerInput}
              onChange={(e) => setMarkerInput(e.target.value.slice(0, 3))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none text-center text-2xl font-bold uppercase"
              placeholder="A1"
              maxLength={3}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setMarkerPosition(null)}
                className="flex-1 py-2 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addMarkerAnnotation}
                disabled={!markerInput.trim()}
                className="flex-1 py-2 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] disabled:opacity-50"
              >
                Add Marker
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageMarkupEditor;
