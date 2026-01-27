import React from 'react';
import { Sparkles, BookOpen, X } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToGuide: () => void;
  userName?: string;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onGoToGuide,
  userName,
}) => {
  if (!isOpen) return null;

  const displayName = userName?.split(' ')[0] || 'there';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Decorative top gradient */}
        <div className="h-32 bg-gradient-to-br from-[#4A9BAF] via-[#5BA8BC] to-[#CFAFA3] relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-ping">
                <Sparkles className="w-16 h-16 text-white/20" />
              </div>
              <Sparkles className="w-16 h-16 text-white drop-shadow-lg" />
            </div>
          </div>
          {/* Floating decorative circles */}
          <div className="absolute -top-6 -left-6 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute top-8 right-12 w-8 h-8 bg-white/20 rounded-full" />
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">
            Welcome, {displayName}! 🎉
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            We're so excited to have you here! Your skincare journey starts now. 
            Take a quick look at our guide to get the most out of your personalized plan.
          </p>

          {/* Features preview */}
          <div className="bg-gradient-to-br from-[#F9F7F5] to-[#F5F0ED] rounded-2xl p-4 mb-6">
            <p className="text-sm text-gray-500 mb-3">In the guide, you'll learn:</p>
            <ul className="text-left text-sm text-gray-700 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#4A9BAF]/20 flex items-center justify-center text-xs text-[#4A9BAF]">✓</span>
                How to follow your personalized routine
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#4A9BAF]/20 flex items-center justify-center text-xs text-[#4A9BAF]">✓</span>
                Tips for tracking your progress
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#4A9BAF]/20 flex items-center justify-center text-xs text-[#4A9BAF]">✓</span>
                What to expect in the coming weeks
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={onGoToGuide}
              className="w-full px-6 py-4 bg-gradient-to-r from-[#4A9BAF] to-[#5BA8BC] text-white rounded-xl hover:opacity-90 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg shadow-[#4A9BAF]/25"
            >
              <BookOpen className="w-5 h-5" />
              Go to Guide
            </button>
            <button
              onClick={onClose}
              className="w-full px-6 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
