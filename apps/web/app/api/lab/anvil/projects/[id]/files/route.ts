export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAnvilAccess, canAccessProject } from '@/lib/lab-anvil/access';
import {
  assertSandboxWorkspace,
  deleteProjectFile,
  listProjectFiles,
  readProjectFile,
  writeProjectFile,
} from '@/lib/lab-anvil/sandbox-fs';
import { applyArtifactsToSandbox } from '@/lib/lab-anvil/apply-artifacts';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!(await canAccessProject(access, id))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }

  try {
    await assertSandboxWorkspace(id);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Sandbox indisponível' },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get('path');

  if (path) {
    const file = await readProjectFile(id, path);
    if (!file) return NextResponse.json({ error: 'Ficheiro não encontrado' }, { status: 404 });
    return NextResponse.json({ file });
  }

  const files = await listProjectFiles(id);
  return NextResponse.json({ files });
}

export async function PUT(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!(await canAccessProject(access, id))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }

  const body = await req.json();

  // Apply batch from agent artifacts
  if (body.action === 'apply' && Array.isArray(body.artifacts)) {
    try {
      const result = await applyArtifactsToSandbox({
        projectId: id,
        artifacts: body.artifacts,
        updatedById: access.userId,
      });
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Erro ao aplicar' },
        { status: 400 },
      );
    }
  }

  const path = String(body.path || '').trim();
  if (!path) {
    return NextResponse.json({ error: 'path requerido' }, { status: 400 });
  }
  if (typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content (string) requerido' }, { status: 400 });
  }

  try {
    const file = await writeProjectFile({
      projectId: id,
      path,
      content: body.content,
      updatedById: access.userId,
    });
    return NextResponse.json({
      file: {
        id: file.id,
        path: file.path,
        size: file.size,
        sha256: file.sha256,
        mimeType: file.mimeType,
        updatedAt: file.updatedAt,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao gravar' },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!(await canAccessProject(access, id))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const path = String(body.path || new URL(req.url).searchParams.get('path') || '').trim();
  if (!path) {
    return NextResponse.json({ error: 'path requerido' }, { status: 400 });
  }

  try {
    await deleteProjectFile(id, path);
    return NextResponse.json({ success: true, path });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao apagar' },
      { status: 400 },
    );
  }
}
