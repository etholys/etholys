export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

// GET: messages for a channel with pagination
export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    if (!channelId) return NextResponse.json({ error: 'Missing channelId' }, { status: 400 });

    // Verify channel access
    const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
    if (!channel || !tenant.companyIds.includes(channel.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cursor = searchParams.get('cursor');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const after = searchParams.get('after'); // for polling: get messages after this timestamp

    const where: any = { channelId, isActive: true };
    if (after) {
      where.createdAt = { gt: new Date(after) };
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: after ? 'asc' : 'desc' },
      take: after ? 200 : limit,
      ...(cursor && !after ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    // If loading history (not polling), reverse to chronological
    const sorted = after ? messages : messages.reverse();

    return NextResponse.json({ messages: sorted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: send message
export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    if (!body.channelId || (!body.content?.trim() && !body.fileUrl)) {
      return NextResponse.json({ error: 'Missing channelId or content' }, { status: 400 });
    }

    // Verify channel access
    const channel = await prisma.chatChannel.findUnique({ where: { id: body.channelId } });
    if (!channel || !tenant.companyIds.includes(channel.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Auto-join if public channel and not member
    if (channel.type === 'public') {
      await prisma.chatChannelMember.upsert({
        where: { channelId_userId: { channelId: body.channelId, userId: tenant.userId } },
        update: {},
        create: { channelId: body.channelId, userId: tenant.userId },
      });
    }

    const message = await prisma.chatMessage.create({
      data: {
        channelId: body.channelId,
        userId: tenant.userId,
        content: (body.content || '').trim(),
        mentions: body.mentions || null,
        fileName: body.fileName || null,
        fileUrl: body.fileUrl || null,
        fileSize: body.fileSize ? parseInt(body.fileSize) : null,
        fileType: body.fileType || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    // Update channel updatedAt
    await prisma.chatChannel.update({ where: { id: body.channelId }, data: { updatedAt: new Date() } });

    // Update sender's lastRead
    await prisma.chatChannelMember.updateMany({
      where: { channelId: body.channelId, userId: tenant.userId },
      data: { lastRead: new Date() },
    });

    return NextResponse.json({ message });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT: edit message
export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const existing = await prisma.chatMessage.findUnique({ where: { id: body.id } });
    if (!existing || existing.userId !== tenant.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const updated = await prisma.chatMessage.update({
      where: { id: body.id },
      data: { content: body.content.trim(), isEdited: true },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });
    return NextResponse.json({ message: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: soft-delete message
export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const existing = await prisma.chatMessage.findUnique({ where: { id } });
    if (!existing || existing.userId !== tenant.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await prisma.chatMessage.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
