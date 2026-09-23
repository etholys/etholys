/** SKUs de Etholys Tools que só aparecem se a empresa os contratou. */
export const HUB_TOOL_ADDON_SKU: Record<string, string> = {
  STUDIO: 'addon.tool.studio',
  WORK: 'addon.tool.work',
};

export const STUDIO_ADDON_SKU = HUB_TOOL_ADDON_SKU.STUDIO;
export const WORK_ADDON_SKU = HUB_TOOL_ADDON_SKU.WORK;

export function hubToolAddonSku(systemId: string): string | null {
  return HUB_TOOL_ADDON_SKU[systemId.toUpperCase()] ?? null;
}

/** Sem faturação activa (legado) as tools continuam visíveis. Com contrato, só o add-on. */
export function companyHasHubTool(
  systemId: string,
  opts: { billingEnforced?: boolean; addOnCodes?: string[] | null },
): boolean {
  const sku = hubToolAddonSku(systemId);
  if (!sku) return true;
  if (!opts.billingEnforced) return true;
  return (opts.addOnCodes ?? []).includes(sku);
}
