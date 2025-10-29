import React from 'react';

interface StatusBadgeProps {
  status: 'connected' | 'disconnected' | 'loading' | 'error';
  children: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children }) => {
  const statusClasses = {
    connected: 'bg-success-100 text-success-800 border-success-200',
    disconnected: 'bg-gray-100 text-gray-800 border-gray-200',
    loading: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    error: 'bg-red-100 text-red-800 border-red-200'
  };
  
  const dotClasses = {
    connected: 'bg-success-500',
    disconnected: 'bg-gray-400',
    loading: 'bg-yellow-500',
    error: 'bg-red-500'
  };
  
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusClasses[status]}`}>
      <span className={`w-2 h-2 rounded-full mr-2 ${dotClasses[status]} ${status === 'loading' ? 'animate-pulse' : ''}`}></span>
      {children}
    </span>
  );
};
