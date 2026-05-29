'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';
import { ForgeLibroPanel } from '@/components/forge/ForgeLibroPanel';
import { ForgeLibroSearch } from '@/components/forge/ForgeLibroSearch';
import { useForgeT } from '@/lib/forge/use-forge-t';

export default function ForgeLibroPage() {
  const ft = useForgeT();
  const { id: courseId } = useParams<{ id: string }>();
  const [hasPdf, setHasPdf] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const pdfSrc = hasPdf ? `/api/forge/courses/${courseId}/libro/file` : null;

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}`)
      .then((r) => r.json())
      .then((d) => setTitle(d.course?.title ?? 'Curso'));
    fetch(`/api/forge/courses/${courseId}/libro`)
      .then((r) => r.json())
      .then((d) => {
        setHasPdf(Boolean(d.hasLibro));
        setFileName(d.fileName ?? null);
      });
  }, [courseId]);

  return (
    <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <Link
          href={`/hub/forge/cursos/${courseId}`}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {ft('forge.libro.back')}
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-black">
          <BookOpen className="h-6 w-6 text-indigo-600" />
          {ft('forge.libro.title')} — {title}
        </h1>
        {pdfSrc && (
          <a
            href={pdfSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir en pestaña nueva
          </a>
        )}
      </div>
      <ForgeLibroPanel courseTitle={title} courseId={courseId} hasPdf={hasPdf} />
      <ForgeLibroSearch courseId={courseId} />
      {pdfSrc ? (
        <object
          data={pdfSrc}
          type="application/pdf"
          title={fileName ?? 'Libro PDF'}
          className="flex-1 w-full min-h-[60vh] rounded-xl border border-slate-200 bg-white shadow-inner"
        >
          <p className="p-8 text-center text-sm text-slate-600">
            {ft('forge.libro.noPdf')}{' '}
            <a href={pdfSrc} className="text-indigo-700 underline">
              Descargar / ver PDF
            </a>
          </p>
        </object>
      ) : (
        <div className="flex-1 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-500 text-sm p-8 text-center">
          {ft('forge.libro.noPdf')}
        </div>
      )}
    </div>
  );
}
