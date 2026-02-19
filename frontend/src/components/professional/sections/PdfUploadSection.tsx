import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileText,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { getAuthToken } from '../../../lib/authStorage';
import apiClient from '../../../lib/apiClient';
import { encryptPdfFile, decryptPdfToBlob } from '../../../lib/encryption';

// ============================================================================
// TYPES
// ============================================================================

interface PdfUploadSectionProps {
  onNavigateToView?: (viewId: string) => void;
}

interface PdfListItem {
  id: string;
  original_name: string;
  stored_filename: string;
  iv: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
}

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// HELPERS
// ============================================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ============================================================================
// COMPONENT
// ============================================================================

const PdfUploadSection: React.FC<PdfUploadSectionProps> = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [list, setList] = useState<PdfListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [loadingPreviews, setLoadingPreviews] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalPdf, setModalPdf] = useState<{ url: string; name: string } | null>(null);

  const fetchList = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    setLoadingList(true);
    try {
      apiClient.setAuthToken(token);
      const res = await apiClient.get<{ success: boolean; data?: PdfListItem[] }>('/api/professional/pdfs');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setList(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch PDF list:', e);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Load decrypted preview URL for an item (fetch encrypted file, decrypt, create blob URL)
  const loadPreview = useCallback(async (item: PdfListItem) => {
    if (previewUrls[item.id]) return;
    setLoadingPreviews((prev) => ({ ...prev, [item.id]: true }));
    const token = getAuthToken();
    if (!token) return;
    try {
      const url = `${API_BASE.replace(/\/$/, '')}/api/professional/pdfs/${item.id}/file`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch file');
      const buffer = await response.arrayBuffer();
      const encryptedBase64 = arrayBufferToBase64(buffer);
      const blob = await decryptPdfToBlob(encryptedBase64, item.iv, item.mime_type);
      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrls((prev) => ({ ...prev, [item.id]: objectUrl }));
    } catch (e) {
      console.error('Failed to decrypt preview for', item.id, e);
    } finally {
      setLoadingPreviews((prev) => ({ ...prev, [item.id]: false }));
    }
  }, [previewUrls]);

  // Auto-load preview for each PDF when list is loaded or updated
  useEffect(() => {
    if (!list.length) return;
    list.forEach((item) => {
      loadPreview(item); // no-op if already loaded or loading
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when list identity/length changes
  }, [list]);

  // Revoke all preview blob URLs on unmount
  useEffect(() => {
    return () => {
      setPreviewUrls((prev) => {
        Object.values(prev).forEach(URL.revokeObjectURL);
        return {};
      });
    };
  }, []);

  const processFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setSuccessMessage(null);
    const next: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are allowed. Please select .pdf files only.');
        return;
      }
      if (file.size > MAX_PDF_SIZE_BYTES) {
        setError(`"${file.name}" is larger than 10MB.`);
        return;
      }
      next.push(file);
    }
    setSelectedFiles((prev) => [...prev, ...next]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const removeSelected = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const clearSelected = () => {
    setSelectedFiles([]);
    setError(null);
    setSuccessMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one PDF file.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = getAuthToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }

      const filesPayload = await Promise.all(
        selectedFiles.map(async (file) => {
          const { encrypted, iv, mimeType, originalName } = await encryptPdfFile(file);
          return { encrypted, iv, mimeType, originalName };
        })
      );

      apiClient.setAuthToken(token);
      const response = await apiClient.post<{
        success: boolean;
        data?: Array<{ id: string; original_name: string }>;
        error?: string;
      }>('/api/professional/pdfs', { files: filesPayload });

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Failed to upload PDFs');
      }

      const count = response.data.data?.length ?? 0;
      setSuccessMessage(count === 1 ? '1 PDF uploaded successfully!' : `${count} PDFs uploaded successfully!`);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchList();
    } catch (err) {
      console.error('Error uploading PDFs:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload PDFs');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const token = getAuthToken();
    if (!token) return;
    setDeletingId(id);
    try {
      apiClient.setAuthToken(token);
      const res = await apiClient.delete<{ success: boolean; error?: string }>(`/api/professional/pdfs/${id}`);
      if (res.data?.success) {
        setPreviewUrls((prev) => {
          const url = prev[id];
          if (url) URL.revokeObjectURL(url);
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setList((prev) => prev.filter((i) => i.id !== id));
      } else {
        setError(res.data?.error || 'Failed to delete PDF');
      }
    } catch (e) {
      console.error('Delete PDF failed:', e);
      setError('Failed to delete PDF');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
          <FileText className="w-6 h-6 text-[#2D2A3E]" />
        </div>
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#2D2A3E]">PDF Upload</h2>
          <p className="text-gray-500">Upload documents and forms (encrypted)</p>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-green-700 font-medium">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Upload card – at top */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <h3 className="text-lg font-semibold text-[#2D2A3E] mb-4">Upload PDFs (multiple allowed)</h3>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFiles.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
              ${isDragging
                ? 'border-[#CFAFA3] bg-[#CFAFA3]/10 scale-[1.02]'
                : 'border-gray-200 hover:border-[#CFAFA3] hover:bg-gray-50'
              }
            `}
          >
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDragging ? 'bg-[#CFAFA3]/20' : 'bg-gray-100'}`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-[#CFAFA3]' : 'text-gray-400'}`} />
            </div>
            <p className="text-gray-700 font-medium mb-2">
              {isDragging ? 'Drop PDFs here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-gray-500 text-sm">PDF only, max 10MB each. You can select multiple files.</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D2A3E] text-white rounded-lg text-sm font-medium hover:bg-[#3D3A4E] transition-colors mt-4">
              <FileText className="w-4 h-4" />
              Select PDF files
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2">
              {selectedFiles.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100"
                >
                  <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <span className="flex-1 truncate text-sm font-medium text-blue-800">{file.name}</span>
                  <span className="text-xs text-blue-600">{(file.size / 1024).toFixed(1)} KB</span>
                  <button
                    type="button"
                    onClick={() => removeSelected(index)}
                    className="p-1.5 hover:bg-blue-100 rounded-lg"
                  >
                    <X className="w-4 h-4 text-blue-600" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={clearSelected}
                disabled={isSaving}
                className="px-6 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#2D2A3E] text-white rounded-lg font-medium hover:bg-[#3D3A4E] disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Upload {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Requirements</h4>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>• Format: PDF only. Multiple files allowed.</li>
            <li>• Maximum size per file: 10MB.</li>
            <li>• Files are encrypted before upload and decrypted only in your browser for preview.</li>
          </ul>
        </div>
      </div>

      {/* Your uploaded PDFs – grid of cards with preview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-[#2D2A3E] mb-4">Your uploaded PDFs</h3>
        {loadingList ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#CFAFA3]" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-gray-500 py-6 text-center">No PDFs uploaded yet. Upload some above.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-6">
            {list.map((item) => (
              <div
                key={item.id}
                className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card preview area – auto-loaded */}
                <div className="relative aspect-[3/4] min-h-[200px] bg-gray-100 flex items-center justify-center">
                  {loadingPreviews[item.id] ? (
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Loader2 className="w-10 h-10 animate-spin text-[#CFAFA3]" />
                      <span className="text-sm">Loading preview…</span>
                    </div>
                  ) : previewUrls[item.id] ? (
                    <iframe
                      src={previewUrls[item.id]}
                      title={item.original_name}
                      className="absolute inset-0 w-full h-full border-0"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <FileText className="w-12 h-12 text-red-300" />
                      <span className="text-sm">Loading…</span>
                    </div>
                  )}
                </div>
                {/* Card footer: title, meta, actions */}
                <div className="p-4 border-t border-gray-100 flex flex-col gap-3">
                  <p className="font-medium text-gray-800 truncate text-sm" title={item.original_name}>
                    {item.original_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(item.file_size_bytes / 1024).toFixed(1)} KB · {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => previewUrls[item.id] && setModalPdf({ url: previewUrls[item.id], name: item.original_name })}
                      disabled={!previewUrls[item.id]}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2D2A3E] text-white rounded-lg text-sm font-medium hover:bg-[#3D3A4E] disabled:opacity-70 flex-1 justify-center"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 flex-shrink-0"
                      title="Delete"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF viewer modal */}
      {modalPdf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setModalPdf(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl flex flex-col w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <p className="font-medium text-gray-800 truncate" title={modalPdf.name}>
                {modalPdf.name}
              </p>
              <button
                type="button"
                onClick={() => setModalPdf(null)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-2">
              <iframe
                src={modalPdf.url}
                title={modalPdf.name}
                className="w-full h-full min-h-[70vh] rounded-lg border border-gray-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfUploadSection;
