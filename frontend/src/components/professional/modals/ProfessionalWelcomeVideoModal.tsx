import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface ProfessionalWelcomeVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfessionalWelcomeVideoModal: React.FC<ProfessionalWelcomeVideoModalProps> = ({
  isOpen,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#2D2A3E]">
          <h2 className="text-lg font-semibold text-white">Welcome to SkinAura PRO</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video (local file from public/introduction.mp4) */}
        <div className="relative w-full bg-black">
          <video
            ref={videoRef}
            src="/introduction.mp4"
            className="w-full aspect-video object-contain"
            controls
            autoPlay
            playsInline
            muted
          >
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-sm text-gray-600 text-center">
            Watch this short overview to get started. Use the video controls to unmute. You can close this anytime.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalWelcomeVideoModal;
