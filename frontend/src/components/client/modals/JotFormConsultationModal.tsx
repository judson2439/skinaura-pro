import React, { useEffect, useRef } from 'react';

const JOTFORM_IFRAME_ID = 'JotFormIFrame-260316219853154';
const JOTFORM_EMBED_SCRIPT = 'https://cdn.jotfor.ms/s/umd/latest/for-form-embed-handler.js';
const JOTFORM_BASE_URL = 'https://form.jotform.com/';

declare global {
  interface Window {
    jotformEmbedHandler?: (selector: string, baseUrl: string) => void;
  }
}

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
  const scriptLoadedRef = useRef(false);

  // Load JotForm embed handler script and run when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const runEmbedHandler = () => {
      if (typeof window.jotformEmbedHandler === 'function') {
        window.jotformEmbedHandler(
          `iframe[id='${JOTFORM_IFRAME_ID}']`,
          JOTFORM_BASE_URL
        );
      }
    };

    if (scriptLoadedRef.current) {
      runEmbedHandler();
      return;
    }

    const existing = document.querySelector(`script[src="${JOTFORM_EMBED_SCRIPT}"]`);
    if (existing) {
      scriptLoadedRef.current = true;
      runEmbedHandler();
      return;
    }

    const script = document.createElement('script');
    script.src = JOTFORM_EMBED_SCRIPT;
    script.async = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      runEmbedHandler();
    };
    document.body.appendChild(script);
    return () => {
      // Script stays in DOM for reuse
    };
  }, [isOpen]);

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
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] px-6 py-4 flex-shrink-0">
          <h2 className="text-xl font-serif font-bold text-white">
            Skin Care Consultation Form
          </h2>
          <p className="text-sm text-white/90 mt-1">
            Complete the form to continue
          </p>
        </div>

        {/* iframe container - scrollable */}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <iframe
            id={JOTFORM_IFRAME_ID}
            title="Skin Care Consultation Form"
            onLoad={() => window.parent.scrollTo(0, 0)}
            allowTransparency
            allow="geolocation; microphone; camera; fullscreen; payment"
            src="https://form.jotform.com/260316219853154"
            frameBorder={0}
            style={{ minWidth: '100%', maxWidth: '100%', height: '539px', border: 'none' }}
            scrolling="no"
          />
        </div>

        {/* Footer with Skip */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            Already completed the form? Click &quot;Skip&quot; to continue.
          </p>
          <button
            onClick={onFormSubmitted}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-[#CFAFA3] text-[#CFAFA3] rounded-xl font-medium hover:bg-[#CFAFA3]/5 transition-all flex-shrink-0"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default JotFormConsultationModal;
