import React from 'react';
import { Link } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF8F6] via-white to-[#FDF8F6] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-[#2D2A3E] mb-4">Reset Password</h1>
        <p className="text-gray-600 mb-6">Password reset functionality coming soon.</p>
        <Link to="/" className="text-[#D4A574] hover:underline">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;
