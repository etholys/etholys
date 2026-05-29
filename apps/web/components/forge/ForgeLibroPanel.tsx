'use client';

import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { EXPEDICION_LIBRO_CHAPTERS, libroChapterForModuleTitle } from '@/lib/forge/libro-reference';

export function ForgeLibroPanel({
  moduleTitle,
  courseTitle,
  courseId,
  hasPdf,
}: {
  moduleTitle?: string;
  courseTitle?: string;
  courseId?: string;
  hasPdf?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isExpedicion = (courseTitle ?? '').toLowerCase().includes('expedición') ||
    (courseTitle ?? '').toLowerCase().includes('expedicion');

  if (!isExpedicion && !hasPdf) return null;

  const current = moduleTitle ? libroChapterForModuleTitle(moduleTitle) : undefined;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-amber-950">
          <BookOpen className="h-4 w-4" />
          Libro didáctico
          {current && <span className="font-normal text-amber-800">— {current.title}</span>}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t border-amber-200/80 px-4 pb-4 space-y-3">
          {current && (
            <p className="text-sm text-amber-950 pt-2">{current.summary}</p>
          )}
          {courseId && (hasPdf || isExpedicion) && (
            <a
              href={`/hub/forge/cursos/${courseId}/libro`}
              className="inline-flex rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800"
            >
              {hasPdf ? 'Abrir PDF del libro' : 'Lector del libro'}
            </a>
          )}
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/forge/libro/expedicion"
              className="text-sm font-semibold text-amber-900 underline hover:text-amber-700"
            >
              Índice (MD)
            </a>
            <a
              href="/api/forge/libro/expedicion/full?format=md"
              className="text-sm font-semibold text-amber-900 underline hover:text-amber-700"
            >
              Libro completo (MD)
            </a>
            <a
              href="/api/forge/libro/expedicion/full"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-amber-900 underline hover:text-amber-700"
            >
              Libro completo (HTML/PDF)
            </a>
          </div>
          <ul className="text-xs space-y-2 text-amber-900">
            {EXPEDICION_LIBRO_CHAPTERS.map((ch) => (
              <li key={ch.id} className={current?.id === ch.id ? 'font-bold' : ''}>
                <span className="text-amber-700">{ch.moduleHint}</span> — {ch.title}
                <p className="text-amber-800/90 mt-0.5">{ch.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
