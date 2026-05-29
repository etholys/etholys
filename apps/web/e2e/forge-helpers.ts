import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export type InviteSeed = {
  email: string;
  password: string;
  inviteToken: string;
  courseId: string;
  courseTitle: string;
};

export type MultiOrgSeed = {
  email: string;
  password: string;
  companyA: string;
  companyB: string;
  courseA: { id: string; title: string };
  courseB: { id: string; title: string };
};

type SeedState = { invite: InviteSeed; invitePassword: InviteSeed; multiOrg: MultiOrgSeed };

function readState(): SeedState {
  const p = path.join(__dirname, '.seed-state.json');
  if (!fs.existsSync(p)) {
    throw new Error('Missing e2e/.seed-state.json — run playwright globalSetup');
  }
  return JSON.parse(fs.readFileSync(p, 'utf8')) as SeedState;
}

export function seedInvite(): InviteSeed {
  return readState().invite;
}

export function seedInvitePassword(): InviteSeed {
  return readState().invitePassword;
}

export function seedMultiOrg(): MultiOrgSeed {
  return readState().multiOrg;
}

/** Login via NextAuth API (mais fiável que só clicar no formulário). */
export async function loginWithCredentials(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
  const csrf = (await page.request.get(`${base}/api/auth/csrf`).then((r) => r.json())) as {
    csrfToken: string;
  };
  const res = await page.request.post(`${base}/api/auth/callback/credentials`, {
    form: {
      csrfToken: csrf.csrfToken,
      email,
      password,
      redirect: 'false',
      json: 'true',
      callbackUrl: `${base}/hub`,
    },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
  if (!res.ok() || body.error) {
    throw new Error(`Login failed: ${body.error ?? res.status()}`);
  }
  await page.goto('/hub');
  await page.waitForURL(/\/hub(\/|$)/, { timeout: 30_000 });
}
