export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/web-push';

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) {
    return NextResponse.json({ enabled: false, publicKey: null });
  }
  return NextResponse.json({ enabled: true, publicKey: key });
}
