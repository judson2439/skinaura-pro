import React, { useRef } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface UploadPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploading: boolean;
  photoType: 'before' | 'after' | 'progress';
  setPhotoType: (type: 'before' | 'after' | 'progress') => void;
  photoTitle: string;
  setPhotoTitle: (title: string) => void;
  photoNotes: string;
  setPhotoNotes: (notes: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const UploadPhotoModal: React.FC<UploadPhotoModalProps> = ({
  isOpen,
  onClose,
  uploading,
  photoType,
  setPhotoType,
  photoTitle,
  setPhotoTitle,
  photoNotes,
  setPhotoNotes,
  onFileSelect,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelect}
        className="hidden"
      />

      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-serif font-bold">Upload Progress Photo</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Photo Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['before', 'after', 'progress'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setPhotoType(type)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    photoType === type
                      ? type === 'before' ? 'bg-blue-500 text-white' :
                        type === 'after' ? 'bg-green-500 text-white' :
                        'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title (Optional)</label>
            <input
              type="text"
              value={photoTitle}
              onChange={(e) => setPhotoTitle(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none"
              placeholder="e.g., Week 4 Progress"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={photoNotes}
              onChange={(e) => setPhotoNotes(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#CFAFA3] focus:border-transparent outline-none resize-none"
              rows={3}
              placeholder="Any observations about your skin..."
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#B89A8E] text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" /> Select Photo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadPhotoModal;

