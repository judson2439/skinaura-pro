/**
 * @fileoverview Routine Delete Confirmation Modal for Admin
 * Confirms deletion of a routine template.
 */

import React from 'react';
import { X, AlertTriangle, Loader2, ClipboardList } from 'lucide-react';
import { AdminRoutineTemplate } from '../types';

interface RoutineDeleteModalProps {
  routine: AdminRoutineTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

const RoutineDeleteModal: React.FC<RoutineDeleteModalProps> = ({
  routine,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen || !routine) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Delete Routine</h2>
              <p className="text-sm text-gray-500">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#B89A8E] flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{routine.name}</p>
              <p className="text-sm text-gray-500 truncate">
                {routine.professional_name || 'Unknown Professional'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  routine.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {routine.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs text-gray-500 capitalize">
                  {routine.schedule_type}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              <strong>Warning:</strong> Deleting this routine will also remove:
            </p>
            <ul className="mt-2 text-sm text-amber-700 list-disc list-inside space-y-1">
              <li>All routine steps ({routine.steps_count || 0} steps)</li>
              <li>All linked products for each step</li>
              <li>All client assignments ({routine.assignments_count || 0} assignments)</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Routine'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoutineDeleteModal;
