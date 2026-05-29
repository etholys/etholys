import { test, expect } from '@playwright/test';
import { loginWithCredentials, seedMultiOrg } from './forge-helpers';

test.describe('FORGE multi-org company switch', () => {

  test('courses list respects activeCompanyId', async ({ page }) => {
    const seed = seedMultiOrg();

    await loginWithCredentials(page, seed.email, seed.password);
    await page.goto(`/hub/forge/cursos?companyId=${seed.companyA}`);
    await page.waitForTimeout(800);
    await expect(page.getByText(seed.courseA.title)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(seed.courseB.title)).not.toBeVisible();

    await page.goto(`/hub/forge/cursos?companyId=${seed.companyB}`);
    await page.waitForTimeout(800);
    await expect(page.getByText(seed.courseB.title)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(seed.courseA.title)).not.toBeVisible();
  });
});
