export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

// GET: list channels for user's companies
export async function GET(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    const where: any = {
      companyId: companyId && tenant.companyIds.includes(companyId) ? companyId : { in: tenant.companyIds },
      isActive: true,
      // For private channels, only show if user is a member
      OR: [
        { type: 'public' },
        { members: { some: { userId: tenant.userId } } },
      ],
    };

    const channels = await prisma.chatChannel.findMany({
      where,
      include: {
        company: { select: { name: true, shortName: true, color: true } },
        members: {
          select: { userId: true, lastRead: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Compute unread & membership
    const result = channels.map(ch => {
      const membership = ch.members.find(m => m.userId === tenant.userId);
      const lastRead = membership?.lastRead || new Date(0);
      return {
        ...ch,
        isMember: !!membership,
        lastReadAt: lastRead,
      };
    });

    return NextResponse.json({ channels: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: create channel (with optional memberIds)
export async function POST(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    if (!body.companyId || !tenant.companyIds.includes(body.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build member create list (always include creator)
    const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds : [];
    if (!memberIds.includes(tenant.userId)) memberIds.push(tenant.userId);
    const uniqueIds = [...new Set(memberIds)];

    const channel = await prisma.chatChannel.create({
      data: {
        companyId: body.companyId,
        name: body.name || 'General',
        description: body.description || null,
        type: body.type || 'public',
        createdBy: tenant.userId,
        members: {
          create: uniqueIds.map(uid => ({ userId: uid })),
        },
      },
      include: {
        company: { select: { name: true, shortName: true, color: true } },
        members: {
          select: { userId: true, lastRead: true },
        },
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json({ channel });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT: update channel, join, markRead, addMembers, removeMembers
export async function PUT(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();

    // Action: join channel
    if (body.action === 'join') {
      const ch = await prisma.chatChannel.findUnique({ where: { id: body.channelId } });
      if (!ch || !tenant.companyIds.includes(ch.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      if (ch.type === 'private') return NextResponse.json({ error: 'Cannot join private channel directly' }, { status: 403 });
      await prisma.chatChannelMember.upsert({
        where: { channelId_userId: { channelId: body.channelId, userId: tenant.userId } },
        update: {},
        create: { channelId: body.channelId, userId: tenant.userId },
      });
      return NextResponse.json({ success: true });
    }

    // Action: mark read
    if (body.action === 'markRead') {
      await prisma.chatChannelMember.updateMany({
        where: { channelId: body.channelId, userId: tenant.userId },
        data: { lastRead: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    // Action: add members
    if (body.action === 'addMembers') {
      const ch = await prisma.chatChannel.findUnique({ where: { id: body.channelId } });
      if (!ch || !tenant.companyIds.includes(ch.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const userIds: string[] = body.userIds || [];
      for (const uid of userIds) {
        await prisma.chatChannelMember.upsert({
          where: { channelId_userId: { channelId: body.channelId, userId: uid } },
          update: {},
          create: { channelId: body.channelId, userId: uid },
        });
      }
      return NextResponse.json({ success: true });
    }

    // Action: remove member
    if (body.action === 'removeMember') {
      const ch = await prisma.chatChannel.findUnique({ where: { id: body.channelId } });
      if (!ch || !tenant.companyIds.includes(ch.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      await prisma.chatChannelMember.deleteMany({
        where: { channelId: body.channelId, userId: body.userId },
      });
      return NextResponse.json({ success: true });
    }

    // Action: update channel metadata
    if (body.action === 'updateChannel') {
      const existing = await prisma.chatChannel.findUnique({ where: { id: body.channelId } });
      if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const updated = await prisma.chatChannel.update({
        where: { id: body.channelId },
        data: {
          name: body.name ?? existing.name,
          description: body.description !== undefined ? body.description : existing.description,
        },
        include: {
          company: { select: { name: true, shortName: true, color: true } },
          members: { select: { userId: true, lastRead: true } },
          _count: { select: { messages: true } },
        },
      });
      return NextResponse.json({ channel: { ...updated, isMember: true, lastReadAt: new Date() } });
    }

    // Legacy: update by id (backward compat)
    const existing = await prisma.chatChannel.findUnique({ where: { id: body.id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const updated = await prisma.chatChannel.update({
      where: { id: body.id },
      data: { name: body.name ?? existing.name, description: body.description !== undefined ? body.description : existing.description },
    });
    return NextResponse.json({ channel: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE: soft-delete channel
export async function DELETE(req: NextRequest) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const existing = await prisma.chatChannel.findUnique({ where: { id } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await prisma.chatChannel.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
