import React from 'react';
import { Link } from 'react-router-dom';

const ApiDocs: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDF8F6] via-white to-[#FDF8F6] p-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="text-[#D4A574] hover:underline mb-4 inline-block">
          ← Back to Home
        </Link>
        <h1 className="text-3xl font-bold text-[#2D2A3E] mb-4">API Documentation</h1>
        <p className="text-gray-600">SkinAura PRO API documentation coming soon.</p>
      </div>
    </div>
  );
};

export default ApiDocs;
