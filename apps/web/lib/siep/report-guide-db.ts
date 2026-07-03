import { prisma } from '@/lib/prisma';

const VALID_DOMAINS = new Set(['me', 'budget', 'general']);

export function normalizeGuideDomain(raw: unknown): string {
  const v = String(raw || 'general');
  return VALID_DOMAINS.has(v) ? v : 'general';
}

export function isPrismaUnknownFieldError(err: unknown, field: string): boolean {
  return err instanceof Error && err.message.includes(`Unknown argument \`${field}\``);
}

type GuideCreateData = {
  projectId: string;
  title: string;
  fileName: string;
  cloudStoragePath: string;
  mimeType: string | null;
  fileSizeBytes: number;
  uploadedById: string;
  order: number;
  extractionStatus: string;
  domain: string;
};

export async function createProjectReportGuide(data: GuideCreateData) {
  const include = { uploadedBy: { select: { id: true, name: true } } } as const;

  try {
    return await prisma.projectReportGuide.create({ data, include });
  } catch (err: unknown) {
    if (!isPrismaUnknownFieldError(err, 'domain')) throw err;

    const { domain, ...withoutDomain } = data;
    const guide = await prisma.projectReportGuide.create({
      data: withoutDomain,
      include,
    });
    await prisma.$executeRaw`UPDATE "ProjectReportGuide" SET "domain" = ${domain} WHERE "id" = ${guide.id}`;
    return { ...guide, domain };
  }
}

export async function findProjectReportGuides(projectId: string, domain?: string | null) {
  const baseWhere = { projectId, isActive: true };
  const orderBy = [{ order: 'asc' as const }, { createdAt: 'desc' as const }];
  const include = { uploadedBy: { select: { id: true, name: true } } };

  if (!domain) {
    return prisma.projectReportGuide.findMany({ where: baseWhere, orderBy, include });
  }

  try {
    return await prisma.projectReportGuide.findMany({
      where: { ...baseWhere, OR: [{ domain }, { domain: 'general' }] },
      orderBy,
      include,
    });
  } catch (err: unknown) {
    if (!isPrismaUnknownFieldError(err, 'domain') && !(err instanceof Error && err.message.includes('Unknown arg `domain`'))) {
      throw err;
    }
    const all = await prisma.projectReportGuide.findMany({ where: baseWhere, orderBy, include });
    return all.filter((g) => {
      const d = (g as { domain?: string }).domain ?? 'general';
      return d === domain || d === 'general';
    });
  }
}
