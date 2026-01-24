import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, SwitchCamera, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, previewUrl: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const CameraCapture: React.FC<CameraCaptureProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Check for multiple cameras
  useEffect(() => {
    if (!isOpen) return;

    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {
        setHasMultipleCameras(false);
      }
    };

    checkCameras();
  }, [isOpen]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Camera error:', err);
      
      let errorMessage = 'Unable to access camera';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'Camera is already in use by another application.';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Camera constraints could not be satisfied.';
        } else if (err.name === 'SecurityError') {
          errorMessage = 'Camera access blocked due to security restrictions.';
        } else {
          errorMessage = err.message || 'Unable to access camera';
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  }, [facingMode]);

  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    }

    return () => {
      // Cleanup on unmount or close
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, startCamera]);

  // Switch camera (front/back)
  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob/file
    canvas.toBlob(
      (blob) => {
        if (blob) {
          // Create File from Blob
          const timestamp = new Date().getTime();
          const file = new File([blob], `photo_${timestamp}.jpg`, {
            type: 'image/jpeg',
            lastModified: timestamp,
          });

          // Get preview URL
          const previewUrl = canvas.toDataURL('image/jpeg', 0.9);

          // Stop camera stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

          onCapture(file, previewUrl);
          onClose();
        }
      },
      'image/jpeg',
      0.9
    );
  };

  // Handle close
  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-[60]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <h3 className="text-white font-medium">Take Photo</h3>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {/* Video Preview */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isLoading || error ? 'hidden' : ''}`}
        />

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading State */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <p className="text-white font-medium">Starting camera...</p>
            <p className="text-white/60 text-sm mt-1">Please allow camera access when prompted</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-6">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-white font-medium text-center mb-2">Camera Error</p>
            <p className="text-white/60 text-sm text-center max-w-sm mb-6">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={startCamera}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
              <button
                onClick={handleClose}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {!isLoading && !error && (
        <div className="px-4 py-6 bg-black/80 flex items-center justify-center gap-6">
          {/* Switch Camera Button (if multiple cameras) */}
          {hasMultipleCameras && (
            <button
              onClick={switchCamera}
              className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <SwitchCamera className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Capture Button */}
          <button
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:bg-gray-200 transition-colors ring-4 ring-white/30"
          >
            <Camera className="w-8 h-8 text-black" />
          </button>

          {/* Spacer for alignment when switch button is present */}
          {hasMultipleCameras && (
            <div className="w-12 h-12" />
          )}
        </div>
      )}
    </div>
  );
};

export default CameraCapture;
