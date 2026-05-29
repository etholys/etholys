import { test, expect } from '@playwright/test';
import { seedInvite, seedInvitePassword } from './forge-helpers';

test.describe('FORGE invite → activar → magic login', () => {

  test('magic link enters course', async ({ page }) => {
    const seed = seedInvite();

    await page.goto(`/hub/forge/activar?token=${seed.inviteToken}`);
    await expect(page.getByText(seed.courseTitle)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /mágico|magic/i }).click();

    await page.waitForURL(new RegExp(`/hub/forge/cursos/${seed.courseId}`), { timeout: 45_000 });
  });

  test('password setup enters course', async ({ page }) => {
    const seed = seedInvitePassword();
    const pwd = 'E2ePass99!';

    await page.goto(`/hub/forge/activar?token=${seed.inviteToken}`);
    await expect(page.getByText(seed.courseTitle)).toBeVisible({ timeout: 20_000 });

    await page.getByPlaceholder(/contraseña|password|palavra/i).first().fill(pwd);
    await page.getByPlaceholder(/repetir|repeat|confirmar/i).fill(pwd);
    await page.getByRole('button', { name: /contraseña|password|palavra/i }).click();

    await page.waitForURL(new RegExp(`/hub/forge/cursos/${seed.courseId}`), { timeout: 30_000 });
  });
});
