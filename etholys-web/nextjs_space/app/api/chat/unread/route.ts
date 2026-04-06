export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

// GET: total unread message count across all channels
export async function GET() {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // Get all memberships for user
    const memberships = await prisma.chatChannelMember.findMany({
      where: { userId: tenant.userId },
      select: { channelId: true, lastRead: true },
    });

    if (memberships.length === 0) return NextResponse.json({ unreadCount: 0 });

    // Count unread messages per channel
    let totalUnread = 0;
    for (const m of memberships) {
      const count = await prisma.chatMessage.count({
        where: {
          channelId: m.channelId,
          isActive: true,
          createdAt: { gt: m.lastRead },
          userId: { not: tenant.userId },
        },
      });
      totalUnread += count;
    }

    return NextResponse.json({ unreadCount: totalUnread });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
