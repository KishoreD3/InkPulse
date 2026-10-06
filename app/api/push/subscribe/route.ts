import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) }),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad subscription.' }, { status: 400 });
  const supabase = createClient();
  await supabase.from('push_subscriptions').delete().eq('endpoint', parsed.data.endpoint);
  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: session.user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth,
  });
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
