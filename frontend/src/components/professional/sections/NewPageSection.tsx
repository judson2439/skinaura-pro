import React from 'react';
import { Layout } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface NewPageSectionProps {
  onNavigateToView?: (viewId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const NewPageSection: React.FC<NewPageSectionProps> = () => {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center rounded-2xl bg-white/60 border border-[#CFAFA3]/20 p-8">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#CFAFA3]/20 to-[#E8D5D0]/30 flex items-center justify-center mb-4">
        <Layout className="w-8 h-8 text-[#CFAFA3]" />
      </div>
      <h2 className="text-xl font-semibold text-[#2D2A3E] mb-2">New Page</h2>
      <p className="text-sm text-gray-500 text-center max-w-sm">
        This is a blank page. Add your content here.
      </p>
    </div>
  );
};

export default NewPageSection;
