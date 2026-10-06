import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';

/** Admin-only: redirect to a short-lived signed URL for a print batch CSV. */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!(await currentAdmin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const db = createAdminClient();
  const { data: batch } = await db.from('print_batches').select('file_path').eq('id', params.id).maybeSingle();
  if (!batch?.file_path) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { data } = await db.storage.from('print-batches').createSignedUrl(batch.file_path, 300);
  if (!data?.signedUrl) return NextResponse.json({ error: 'unavailable' }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
