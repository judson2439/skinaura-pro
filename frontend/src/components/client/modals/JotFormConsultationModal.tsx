import React from 'react';
import { ExternalLink } from 'lucide-react';

const JOTFORM_URL = 'https://form.jotform.com/260316219853154';

interface JotFormConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFormSubmitted: () => void;
}

const JotFormConsultationModal: React.FC<JotFormConsultationModalProps> = ({
  isOpen,
  onClose,
  onFormSubmitted,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop - dismissible */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] px-6 py-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-white">
              Skin Care Consultation Form
            </h2>
            <p className="text-sm text-white/90 mt-1">
              Complete the form to continue
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-gray-600">
            Please complete the Skin Care Consultation Form to continue. Click the link below to complete the form.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={JOTFORM_URL}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              Open Consultation Form
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onFormSubmitted}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-[#CFAFA3] text-[#CFAFA3] rounded-xl font-medium hover:bg-[#CFAFA3]/5 transition-all"
            >
              Skip
            </button>
          </div>

          <p className="text-sm text-gray-500">
            You can close this modal at any time. If you&apos;ve already completed the form, click &quot;Skip&quot; to continue.
          </p>
        </div>
      </div>
    </div>
  );
};

export default JotFormConsultationModal;
