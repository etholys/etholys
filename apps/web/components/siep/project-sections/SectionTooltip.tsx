'use client';

import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export function SectionTooltip({ content, title }: { content: string; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded-full hover:bg-indigo-50 transition text-gray-400 hover:text-indigo-500"
        title={title || 'Ayuda'}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-30 top-8 left-0 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-4 text-sm text-gray-600 leading-relaxed">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-800 text-xs uppercase tracking-wide">{title || 'Ayuda'}</span>
            <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5 text-gray-400" /></button>
          </div>
          <p dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      )}
    </div>
  );
}

export default SectionTooltip;
