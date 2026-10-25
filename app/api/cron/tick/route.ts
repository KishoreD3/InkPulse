import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { CATALOG_TAG } from '@/lib/dnd/load';
import { cronAuthorized } from '@/lib/cron';
import { tick } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const log = await tick();
    revalidateTag(CATALOG_TAG); // drops may have opened or locked: the store reads them fresh
    return NextResponse.json({ ok: true, ...log });
  } catch (e) {
    console.error('tick failed', e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
