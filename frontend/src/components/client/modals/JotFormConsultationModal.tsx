import React, { useEffect, useRef } from 'react';

interface JotFormConsultationModalProps {
  isOpen: boolean;
  onFormSubmitted: () => void;
}

const JotFormConsultationModal: React.FC<JotFormConsultationModalProps> = ({
  isOpen,
  onFormSubmitted,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load JotForm embed handler script
    if (!scriptLoadedRef.current) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jotfor.ms/s/umd/latest/for-form-embed-handler.js';
      script.async = true;
      script.onload = () => {
        scriptLoadedRef.current = true;
        // Initialize embed handler after script loads
        if (window.jotformEmbedHandler && iframeRef.current) {
          window.jotformEmbedHandler("iframe[id='JotFormIFrame-260316219853154']", "https://form.jotform.com/");
        }
      };
      document.body.appendChild(script);

      return () => {
        // Cleanup script on unmount
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    } else if (iframeRef.current) {
      // Re-initialize if script already loaded
      if (window.jotformEmbedHandler) {
        window.jotformEmbedHandler("iframe[id='JotFormIFrame-260316219853154']", "https://form.jotform.com/");
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Listen for form submission messages from JotForm iframe
    const handleMessage = (event: MessageEvent) => {
      // JotForm sends messages when form is submitted
      // Check if message is from JotForm domain
      const allowedOrigins = [
        'https://form.jotform.com',
        'https://www.jotform.com',
        'https://submit.jotform.com',
        'https://www.jotform.com:443'
      ];
      
      if (!allowedOrigins.includes(event.origin)) {
        return;
      }

      console.log('JotForm message received:', event.data, 'from:', event.origin);

      // Check for form submission events
      if (event.data && typeof event.data === 'object') {
        // JotForm sends various events, including form submission
        if (
          event.data.action === 'formSubmit' || 
          event.data.action === 'submissionComplete' ||
          event.data.action === 'thankYouPage' ||
          event.data.type === 'formSubmit' ||
          event.data.event === 'formSubmit'
        ) {
          console.log('JotForm submission detected via object message');
          setTimeout(() => {
            onFormSubmitted();
          }, 500);
        }
      }

      // Also check for string messages that might indicate submission
      if (typeof event.data === 'string') {
        const dataStr = event.data.toLowerCase();
        if (
          dataStr.includes('formsubmit') || 
          dataStr.includes('submissioncomplete') ||
          dataStr.includes('thankyou')
        ) {
          console.log('JotForm submission detected via string message');
          setTimeout(() => {
            onFormSubmitted();
          }, 500);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, onFormSubmitted]);

  // Poll iframe URL changes to detect form submission (fallback method)
  useEffect(() => {
    if (!isOpen || !iframeRef.current) return;

    let lastUrl = '';
    const checkInterval = setInterval(() => {
      try {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const currentUrl = iframe.contentWindow?.location.href || '';
        
        // Check if URL changed to thank you page or success page
        if (currentUrl && currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          
          // JotForm typically redirects to a thank you page after submission
          if (
            currentUrl.includes('thank') ||
            currentUrl.includes('success') ||
            currentUrl.includes('submitted') ||
            currentUrl.includes('complete')
          ) {
            console.log('Form submission detected via URL change:', currentUrl);
            clearInterval(checkInterval);
            setTimeout(() => {
              onFormSubmitted();
            }, 1000);
          }
        }
      } catch (e) {
        // CORS may block access, that's okay - we rely on message events
      }
    }, 1000); // Check every second

    return () => {
      clearInterval(checkInterval);
    };
  }, [isOpen, onFormSubmitted]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop - non-dismissible */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] px-6 py-4">
          <h2 className="text-xl font-serif font-bold text-white">
            Skin Care Consultation Form
          </h2>
          <p className="text-sm text-white/90 mt-1">
            Please complete this form to continue
          </p>
        </div>

        {/* Form Container */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <iframe
            ref={iframeRef}
            id="JotFormIFrame-260316219853154"
            title="Skin Care Consultation Form"
            onLoad={() => {
              // Scroll to top when iframe loads
              window.parent.scrollTo(0, 0);
            }}
            allowTransparency={true}
            allow="geolocation; microphone; camera; fullscreen; payment"
            src="https://form.jotform.com/260316219853154"
            frameBorder="0"
            style={{
              minWidth: '100%',
              maxWidth: '100%',
              height: '539px',
              border: 'none',
            }}
            scrolling="no"
          />
        </div>
      </div>
    </div>
  );
};

// Extend Window interface for JotForm embed handler
declare global {
  interface Window {
    jotformEmbedHandler?: (selector: string, baseUrl: string) => void;
  }
}

export default JotFormConsultationModal;
