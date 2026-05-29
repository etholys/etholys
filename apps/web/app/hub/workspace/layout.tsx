'use client';

import { HubWorkspaceShell } from '@/components/hub/HubWorkspaceShell';
import type { ReactNode } from 'react';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <HubWorkspaceShell>{children}</HubWorkspaceShell>;
}
