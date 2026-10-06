import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/cron';
import { dispatchPending } from '@/lib/notify/dispatch';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await dispatchPending()) });
}
