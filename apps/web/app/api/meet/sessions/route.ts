export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { createMeetSession, listMeetSessions } from '@/lib/meet/create-session';
import { isMeetMirror } from '@/lib/meet/types';
import { sendMeetInviteEmail } from '@/lib/meet/send-meet-email';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId')?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const limit = Number(searchParams.get('limit') || '30');
    const projectId = searchParams.get('projectId')?.trim() || undefined;
    const sessions = await listMeetSessions(companyId, {
      limit: Number.isFinite(limit) ? limit : 30,
      projectId,
    });
    return NextResponse.json({ sessions });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/sessions] GET', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      companyId?: string;
      title?: string;
      description?: string;
      mirror?: string;
      scheduledAt?: string;
      endsAt?: string;
      projectId?: string;
      forgeLiveSessionId?: string;
      inviteEmails?: string[];
      sendInvites?: boolean;
      locale?: string;
    };

    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title requerido' }, { status: 400 });
    }

    const session = await createMeetSession({
      companyId,
      createdById: tenant.userId,
      title: body.title,
      description: body.description,
      mirror: body.mirror && isMeetMirror(body.mirror) ? body.mirror : 'loose',
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : new Date(),
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      projectId: body.projectId || null,
      forgeLiveSessionId: body.forgeLiveSessionId || null,
      inviteEmails: body.inviteEmails,
    });

    const inviteResults: { email: string; sent: boolean; error?: string }[] = [];
    if (body.sendInvites && body.inviteEmails?.length && session.meetingUrl) {
      for (const raw of body.inviteEmails) {
        const email = raw.trim().toLowerCase();
        if (!email.includes('@')) continue;
        const r = await sendMeetInviteEmail({
          to: email,
          title: session.title,
          meetingUrl: session.meetingUrl,
          sessionId: session.id,
          scheduledAt: session.scheduledAt,
          endsAt: session.endsAt,
          locale: body.locale,
        });
        inviteResults.push({ email, ...r });
      }
    }

    return NextResponse.json({ session, inviteResults });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/sessions] POST', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
