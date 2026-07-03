'use client';

import { Crosshair } from 'lucide-react';

type Props = {
  selected?: boolean;
  title: string;
  onSelect: () => void;
};

export function SelectForChatButton({ selected, title, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`p-0.5 rounded shrink-0 transition ${
        selected
          ? 'text-indigo-700 bg-indigo-100 ring-1 ring-indigo-300'
          : 'text-slate-300 hover:text-indigo-600 hover:bg-indigo-50'
      }`}
      title={title}
      aria-pressed={selected}
    >
      <Crosshair className="w-3 h-3" />
    </button>
  );
}

export function selectionRingClass(active: boolean): string {
  return active ? 'ring-2 ring-inset ring-indigo-400 bg-indigo-50/30' : '';
}
