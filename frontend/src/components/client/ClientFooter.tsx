import React from 'react';
import { Link } from 'react-router-dom';

const ClientFooter: React.FC = () => {
  return (
    <footer className="py-6 px-4 lg:px-8 border-t border-gray-100 bg-white mt-6">
      <div className="flex flex-col md:flex-row items-center md:items-center justify-between gap-5">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
            <img className="text-[#2D2A3E]" src={'https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png'} width={20} height={20}/>
          </div>
          <span className="font-serif font-bold text-[#2D2A3E]">SkinAura PRO</span>
        </div>

        {/* Links */}
        <div className="flex w-full md:w-auto flex-col items-center md:items-end gap-4">
          <nav className="flex flex-wrap items-center justify-center md:justify-end gap-x-6 gap-y-2 text-sm text-gray-500">
            <Link
              to="/privacy"
              className="hover:text-[#CFAFA3] transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="hover:text-[#CFAFA3] transition-colors"
            >
              Terms and Conditions
            </Link>
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
          <p className="max-w-[220px] md:max-w-none text-center md:text-right text-sm leading-6 text-gray-400">
            © 2026 SkinAura AI. Skincare is Selfcare.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default ClientFooter;

