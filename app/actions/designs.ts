'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { slugify } from '@/lib/format';
import { BLANKS } from '@/lib/blanks';

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'Give it a name').max(60),
  story: z.string().trim().max(500).optional(),
  category: z.string().min(1, 'Pick a category'),
  tags: z.array(z.string().trim().toLowerCase().max(24)).max(8).default([]),
  colours: z.array(z.string()).min(1, 'Pick at least one shirt colour').max(4),
  artFrontUrl: z.string().url('Upload your artwork'),
  artBackUrl: z.string().url().optional().or(z.literal('')),
  perk: z.string().trim().max(140).optional(),
  originality: z.literal(true, { errorMap: () => ({ message: 'Confirm the artwork is your original work' }) }),
  submit: z.boolean(),
});

export type DesignInput = z.input<typeof schema>;

export async function saveDesign(input: DesignInput): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session?.profile.is_artist) return { ok: false, error: 'Turn on artist mode first.' };
  if (session.profile.banned) return { ok: false, error: 'This account cannot submit designs.' };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  // Only allow artwork hosted in our own storage bucket (prevents hot-linking arbitrary URLs).
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
  for (const u of [v.artFrontUrl, v.artBackUrl].filter(Boolean) as string[]) {
    const url = new URL(u);
    if (url.host !== host || !url.pathname.includes(`/artwork/${session.user.id}/`)) return { ok: false, error: 'Upload the artwork through the form.' };
  }

  const colours = v.colours.map((name) => BLANKS.find((b) => b.name === name)).filter(Boolean).map((b) => ({ name: b!.name, hex: b!.hex }));
  const supabase = createClient();

  if (!v.id) {
    const { count } = await supabase.from('designs').select('id', { count: 'exact', head: true })
      .eq('artist_id', session.user.id).in('status', ['in_review', 'changes_requested', 'approved']);
    if ((count ?? 0) >= 6) return { ok: false, error: 'You have 6 designs waiting. Let some go live before submitting more.' };
  }

  const row = {
    name: v.name, story: v.story || null, category: v.category, tags: v.tags, colours,
    art_front_url: v.artFrontUrl, art_back_url: v.artBackUrl || null, perk: v.perk || null,
    originality_confirmed: v.originality, status: v.submit ? 'in_review' : 'draft',
  };

  if (v.id) {
    const { data, error } = await supabase.from('designs').update(row).eq('id', v.id).eq('artist_id', session.user.id).select('slug').maybeSingle();
    if (error || !data) return { ok: false, error: 'This design can no longer be edited.' };
    revalidatePath('/studio');
    return { ok: true, slug: data.slug as string };
  }

  const slug = `${slugify(v.name) || 'design'}-${crypto.randomBytes(2).toString('hex')}`;
  const { error } = await supabase.from('designs').insert({ ...row, slug, artist_id: session.user.id });
  if (error) return { ok: false, error: 'Could not save. Try again.' };
  revalidatePath('/studio');
  return { ok: true, slug };
}

export async function withdrawDesign(id: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: 'Sign in.' };
  const { error } = await createClient().from('designs').update({ status: 'withdrawn' }).eq('id', id).eq('artist_id', session.user.id);
  revalidatePath('/studio');
  return error ? { ok: false as const, error: 'Could not withdraw.' } : { ok: true as const };
}
