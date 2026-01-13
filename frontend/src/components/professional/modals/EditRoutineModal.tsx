import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, UserPlus, Link2, Package, Loader2 } from 'lucide-react';
import { Routine, RoutineStep, getScheduleLabel, PRODUCT_TYPES } from './routineTypes';
import { apiClient } from '@/lib/apiClient';
import { getAuthToken } from '@/lib/authStorage';
import LinkProductModal from './LinkProductModal';
import EncryptedImage from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  price: number | null;
  currency: string | null;
}

interface LinkedProduct {
  id: string;
  routine_step_id: string;
  product_id: string;
  notes: string | null;
  product?: Product;
}

interface EditRoutineModalProps {
  isOpen: boolean;
  routine: Routine | null;
  onClose: () => void;
  onAddStep: (step: Omit<RoutineStep, 'id' | 'step_order'>) => void;
  onDeleteStep: (stepId: string) => void;
  onAssign: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const EditRoutineModal: React.FC<EditRoutineModalProps> = ({
  isOpen,
  routine,
  onClose,
  onAddStep,
  onDeleteStep,
  onAssign,
}) => {
  const [newStepProduct, setNewStepProduct] = useState('');
  const [newStepType, setNewStepType] = useState('');
  const [newStepInstructions, setNewStepInstructions] = useState('');
  
  // Product linking state
  const [linkedProducts, setLinkedProducts] = useState<Record<string, LinkedProduct>>({});
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedStepForLink, setSelectedStepForLink] = useState<RoutineStep | null>(null);

  // Fetch linked products when modal opens or routine changes
  useEffect(() => {
    if (isOpen && routine && routine.steps.length > 0) {
      fetchLinkedProducts();
    } else {
      setLinkedProducts({});
    }
  }, [isOpen, routine?.id, routine?.steps.length]);

  const fetchLinkedProducts = async () => {
    if (!routine) return;
    
    const token = getAuthToken();
    if (!token) return;

    setIsLoadingLinks(true);
    try {
      apiClient.setAuthToken(token);
      
      const response = await apiClient.get<{
        success: boolean;
        data?: { linkedProducts: Record<string, LinkedProduct> };
        error?: string;
      }>(`/api/professional/routines/${routine.id}/step-products`);

      if (response.data.success && response.data.data) {
        setLinkedProducts(response.data.data.linkedProducts);
      } else {
        console.error('Error fetching linked products:', response.data.error);
        setLinkedProducts({});
      }
    } catch (err) {
      console.error('Error fetching linked products:', err);
      setLinkedProducts({});
    } finally {
      setIsLoadingLinks(false);
    }
  };

  const handleAddStep = () => {
    if (!newStepProduct.trim()) return;

    onAddStep({
      step_name: newStepProduct,
      product_category: newStepType || undefined,
      description: newStepInstructions || undefined,
      // Legacy fields for backward compatibility
      product_name: newStepProduct,
      product_type: newStepType || undefined,
      instructions: newStepInstructions || undefined,
    });

    resetStepForm();
  };

  const resetStepForm = () => {
    setNewStepProduct('');
    setNewStepType('');
    setNewStepInstructions('');
  };

  const handleClose = () => {
    resetStepForm();
    setLinkedProducts({});
    onClose();
  };

  const handleOpenLinkModal = (step: RoutineStep) => {
    setSelectedStepForLink(step);
    setLinkModalOpen(true);
  };

  const handleCloseLinkModal = () => {
    setLinkModalOpen(false);
    setSelectedStepForLink(null);
  };

  const handleProductLinked = (linkedProduct: LinkedProduct) => {
    setLinkedProducts(prev => ({
      ...prev,
      [linkedProduct.routine_step_id]: linkedProduct,
    }));
  };

  const handleProductUnlinked = () => {
    if (selectedStepForLink) {
      setLinkedProducts(prev => {
        const newLinks = { ...prev };
        delete newLinks[selectedStepForLink.id];
        return newLinks;
      });
    }
  };

  if (!isOpen || !routine) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-serif font-bold">{routine.name}</h3>
              <p className="text-sm text-gray-500">{getScheduleLabel(routine.schedule_type)} Routine</p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Steps */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Routine Steps</h4>
              {isLoadingLinks && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading products...
                </div>
              )}
            </div>
            {routine.steps.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl">No steps added yet</p>
            ) : (
              <div className="space-y-2">
                {routine.steps.map((step, idx) => {
                  const linkedProduct = linkedProducts[step.id];
                  return (
                    <div key={step.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      {/* Step Number or Product Image */}
                      {linkedProduct?.product?.image_url ? (
                        <div className="relative">
                          <EncryptedImage
                            src={linkedProduct.product.image_url}
                            alt={linkedProduct.product.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-[#CFAFA3]"
                          />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#CFAFA3] text-white flex items-center justify-center text-xs font-medium">
                            {idx + 1}
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#CFAFA3] text-white flex items-center justify-center font-medium text-sm">
                          {idx + 1}
                        </div>
                      )}
                      
                      {/* Step Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{step.step_name || step.product_name}</p>
                        {(step.product_category || step.product_type) && (
                          <span className="text-xs text-[#CFAFA3]">{step.product_category || step.product_type}</span>
                        )}
                        {(step.description || step.instructions) && (
                          <p className="text-xs text-gray-500 mt-1 truncate">{step.description || step.instructions}</p>
                        )}
                        {/* Linked Product Info */}
                        {linkedProduct?.product && (
                          <div className="flex items-center gap-1 mt-1">
                            <Link2 className="w-3 h-3 text-green-500" />
                            <span className="text-xs text-green-600 font-medium truncate">
                              {linkedProduct.product.brand ? `${linkedProduct.product.brand} - ` : ''}
                              {linkedProduct.product.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Link Product Button */}
                      <button
                        onClick={() => handleOpenLinkModal(step)}
                        className={`p-2 rounded-lg transition-colors ${
                          linkedProduct
                            ? 'bg-green-100 hover:bg-green-200 text-green-600'
                            : 'hover:bg-[#CFAFA3]/20 text-gray-400 hover:text-[#CFAFA3]'
                        }`}
                        title={linkedProduct ? 'Edit linked product' : 'Link product'}
                      >
                        <Link2 className="w-4 h-4" />
                      </button>

                      {/* Delete Step Button */}
                      <button
                        onClick={() => onDeleteStep(step.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add New Step */}
          <div className="border-t border-gray-100 pt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Step</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={newStepProduct}
                  onChange={(e) => setNewStepProduct(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none text-sm"
                  placeholder="e.g., Vitamin C Serum"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Product Type</label>
                <select
                  value={newStepType}
                  onChange={(e) => setNewStepType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none text-sm"
                >
                  <option value="">Select type...</option>
                  {PRODUCT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Instructions</label>
              <input
                type="text"
                value={newStepInstructions}
                onChange={(e) => setNewStepInstructions(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none text-sm"
                placeholder="e.g., Apply 3-4 drops to clean skin"
              />
            </div>
            <button
              onClick={handleAddStep}
              disabled={!newStepProduct.trim()}
              className="w-full py-2 bg-[#CFAFA3]/10 text-[#CFAFA3] rounded-lg font-medium hover:bg-[#CFAFA3]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Step
            </button>
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={handleClose}
              className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={onAssign}
              className="flex-1 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Assign to Client
            </button>
          </div>
        </div>
      </div>

      {/* Link Product Modal */}
      <LinkProductModal
        isOpen={linkModalOpen}
        stepId={selectedStepForLink?.id || ''}
        stepName={selectedStepForLink?.step_name || selectedStepForLink?.product_name || ''}
        professionalId={routine?.professional_id || ''}
        existingLink={selectedStepForLink ? linkedProducts[selectedStepForLink.id] : null}
        onClose={handleCloseLinkModal}
        onSave={handleProductLinked}
        onUnlink={handleProductUnlinked}
      />
    </>
  );
};

export default EditRoutineModal;
