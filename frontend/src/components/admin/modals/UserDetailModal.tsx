/**
 * @fileoverview User Detail Modal Component
 */

import React, { useState, useEffect } from 'react';
import { X, Edit, Save } from 'lucide-react';
import { UserProfile } from '../types';

interface UserDetailModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: UserProfile) => void;
  mode: 'view' | 'edit';
}

const UserDetailModal: React.FC<UserDetailModalProps> = ({ user, isOpen, onClose, onSave, mode }) => {
  const [editedUser, setEditedUser] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(mode === 'edit');

  useEffect(() => {
    setEditedUser(user);
    setIsEditing(mode === 'edit');
  }, [user, mode]);

  if (!isOpen || !user || !editedUser) return null;

  const handleSave = () => {
    if (editedUser) {
      onSave(editedUser);
      setIsEditing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            {editedUser.avatar_url ? (
              <img
                src={editedUser.avatar_url}
                alt={editedUser.full_name || 'User'}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#CFAFA3] to-[#E8D5D0] flex items-center justify-center">
                <span className="text-lg font-medium text-[#2D2A3E]">
                  {editedUser.full_name?.split(' ').map(n => n[0]).join('') || editedUser.email[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{editedUser.full_name || 'Unnamed User'}</h2>
              <p className="text-sm text-gray-500">{editedUser.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedUser.full_name || ''}
                    onChange={(e) => setEditedUser({ ...editedUser, full_name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                  />
                ) : (
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{editedUser.full_name || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{editedUser.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedUser.phone || ''}
                    onChange={(e) => setEditedUser({ ...editedUser, phone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                  />
                ) : (
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{editedUser.phone || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                {isEditing ? (
                  <select
                    value={editedUser.role || 'client'}
                    onChange={(e) => setEditedUser({ ...editedUser, role: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                  >
                    <option value="client">Client</option>
                    <option value="professional">Professional</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <p className="px-4 py-2.5 bg-gray-50 rounded-xl">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      editedUser.role === 'professional'
                        ? 'bg-purple-100 text-purple-700'
                        : editedUser.role === 'admin'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {editedUser.role || 'client'}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Professional Information */}
          {(editedUser.role === 'professional' || editedUser.business_name || editedUser.license_number) && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Professional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedUser.business_name || ''}
                      onChange={(e) => setEditedUser({ ...editedUser, business_name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                    />
                  ) : (
                    <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{editedUser.business_name || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedUser.license_number || ''}
                      onChange={(e) => setEditedUser({ ...editedUser, license_number: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                    />
                  ) : (
                    <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{editedUser.license_number || 'N/A'}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Client Information */}
          {(editedUser.role === 'client' || editedUser.skin_type || editedUser.concerns) && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Client Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Skin Type</label>
                  {isEditing ? (
                    <select
                      value={editedUser.skin_type || ''}
                      onChange={(e) => setEditedUser({ ...editedUser, skin_type: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                    >
                      <option value="">Select skin type</option>
                      <option value="normal">Normal</option>
                      <option value="dry">Dry</option>
                      <option value="oily">Oily</option>
                      <option value="combination">Combination</option>
                      <option value="sensitive">Sensitive</option>
                    </select>
                  ) : (
                    <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900 capitalize">{editedUser.skin_type || 'N/A'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concerns</label>
                  <div className="px-4 py-2.5 bg-gray-50 rounded-xl">
                    {editedUser.concerns && editedUser.concerns.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {editedUser.concerns.map((concern, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#CFAFA3]/20 text-[#2D2A3E]"
                          >
                            {concern}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No concerns listed</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Account Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{formatDate(editedUser.created_at)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-900">{formatDate(editedUser.updated_at)}</p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                <p className="px-4 py-2.5 bg-gray-50 rounded-xl text-gray-500 text-sm font-mono">{editedUser.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {isEditing && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
            <button
              onClick={() => {
                setEditedUser(user);
                setIsEditing(false);
              }}
              className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetailModal;
