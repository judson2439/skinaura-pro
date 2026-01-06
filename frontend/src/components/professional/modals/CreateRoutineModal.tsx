import React, { useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { ScheduleType, getScheduleIcon, getScheduleLabel } from './routineTypes';

// ============================================================================
// TYPES
// ============================================================================

interface CreateRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, scheduleType: ScheduleType) => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

const CreateRoutineModal: React.FC<CreateRoutineModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('morning');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onCreate(name, description, scheduleType);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setScheduleType('morning');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif font-bold">Create New Routine</h3>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Routine Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
              placeholder="e.g., Anti-Aging Morning Routine"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
              rows={3}
              placeholder="Describe this routine..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Schedule</label>
            <div className="grid grid-cols-2 gap-2">
              {(['morning', 'evening', 'daily', 'weekly'] as const).map((schedule) => (
                <button
                  key={schedule}
                  onClick={() => setScheduleType(schedule)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                    scheduleType === schedule
                      ? 'border-[#CFAFA3] bg-[#CFAFA3]/10 text-[#CFAFA3]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {getScheduleIcon(schedule)}
                  <span className="text-sm font-medium">{getScheduleLabel(schedule)}</span>
                </button>
              ))}
            </div>
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
            disabled={saving || !name.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Routine
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateRoutineModal;

