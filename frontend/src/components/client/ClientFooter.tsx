import React from 'react';
import { Sparkles } from 'lucide-react';

const ClientFooter: React.FC = () => {
  return (
    <footer className="py-6 px-4 lg:px-8 border-t border-gray-100 bg-white mt-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
            <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={20} height={20}/>
          </div>
          <span className="font-serif font-bold text-[#2D2A3E]">SkinAura PRO</span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6 text-sm text-gray-500">
            <a
              href="https://skinaura.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#CFAFA3] transition-colors"
            >
              SkinAura AI
            </a>
            <a
              href="https://skinaura.circle.so/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#CFAFA3] transition-colors"
            >
              Community
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-gray-400">
            © 2025 SkinAura AI. Skincare is Selfcare.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default ClientFooter;

