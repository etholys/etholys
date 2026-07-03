import type { PrismaClient } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';

type RuntimeField = { name: string };
type RuntimeEnumValue = { name: string };
type RuntimeModel = { fields?: RuntimeField[] };

let fieldCache: Set<string> | null = null;
let enumCache: Set<string> | null = null;

function getRuntime(client: PrismaClient) {
  return (client as unknown as {
    _runtimeDataModel?: {
      models?: Record<string, RuntimeModel>;
      enums?: Record<string, { values?: RuntimeEnumValue[] }>;
    };
  })._runtimeDataModel;
}

function ensureCaches(): void {
  if (fieldCache && enumCache) return;
  fieldCache = new Set<string>();
  enumCache = new Set<string>();
  const runtime = getRuntime(getPrisma());
  for (const [modelName, modelDef] of Object.entries(runtime?.models ?? {})) {
    for (const field of modelDef.fields ?? []) {
      fieldCache.add(`${modelName}.${field.name}`);
    }
  }
  for (const [enumName, enumDef] of Object.entries(runtime?.enums ?? {})) {
    for (const value of enumDef.values ?? []) {
      enumCache.add(`${enumName}.${value.name}`);
    }
  }
}

/** True when the loaded Prisma client exposes a scalar/relation field on a model. */
export function prismaHasField(model: string, field: string): boolean {
  ensureCaches();
  return fieldCache!.has(`${model}.${field}`);
}

export function prismaHasEnumValue(enumName: string, value: string): boolean {
  ensureCaches();
  return enumCache!.has(`${enumName}.${value}`);
}

export function resetPrismaFieldCache(): void {
  fieldCache = null;
  enumCache = null;
}
