import React from 'react';

interface MobileCardProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export const MobileCard: React.FC<MobileCardProps> = ({ children, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 ${
      onClick ? 'active:bg-gray-50 cursor-pointer' : ''
    }`}
  >
    {children}
  </div>
);