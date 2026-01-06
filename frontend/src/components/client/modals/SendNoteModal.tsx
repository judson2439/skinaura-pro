import React, { useState } from 'react';
import { X, Send, MessageSquare, Loader2 } from 'lucide-react';
import { CustomSelect } from '@/components/ui/custom-select';
import { useToast } from '@/hooks/use-toast';

interface Professional {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface SendNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  professionals: Professional[];
  onSubmit: (professionalId: string, note: string) => Promise<void>;
}

const SendNoteModal: React.FC<SendNoteModalProps> = ({
  isOpen,
  onClose,
  professionals,
  onSubmit,
}) => {
  const { toast } = useToast();
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const professionalOptions = professionals.map(p => ({
    value: p.id,
    label: p.name,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProfessionalId) {
      toast({
        title: 'Error',
        description: 'Please select a professional',
        variant: 'destructive',
      });
      return;
    }

    if (!note.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a note',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(selectedProfessionalId, note.trim());
      toast({
        title: 'Note Sent',
        description: 'Your note has been sent to the professional successfully.',
      });
      // Reset form and close modal
      setSelectedProfessionalId('');
      setNote('');
      onClose();
    } catch (error) {
      console.error('Error sending note:', error);
      toast({
        title: 'Error',
        description: 'Failed to send note. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedProfessionalId('');
      setNote('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-[#CFAFA3]/10 to-[#E8D5D0]/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CFAFA3]/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#CFAFA3]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Send Note</h2>
              <p className="text-sm text-gray-500">Send a message to your professional</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Professional Select */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Select Professional
            </label>
            <CustomSelect
              options={professionalOptions}
              value={selectedProfessionalId}
              onChange={setSelectedProfessionalId}
              placeholder="Choose a professional..."
            />
          </div>

          {/* Note Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Your Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 1000))}
              placeholder="Write your message here..."
              rows={5}
              maxLength={1000}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#CFAFA3]/50 focus:border-[#CFAFA3] resize-none transition-all text-gray-900 placeholder:text-gray-400"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-400 text-right">
              {note.length}/1000 characters
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedProfessionalId || !note.trim()}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-[#CFAFA3] to-[#E8D5D0] text-white rounded-xl hover:opacity-90 transition-all font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Note
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendNoteModal;
