import React, { useState } from 'react';
import { X, Plus, Loader2, Target, AlertCircle } from 'lucide-react';
import { TreatmentPlanClient } from './treatmentPlanTypes';
import { DatePickerSimple } from '@/components/ui/date-picker';
import { CustomSelect } from '@/components/ui/custom-select';

// ============================================================================
// TYPES
// ============================================================================

interface CreateTreatmentPlanModalProps {
  isOpen: boolean;
  clients: TreatmentPlanClient[];
  onClose: () => void;
  onCreate: (data: {
    clientId: string;
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    goals: string[];
    notes: string;
  }) => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

const CreateTreatmentPlanModal: React.FC<CreateTreatmentPlanModalProps> = ({
  isOpen,
  clients,
  onClose,
  onCreate,
}) => {
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [goalInput, setGoalInput] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Create client options for select
  const clientOptions = [
    { value: '', label: 'Choose a client...' },
    ...clients.map(client => ({ value: client.id, label: client.name }))
  ];

  const handleAddGoal = () => {
    if (goalInput.trim() && !goals.includes(goalInput.trim())) {
      setGoals([...goals, goalInput.trim()]);
      setGoalInput('');
    }
  };

  const handleRemoveGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!clientId || !title || !startDate || !endDate) return;

    setSaving(true);
    try {
      await onCreate({
        clientId,
        title,
        description,
        startDate,
        endDate,
        goals,
        notes,
      });
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setClientId('');
    setTitle('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setGoals([]);
    setGoalInput('');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif font-bold">Create Treatment Plan</h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Client *</label>
            {clients.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <p className="text-sm text-amber-800">No clients available. Add clients first.</p>
                </div>
              </div>
            ) : (
              <CustomSelect
                value={clientId}
                onChange={(value) => setClientId(value)}
                options={clientOptions}
                placeholder="Choose a client..."
                className="w-full"
              />
            )}
          </div>

          {/* Plan Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Plan Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
              placeholder="e.g., 12-Week Acne Treatment Plan"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none resize-none transition-all"
              rows={3}
              placeholder="Describe the treatment plan..."
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
              <DatePickerSimple
                value={startDate}
                onChange={(date) => setStartDate(date)}
                placeholder="Select start date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
              <DatePickerSimple
                value={endDate}
                onChange={(date) => setEndDate(date)}
                placeholder="Select end date"
              />
            </div>
          </div>

          {/* Goals */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Goals</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGoal())}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none transition-all"
                placeholder="Add a goal..."
              />
              <button
                onClick={handleAddGoal}
                type="button"
                className="px-4 py-2 bg-[#CFAFA3]/10 text-[#CFAFA3] rounded-xl hover:bg-[#CFAFA3]/20 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {goals.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {goals.map((goal, idx) => (
                  <span key={idx} className="flex items-center gap-1 px-3 py-1 bg-[#CFAFA3]/10 text-[#CFAFA3] rounded-full text-sm">
                    <Target className="w-3 h-3" />
                    {goal}
                    <button onClick={() => handleRemoveGoal(idx)} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-[#CFAFA3] outline-none resize-none transition-all"
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !clientId || !title || !startDate || !endDate}
            className="flex-1 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTreatmentPlanModal;
