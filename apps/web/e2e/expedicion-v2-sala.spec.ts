import { test, expect, request } from '@playwright/test';
import { loginWithCredentials, seedExpedicionV2 } from './forge-helpers';

test.describe('La Expedición V2 — sala presencial', () => {
  test('facilitador: quiz pre → iniciar mesa → mapa V2', async ({ page }) => {
    const seed = seedExpedicionV2();
    const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

    await loginWithCredentials(page, seed.facilitatorEmail, seed.password);

    await page.goto(`/hub/forge/cursos/${seed.courseId}/sala?group=${seed.playGroupId}`);
    await expect(page.getByRole('heading', { name: seed.courseTitle })).toBeVisible({ timeout: 30_000 });

    const startRes = await page.request.post(`${base}/api/forge/shared-game-rooms`, {
      data: {
        activityId: seed.gameActivityId,
        playGroupId: seed.playGroupId,
      },
    });
    expect(startRes.ok()).toBeTruthy();
    const startData = await startRes.json();
    const roomId = startData.room?.id as string;
    expect(roomId).toBeTruthy();

    const preQuizRes = await page.request.patch(`${base}/api/forge/courses/${seed.courseId}/expedicion-v2`, {
      data: { action: 'complete_pre_quiz', answers: { q1: 'test' }, roomId },
    });
    expect(preQuizRes.ok()).toBeTruthy();

    await page.reload();
    await expect(page.getByRole('button', { name: /Mapa \+ Finanzas/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Presencial/i).first()).toBeVisible();

    const roomRes = await page.request.get(
      `${base}/api/forge/shared-game-rooms?activityId=${seed.gameActivityId}&playGroupId=${seed.playGroupId}`
    );
    expect(roomRes.ok()).toBeTruthy();
    const roomData = await roomRes.json();
    expect(roomData.room?.state?.v2FinancialMode).toBe(true);
    expect(roomData.room?.state?.v2Team).toBeTruthy();
  });

  test('API V2: sprint reducido hasta playing', async () => {
    const seed = seedExpedicionV2();
    const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

    const api = await request.newContext({ baseURL: base });
    const csrf = (await api.get('/api/auth/csrf').then((r) => r.json())) as {
      csrfToken: string;
    };
    await api.post('/api/auth/callback/credentials', {
      form: {
        csrfToken: csrf.csrfToken,
        email: seed.facilitatorEmail,
        password: seed.password,
        redirect: 'false',
        json: 'true',
      },
    });

    let res = await api.patch(`/api/forge/courses/${seed.courseId}/expedicion-v2`, {
      data: { action: 'complete_pre_quiz', answers: {} },
    });
    expect(res.ok()).toBeTruthy();
    const body1 = await res.json();
    expect(body1.v2.phase).toBe('playing');

    res = await api.patch(`/api/forge/courses/${seed.courseId}/expedicion-v2`, {
      data: {
        action: 'add_postit',
        station: 'raices',
        type: 'diagnostico',
        text: 'Propósito E2E',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body2 = await res.json();
    expect(body2.v2.constructionMap.postIts.length).toBeGreaterThan(0);
    await api.dispose();
  });
});
