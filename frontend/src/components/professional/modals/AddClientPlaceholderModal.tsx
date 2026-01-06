import React from 'react';
import { X, UserPlus } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AddClientPlaceholderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToClients: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AddClientPlaceholderModal: React.FC<AddClientPlaceholderModalProps> = ({
  isOpen,
  onClose,
  onNavigateToClients,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif font-bold">Add New Client</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-center py-8">
          <UserPlus className="w-12 h-12 text-[#CFAFA3] mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Add client functionality will be implemented here.</p>
          <button
            onClick={onNavigateToClients}
            className="px-6 py-2 bg-[#CFAFA3] text-white rounded-xl font-medium hover:bg-[#B89A8E] transition-colors"
          >
            Go to Clients
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddClientPlaceholderModal;

