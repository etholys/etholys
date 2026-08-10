import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const STUDIO_ACTIVITY_KINDS = [
  'created',
  'imported',
  'saved',
  'restored',
  'version',
  'ai_prompt',
  'ai_response',
  'ai_edit',
  'shared',
  'comment',
] as const;

export type StudioActivityKind = (typeof STUDIO_ACTIVITY_KINDS)[number];

export type RecordStudioActivityInput = {
  documentId: string;
  companyId: string;
  kind: StudioActivityKind;
  summary: string;
  actorUserId?: string | null;
  meta?: Prisma.InputJsonValue | null;
};

/** Regista evento na trilha (best-effort — nunca quebra o fluxo principal). */
export async function recordStudioActivity(input: RecordStudioActivityInput): Promise<void> {
  try {
    await prisma.studioDocumentActivity.create({
      data: {
        documentId: input.documentId,
        companyId: input.companyId,
        kind: input.kind,
        summary: input.summary.slice(0, 500),
        actorUserId: input.actorUserId || null,
        meta: input.meta ?? undefined,
      },
    });
  } catch (e) {
    console.warn('[studio] activity record skipped', e);
  }
}

export function truncatePreview(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
