export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getFullLibroHtml, getFullLibroMarkdown } from '@/lib/forge/expedicion-libro-full';

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get('format');
  if (format === 'md') {
    return new NextResponse(getFullLibroMarkdown(), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="libro-expedicion-completo.md"',
      },
    });
  }
  return new NextResponse(getFullLibroHtml(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
