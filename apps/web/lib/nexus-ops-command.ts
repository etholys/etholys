import { prisma } from './prisma';
import { deriveOpsAlerts } from './nexus-ops';
import {
  alertFingerprint,
  formatAlertMessage,
  formatCommandRequest,
  sendWhatsappText,
  whatsappConfigured,
} from './nexus-whatsapp';

const DEFAULT_RULES = [
  { kind: 'irrigation', label: 'Irrigação', enabled: false },
  { kind: 'ventilation', label: 'Ventilação', enabled: false },
  { kind: 'whatsapp_alerts', label: 'Alertas no WhatsApp', enabled: true },
] as const;

export async function ensureOpsRules(companyId: string) {
  const existing = await prisma.nexusOpsRule.findMany({ where: { companyId } });
  const have = new Set(existing.map((r) => r.kind));
  const missing = DEFAULT_RULES.filter((r) => !have.has(r.kind));
  if (missing.length) {
    await prisma.nexusOpsRule.createMany({
      data: missing.map((r) => ({ companyId, kind: r.kind, label: r.label, enabled: r.enabled })),
    });
  }
  return prisma.nexusOpsRule.findMany({
    where: { companyId },
    orderBy: { kind: 'asc' },
  });
}

export async function maybeNotifyWhatsappAlerts(companyId: string): Promise<void> {
  const [link, alertsRule] = await Promise.all([
    prisma.nexusWhatsappLink.findFirst({ where: { companyId } }),
    prisma.nexusOpsRule.findFirst({ where: { companyId, kind: 'whatsapp_alerts' } }),
  ]);
  if (!link || !link.alertsEnabled) return;
  if (alertsRule && !alertsRule.enabled) return;
  const alerts = await deriveOpsAlerts(companyId);
  if (!alerts.length) return;
  const hash = alertFingerprint(alerts);
  if (hash === link.lastAlertHash) return;
  if (!whatsappConfigured()) {
    await prisma.nexusWhatsappLink.update({
      where: { id: link.id },
      data: { lastAlertHash: hash },
    });
    return;
  }
  const sent = await sendWhatsappText(link.phoneE164, formatAlertMessage(alerts));
  if (!sent.ok) return;
  await prisma.nexusWhatsappLink.update({
    where: { id: link.id },
    data: { lastAlertHash: hash, lastOutboundAt: new Date() },
  });
}

export async function requestAutomationCommand(
  companyId: string,
  kind: string
): Promise<{ sent: boolean; reason?: string }> {
  const link = await prisma.nexusWhatsappLink.findFirst({ where: { companyId } });
  if (!link) return { sent: false, reason: 'no_whatsapp' };
  await prisma.nexusWhatsappLink.update({
    where: { id: link.id },
    data: { pendingCommandKind: kind, pendingCommandAt: new Date() },
  });
  if (!whatsappConfigured()) return { sent: false, reason: 'whatsapp_not_configured' };
  const sent = await sendWhatsappText(link.phoneE164, formatCommandRequest(kind));
  if (sent.ok) {
    await prisma.nexusWhatsappLink.update({
      where: { id: link.id },
      data: { lastOutboundAt: new Date() },
    });
  }
  return { sent: sent.ok, reason: sent.error };
}
