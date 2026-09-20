import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
}

export function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-5 flex flex-col justify-between h-full shadow-sm">
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className="text-3xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>
      {sublabel && (
        <div className="text-xs text-gray-400 mt-1">
          {sublabel}
        </div>
      )}
    </div>
  );
}
