import 'server-only';

import bcrypt from 'bcryptjs';
import { getForgeDb } from '@/lib/forge/db';
import { ensureLearnerJourney } from '@/lib/forge/learner-journey';
import { generateForgeInviteToken, forgeInviteExpiresAt } from '@/lib/forge/invite-token';
import { generateMagicLoginToken, magicLoginExpiresAt } from '@/lib/forge/invite-auth';
import { buildForgeInviteNotification, parseForgeEmailLocale } from '@/lib/forge/email-templates';
import { sendForgeInviteEmail } from '@/lib/forge/send-forge-email';
import type { Locale } from '@/lib/i18n';
import { createNotification } from '@/lib/notify';

export async function inviteOneLearner(opts: {
  courseId: string;
  courseTitle: string;
  email: string;
  name?: string;
  invitedById: string;
  inviterName?: string | null;
  locale?: Locale;
}): Promise<{ ok: boolean; inviteUrl?: string; emailSent?: boolean; error?: string }> {
  const locale = parseForgeEmailLocale(opts.locale);
  try {
    const email = opts.email.trim().toLowerCase();
    let user = await getForgeDb().user.findUnique({ where: { email } });
    if (!user) {
      const tempPassword = await bcrypt.hash(`forge-${Date.now()}`, 10);
      user = await getForgeDb().user.create({
        data: {
          email,
          name: opts.name?.trim() || email.split('@')[0],
          password: tempPassword,
        },
      });
    } else if (opts.name?.trim() && !user.name) {
      await getForgeDb().user.update({
        where: { id: user.id },
        data: { name: opts.name.trim() },
      });
    }

    const inviteToken = generateForgeInviteToken();
    const magicToken = generateMagicLoginToken();

    await getForgeDb().forgeEnrollment.upsert({
      where: { courseId_userId: { courseId: opts.courseId, userId: user.id } },
      create: {
        courseId: opts.courseId,
        userId: user.id,
        status: 'active',
        accessScope: 'course_only',
        invitedById: opts.invitedById,
        inviteToken,
        inviteExpiresAt: forgeInviteExpiresAt(),
        magicLoginToken: magicToken,
        magicLoginExpiresAt: magicLoginExpiresAt(),
      },
      update: {
        status: 'active',
        accessScope: 'course_only',
        inviteToken,
        inviteExpiresAt: forgeInviteExpiresAt(),
        magicLoginToken: magicToken,
        magicLoginExpiresAt: magicLoginExpiresAt(),
      },
    });

    await getForgeDb().forgeLearnerProfile.upsert({
      where: { courseId_userId: { courseId: opts.courseId, userId: user.id } },
      create: { courseId: opts.courseId, userId: user.id },
      update: {},
    });

    await ensureLearnerJourney(opts.courseId, user.id);

    const mail = await sendForgeInviteEmail({
      to: email,
      courseTitle: opts.courseTitle,
      inviteToken,
      inviterName: opts.inviterName,
      locale,
    });

    const notify = buildForgeInviteNotification({ courseTitle: opts.courseTitle, locale });
    await createNotification({
      userId: user.id,
      type: 'forge_invite',
      title: notify.title,
      message: notify.message,
      link: mail.inviteUrl,
    });

    return { ok: true, inviteUrl: mail.inviteUrl, emailSent: mail.sent };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error' };
  }
}
