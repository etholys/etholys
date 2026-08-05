export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import {
  etagForContent,
  resolvePreviewByToken,
  servePreviewFile,
} from '@/lib/lab-anvil/preview';
import { guessMime } from '@/lib/lab-anvil/sandbox-fs';

type Ctx = { params: Promise<{ token: string; path?: string[] }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { token, path: pathParts } = await ctx.params;
  const resolved = await resolvePreviewByToken(token);
  if (!resolved) {
    return new NextResponse('Preview não encontrado ou expirado', { status: 404 });
  }

  const rel = pathParts?.length ? pathParts.map(decodeURIComponent).join('/') : 'index.html';

  try {
    const file = await servePreviewFile(resolved.projectId, rel);
    if (!file || file.contentText == null) {
      // Directory listing fallback for empty path without index
      if (rel === 'index.html') {
        return new NextResponse(
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ANVIL Preview</title></head><body><p>Sem index.html no sandbox.</p></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        );
      }
      return new NextResponse('Not found', { status: 404 });
    }

    const content = file.contentText;
    const etag = file.sha256 ? `"${file.sha256}"` : etagForContent(content);
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || guessMime(file.path),
        'Cache-Control': 'private, max-age=60',
        ETag: etag,
        'X-Anvil-Preview': '1',
      },
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : 'Erro', { status: 400 });
  }
}
