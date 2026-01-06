import React, { useState } from 'react';
import { X, UserPlus, Check, Loader2, AlertCircle } from 'lucide-react';
import { Routine, RoutineClient } from './routineTypes';

// ============================================================================
// TYPES
// ============================================================================

interface AssignRoutineModalProps {
  isOpen: boolean;
  routine: Routine | null;
  assignableClients: RoutineClient[];
  onClose: () => void;
  onAssign: (clientId: string, notes: string) => Promise<void>;
  onAddClient: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AssignRoutineModal: React.FC<AssignRoutineModalProps> = ({
  isOpen,
  routine,
  assignableClients,
  onClose,
  onAssign,
  onAddClient,
}) => {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAssign = async () => {
    if (!selectedClientId) return;

    setSaving(true);
    try {
      await onAssign(selectedClientId, notes);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedClientId('');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen || !routine) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-serif font-bold">Assign Routine</h3>
            <p className="text-sm text-gray-500">{routine.name}</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Client</label>
            {assignableClients.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <p className="font-medium text-amber-800">No Clients Available</p>
                </div>
                <p className="text-sm text-amber-700 mb-3">
                  All clients are already assigned to this routine, or you need to add more clients.
                </p>
                <button
                  onClick={onAddClient}
                  className="w-full py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Add New Client
                </button>
              </div>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
              >
                <option value="">Choose a client...</option>
                {assignableClients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            )}
          </div>

          {assignableClients.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes for Client (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
                rows={3}
                placeholder="Any special instructions for this client..."
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {assignableClients.length > 0 && (
            <button
              onClick={handleAssign}
              disabled={saving || !selectedClientId}
              className="flex-1 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Assign Routine
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignRoutineModal;

