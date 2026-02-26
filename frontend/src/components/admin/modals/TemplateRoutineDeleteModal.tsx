/**
 * @fileoverview Template Routine Delete Confirmation Modal (Admin)
 * Confirms deletion of a platform template routine.
 */

import React from 'react';
import { X, AlertTriangle, Loader2, LayoutTemplate } from 'lucide-react';

interface TemplateRoutineDeleteModalProps {
  templateName: string;
  stepsCount?: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

const TemplateRoutineDeleteModal: React.FC<TemplateRoutineDeleteModalProps> = ({
  templateName,
  stepsCount = 0,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={isDeleting ? undefined : onClose}
        aria-hidden
      />
      <div
        className="relative bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Delete Template</h2>
              <p className="text-sm text-gray-500">This action cannot be undone</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#B89A8E] flex items-center justify-center flex-shrink-0">
              <LayoutTemplate className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{templateName}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {stepsCount === 0 ? 'No steps' : `${stepsCount} step${stepsCount !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              Are you sure you want to delete this template? All steps will be removed.
            </p>
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
              'Delete Template'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateRoutineDeleteModal;
