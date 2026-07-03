'use client';

import { SystemLicenseGate } from '@/components/hub/SystemLicenseGate';

export default function PrismLayout({ children }: { children: React.ReactNode }) {
  return <SystemLicenseGate system="PRISM">{children}</SystemLicenseGate>;
}
