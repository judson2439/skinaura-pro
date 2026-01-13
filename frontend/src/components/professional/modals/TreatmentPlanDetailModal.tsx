import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  Play,
  Pause,
  Flag,
  Package,
  RotateCcw,
  Calendar,
  Target,
  AlertTriangle,
} from 'lucide-react';
import {
  TreatmentPlan,
  TreatmentPlanClient,
  TreatmentPlanMilestone,
  TreatmentPlanProduct,
  TreatmentPlanRoutine,
  TreatmentPlanAppointment,
  getStatusColor,
  getPriorityColor,
  calculatePlanProgress,
  CLIENT_IMAGES,
  PRODUCT_CATEGORIES,
} from './treatmentPlanTypes';
import { DatePickerSimple } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { CustomSelect, createOptions } from '@/components/ui/custom-select';
import EncryptedImage from '@/components/ui/encrypted-image';

// ============================================================================
// TYPES
// ============================================================================

interface TreatmentPlanDetailModalProps {
  isOpen: boolean;
  plan: TreatmentPlan | null;
  clients: TreatmentPlanClient[];
  onClose: () => void;
  onUpdateStatus: (planId: string, status: TreatmentPlan['status']) => Promise<void>;
  onDeletePlan: (planId: string) => Promise<void>;
  onAddMilestone: (milestone: Omit<TreatmentPlanMilestone, 'id' | 'plan_id' | 'completed'>) => Promise<void>;
  onUpdateMilestone: (milestoneId: string, data: Partial<TreatmentPlanMilestone>) => Promise<void>;
  onDeleteMilestone: (milestoneId: string) => Promise<void>;
  onAddProduct: (product: Omit<TreatmentPlanProduct, 'id' | 'plan_id'>) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onAddRoutine: (routine: Omit<TreatmentPlanRoutine, 'id' | 'plan_id'>) => Promise<void>;
  onDeleteRoutine: (routineId: string) => Promise<void>;
  onAddAppointment: (appointment: Omit<TreatmentPlanAppointment, 'id' | 'plan_id' | 'completed'>) => Promise<void>;
  onUpdateAppointment: (appointmentId: string, data: Partial<TreatmentPlanAppointment>) => Promise<void>;
  onDeleteAppointment: (appointmentId: string) => Promise<void>;
}

type DeleteItemType = 'milestone' | 'product' | 'routine' | 'appointment' | null;

interface DeleteConfirmation {
  type: DeleteItemType;
  id: string;
  name: string;
}

// ============================================================================
// DELETE CONFIRMATION MODAL COMPONENT
// ============================================================================

interface DeleteConfirmModalProps {
  isOpen: boolean;
  itemType: string;
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  itemType,
  itemName,
  onConfirm,
  onCancel,
  isDeleting,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Delete {itemType}</h3>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-gray-700">
            Are you sure you want to delete <span className="font-semibold text-gray-900">"{itemName}"</span>?
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const TreatmentPlanDetailModal: React.FC<TreatmentPlanDetailModalProps> = ({
  isOpen,
  plan,
  clients,
  onClose,
  onUpdateStatus,
  onDeletePlan,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
  onAddProduct,
  onDeleteProduct,
  onAddRoutine,
  onDeleteRoutine,
  onAddAppointment,
  onUpdateAppointment,
  onDeleteAppointment,
}) => {
  // Form visibility states
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [showAddAppointment, setShowAddAppointment] = useState(false);

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Milestone form
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDescription, setMilestoneDescription] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');

  // Product form
  const [productName, setProductName] = useState('');
  const [productBrand, setProductBrand] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productInstructions, setProductInstructions] = useState('');
  const [productPriority, setProductPriority] = useState<'essential' | 'recommended' | 'optional'>('recommended');

  // Routine form
  const [routineName, setRoutineName] = useState('');
  const [routineType, setRoutineType] = useState('');
  const [routineNotes, setRoutineNotes] = useState('');

  // Appointment form
  const [appointmentType, setAppointmentType] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentDuration, setAppointmentDuration] = useState('60');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  if (!isOpen || !plan) return null;

  const progress = calculatePlanProgress(plan);
  const client = clients.find(c => c.id === plan.client_id);

  // Select options
  const categoryOptions = [
    { value: '', label: 'Category' },
    ...createOptions(PRODUCT_CATEGORIES)
  ];

  const priorityOptions = [
    { value: 'essential', label: 'Essential' },
    { value: 'recommended', label: 'Recommended' },
    { value: 'optional', label: 'Optional' },
  ];

  const routineTypeOptions = [
    { value: '', label: 'Type' },
    { value: 'morning', label: 'Morning' },
    { value: 'evening', label: 'Evening' },
    { value: 'weekly', label: 'Weekly' },
  ];

  const durationOptions = [
    { value: '30', label: '30 minutes' },
    { value: '60', label: '1 hour' },
    { value: '90', label: '1.5 hours' },
    { value: '120', label: '2 hours' },
  ];

  // Handlers
  const handleAddMilestone = async () => {
    if (!milestoneTitle || !milestoneDate) return;
    await onAddMilestone({
      title: milestoneTitle,
      description: milestoneDescription || undefined,
      target_date: milestoneDate,
    });
    setMilestoneTitle('');
    setMilestoneDescription('');
    setMilestoneDate('');
    setShowAddMilestone(false);
  };

  const handleAddProduct = async () => {
    if (!productName) return;
    await onAddProduct({
      product_name: productName,
      product_brand: productBrand || undefined,
      product_category: productCategory || undefined,
      usage_instructions: productInstructions || undefined,
      priority: productPriority,
    });
    setProductName('');
    setProductBrand('');
    setProductCategory('');
    setProductInstructions('');
    setProductPriority('recommended');
    setShowAddProduct(false);
  };

  const handleAddRoutine = async () => {
    if (!routineName) return;
    await onAddRoutine({
      routine_name: routineName,
      routine_type: routineType || undefined,
      notes: routineNotes || undefined,
    });
    setRoutineName('');
    setRoutineType('');
    setRoutineNotes('');
    setShowAddRoutine(false);
  };

  const handleAddAppointment = async () => {
    if (!appointmentType || !appointmentDate) return;
    await onAddAppointment({
      appointment_type: appointmentType,
      scheduled_date: appointmentDate,
      scheduled_time: appointmentTime || undefined,
      duration_minutes: parseInt(appointmentDuration),
      notes: appointmentNotes || undefined,
    });
    setAppointmentType('');
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentDuration('60');
    setAppointmentNotes('');
    setShowAddAppointment(false);
  };

  const handleDeletePlan = async () => {
    if (!window.confirm('Are you sure you want to delete this treatment plan? This action cannot be undone.')) return;
    await onDeletePlan(plan.id);
  };

  // Delete confirmation handlers
  const openDeleteConfirmation = (type: DeleteItemType, id: string, name: string) => {
    setDeleteConfirmation({ type, id, name });
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation(null);
    setIsDeleting(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    setIsDeleting(true);
    try {
      switch (deleteConfirmation.type) {
        case 'milestone':
          await onDeleteMilestone(deleteConfirmation.id);
          break;
        case 'product':
          await onDeleteProduct(deleteConfirmation.id);
          break;
        case 'routine':
          await onDeleteRoutine(deleteConfirmation.id);
          break;
        case 'appointment':
          await onDeleteAppointment(deleteConfirmation.id);
          break;
      }
      closeDeleteConfirmation();
    } catch (error) {
      console.error('Error deleting item:', error);
      setIsDeleting(false);
    }
  };

  // Get display name for delete confirmation
  const getDeleteItemTypeName = (type: DeleteItemType): string => {
    switch (type) {
      case 'milestone': return 'Milestone';
      case 'product': return 'Product';
      case 'routine': return 'Routine';
      case 'appointment': return 'Appointment';
      default: return 'Item';
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-100 p-6 z-10">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <EncryptedImage
                  src={client?.image || CLIENT_IMAGES[0]}
                  alt="Client"
                  className="w-12 h-12 rounded-full object-cover"
                  fallbackClassName="w-12 h-12 rounded-full bg-gradient-to-br from-[#cab0a5] to-[#a57865] flex items-center justify-center text-white text-sm font-medium"
                />
                <div>
                  <h3 className="text-xl font-serif font-bold text-gray-900">{plan.title}</h3>
                  <p className="text-sm text-gray-500">{client?.name || 'Unknown Client'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(plan.status)}`}>
                  {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                </span>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Overall Progress</span>
                <span className="font-medium text-[#CFAFA3]">{progress.overallProgress}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] rounded-full transition-all"
                  style={{ width: `${progress.overallProgress}%` }}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mt-4">
              {plan.status === 'active' && (
                <>
                  <button
                    onClick={() => onUpdateStatus(plan.id, 'paused')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
                  >
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                  <button
                    onClick={() => onUpdateStatus(plan.id, 'completed')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                  >
                    <Check className="w-4 h-4" /> Complete
                  </button>
                </>
              )}
              {plan.status === 'paused' && (
                <button
                  onClick={() => onUpdateStatus(plan.id, 'active')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                >
                  <Play className="w-4 h-4" /> Resume
                </button>
              )}
              <button
                onClick={handleDeletePlan}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors ml-auto"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Description & Goals */}
            {(plan.description || plan.goals.length > 0) && (
              <div className="bg-gray-50 rounded-xl p-4">
                {plan.description && (
                  <p className="text-gray-600 mb-3">{plan.description}</p>
                )}
                {plan.goals.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Goals</h4>
                    <div className="flex flex-wrap gap-2">
                      {plan.goals.map((goal, idx) => (
                        <span key={idx} className="flex items-center gap-1 px-3 py-1 bg-white text-[#CFAFA3] rounded-full text-sm border border-[#CFAFA3]/20">
                          <Target className="w-3 h-3" />
                          {goal}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Milestones Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Flag className="w-5 h-5 text-[#CFAFA3]" />
                  Milestones ({plan.milestones.length})
                </h4>
                <button
                  onClick={() => setShowAddMilestone(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#CFAFA3]/10 text-[#CFAFA3] rounded-lg text-sm font-medium hover:bg-[#CFAFA3]/20 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {showAddMilestone && (
                <div className="bg-gray-50 rounded-xl p-4 mb-3">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={milestoneTitle}
                      onChange={(e) => setMilestoneTitle(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                      placeholder="Milestone title"
                    />
                    <DatePickerSimple
                      value={milestoneDate}
                      onChange={(date) => setMilestoneDate(date)}
                      placeholder="Target date"
                      className="text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    value={milestoneDescription}
                    onChange={(e) => setMilestoneDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                    placeholder="Description (optional)"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddMilestone(false)} className="px-3 py-1.5 text-gray-600 text-sm">Cancel</button>
                    <button
                      onClick={handleAddMilestone}
                      disabled={!milestoneTitle || !milestoneDate}
                      className="px-3 py-1.5 bg-[#CFAFA3] text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      Add Milestone
                    </button>
                  </div>
                </div>
              )}

              {plan.milestones.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl">No milestones yet</p>
              ) : (
                <div className="space-y-2">
                  {plan.milestones.map((milestone) => (
                    <div key={milestone.id} className={`flex items-center gap-3 p-3 rounded-xl border ${milestone.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                      <button
                        onClick={() => onUpdateMilestone(milestone.id, { completed: !milestone.completed })}
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${milestone.completed ? 'bg-green-500 text-white' : 'border-2 border-gray-300'}`}
                      >
                        {milestone.completed && <Check className="w-4 h-4" />}
                      </button>
                      <div className="flex-1">
                        <p className={`font-medium ${milestone.completed ? 'text-green-700 line-through' : 'text-gray-900'}`}>{milestone.title}</p>
                        {milestone.description && <p className="text-xs text-gray-500">{milestone.description}</p>}
                      </div>
                      <span className="text-xs text-gray-500">{new Date(milestone.target_date).toLocaleDateString()}</span>
                      <button
                        onClick={() => openDeleteConfirmation('milestone', milestone.id, milestone.title)}
                        className="p-1 hover:bg-red-100 rounded text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Products Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#CFAFA3]" />
                  Recommended Products ({plan.products.length})
                </h4>
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#CFAFA3]/10 text-[#CFAFA3] rounded-lg text-sm font-medium hover:bg-[#CFAFA3]/20 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {showAddProduct && (
                <div className="bg-gray-50 rounded-xl p-4 mb-3">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                      placeholder="Product name *"
                    />
                    <input
                      type="text"
                      value={productBrand}
                      onChange={(e) => setProductBrand(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                      placeholder="Brand"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <CustomSelect
                      value={productCategory}
                      onChange={(value) => setProductCategory(value)}
                      options={categoryOptions}
                      placeholder="Category"
                      className="text-sm"
                    />
                    <CustomSelect
                      value={productPriority}
                      onChange={(value) => setProductPriority(value as 'essential' | 'recommended' | 'optional')}
                      options={priorityOptions}
                      placeholder="Priority"
                      className="text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    value={productInstructions}
                    onChange={(e) => setProductInstructions(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                    placeholder="Usage instructions"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddProduct(false)} className="px-3 py-1.5 text-gray-600 text-sm">Cancel</button>
                    <button
                      onClick={handleAddProduct}
                      disabled={!productName}
                      className="px-3 py-1.5 bg-[#CFAFA3] text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      Add Product
                    </button>
                  </div>
                </div>
              )}

              {plan.products.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl">No products yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {plan.products.map((product) => (
                    <div key={product.id} className="p-3 bg-white rounded-xl border border-gray-100">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{product.product_name}</p>
                          {product.product_brand && <p className="text-xs text-[#CFAFA3]">{product.product_brand}</p>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(product.priority)}`}>
                          {product.priority}
                        </span>
                      </div>
                      {product.usage_instructions && (
                        <p className="text-xs text-gray-500 mb-2">{product.usage_instructions}</p>
                      )}
                      <button
                        onClick={() => openDeleteConfirmation('product', product.id, product.product_name)}
                        className="text-xs text-red-500 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Routines Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-[#CFAFA3]" />
                  Routines ({plan.routines.length})
                </h4>
                <button
                  onClick={() => setShowAddRoutine(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#CFAFA3]/10 text-[#CFAFA3] rounded-lg text-sm font-medium hover:bg-[#CFAFA3]/20 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {showAddRoutine && (
                <div className="bg-gray-50 rounded-xl p-4 mb-3">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={routineName}
                      onChange={(e) => setRoutineName(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                      placeholder="Routine name *"
                    />
                    <CustomSelect
                      value={routineType}
                      onChange={(value) => setRoutineType(value)}
                      options={routineTypeOptions}
                      placeholder="Type"
                      className="text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    value={routineNotes}
                    onChange={(e) => setRoutineNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                    placeholder="Notes"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddRoutine(false)} className="px-3 py-1.5 text-gray-600 text-sm">Cancel</button>
                    <button
                      onClick={handleAddRoutine}
                      disabled={!routineName}
                      className="px-3 py-1.5 bg-[#CFAFA3] text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      Add Routine
                    </button>
                  </div>
                </div>
              )}

              {plan.routines.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl">No routines yet</p>
              ) : (
                <div className="space-y-2">
                  {plan.routines.map((routine) => (
                    <div key={routine.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                      <div>
                        <p className="font-medium text-gray-900">{routine.routine_name}</p>
                        {routine.routine_type && <span className="text-xs text-[#CFAFA3]">{routine.routine_type}</span>}
                      </div>
                      <button
                        onClick={() => openDeleteConfirmation('routine', routine.id, routine.routine_name)}
                        className="p-1 hover:bg-red-100 rounded text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Appointments Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#CFAFA3]" />
                  Scheduled Appointments ({plan.appointments.length})
                </h4>
                <button
                  onClick={() => setShowAddAppointment(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#CFAFA3]/10 text-[#CFAFA3] rounded-lg text-sm font-medium hover:bg-[#CFAFA3]/20 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {showAddAppointment && (
                <div className="bg-gray-50 rounded-xl p-4 mb-3">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      value={appointmentType}
                      onChange={(e) => setAppointmentType(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                      placeholder="Appointment type *"
                    />
                    <DatePickerSimple
                      value={appointmentDate}
                      onChange={(date) => setAppointmentDate(date)}
                      placeholder="Select date"
                      className="text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <TimePicker
                      value={appointmentTime}
                      onChange={(time) => setAppointmentTime(time)}
                      placeholder="Select time"
                      className="text-sm"
                    />
                    <CustomSelect
                      value={appointmentDuration}
                      onChange={(value) => setAppointmentDuration(value)}
                      options={durationOptions}
                      placeholder="Duration"
                      className="text-sm"
                    />
                  </div>
                  <input
                    type="text"
                    value={appointmentNotes}
                    onChange={(e) => setAppointmentNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                    placeholder="Notes"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddAppointment(false)} className="px-3 py-1.5 text-gray-600 text-sm">Cancel</button>
                    <button
                      onClick={handleAddAppointment}
                      disabled={!appointmentType || !appointmentDate}
                      className="px-3 py-1.5 bg-[#CFAFA3] text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              )}

              {plan.appointments.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-xl">No appointments scheduled</p>
              ) : (
                <div className="space-y-2">
                  {plan.appointments.map((apt) => (
                    <div key={apt.id} className={`flex items-center gap-3 p-3 rounded-xl border ${apt.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                      <button
                        onClick={() => onUpdateAppointment(apt.id, { completed: !apt.completed })}
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${apt.completed ? 'bg-green-500 text-white' : 'border-2 border-gray-300'}`}
                      >
                        {apt.completed && <Check className="w-4 h-4" />}
                      </button>
                      <div className="flex-1">
                        <p className={`font-medium ${apt.completed ? 'text-green-700 line-through' : 'text-gray-900'}`}>{apt.appointment_type}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(apt.scheduled_date).toLocaleDateString()}
                          {apt.scheduled_time && ` at ${apt.scheduled_time}`}
                          {` • ${apt.duration_minutes} min`}
                        </p>
                      </div>
                      <button
                        onClick={() => openDeleteConfirmation('appointment', apt.id, apt.appointment_type)}
                        className="p-1 hover:bg-red-100 rounded text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirmation !== null}
        itemType={getDeleteItemTypeName(deleteConfirmation?.type || null)}
        itemName={deleteConfirmation?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteConfirmation}
        isDeleting={isDeleting}
      />
    </>
  );
};

export default TreatmentPlanDetailModal;
