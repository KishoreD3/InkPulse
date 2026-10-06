import { requireArtist } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data';
import { SubmitWizard } from './SubmitWizard';
import type { Design } from '@/lib/types';

export const metadata = { title: 'Submit a design' };
export const dynamic = 'force-dynamic';

export default async function SubmitPage({ searchParams }: { searchParams: { edit?: string } }) {
  const session = await requireArtist('/submit');
  const settings = await getSettings();
  let existing: Design | null = null;
  if (searchParams.edit) {
    const { data } = await createClient().from('designs').select('*').eq('id', searchParams.edit)
      .eq('artist_id', session.user.id).in('status', ['draft', 'changes_requested']).maybeSingle();
    existing = (data as Design) ?? null;
  }
  return (
    <div className="container-page py-6 max-w-3xl">
      <h1 className="h-display text-[44px] misprint">{existing ? 'Edit design' : 'Submit a design'}</h1>
      {existing?.review_note && <p className="mt-3 bg-acid border-2 border-ink rounded-xl p-3"><strong>Reviewer note:</strong> {existing.review_note}</p>}
      <SubmitWizard userId={session.user.id} categories={settings.categories} existing={existing} />
    </div>
  );
}
