import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/cron';
import { tick } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await tick()) });
  } catch (e) {
    console.error('tick failed', e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
