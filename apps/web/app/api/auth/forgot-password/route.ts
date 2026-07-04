export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildPasswordResetEmailHtml,
  buildPasswordResetUrl,
  newPasswordResetToken,
  sendAuthHtmlEmail,
} from '@/lib/send-auth-email';

/** Solicita redefinição de senha — resposta genérica (não revela se o email existe). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; locale?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    let resetUrl: string | null = null;
    let emailSent = false;

    if (user?.isActive && user.password) {
      const token = newPasswordResetToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.verificationToken.deleteMany({ where: { identifier: email } });
      await prisma.verificationToken.create({
        data: { identifier: email, token, expires },
      });

      resetUrl = buildPasswordResetUrl(token);
      const subject =
        body.locale === 'pt'
          ? 'Redefinir senha — Etholys'
          : body.locale === 'en'
            ? 'Reset password — Etholys'
            : 'Restablecer contraseña — Etholys';

      const result = await sendAuthHtmlEmail({
        to: email,
        subject,
        html: buildPasswordResetEmailHtml({
          name: user.name,
          resetUrl,
          locale: body.locale,
        }),
      });
      emailSent = result.sent;
    }

    return NextResponse.json({
      ok: true,
      message: 'Si el email existe, recibirás instrucciones.',
      /** Só em dev / sem Resend — facilita suporte sem expor em produção com email configurado */
      resetUrl: !emailSent && resetUrl ? resetUrl : undefined,
      emailSent,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
