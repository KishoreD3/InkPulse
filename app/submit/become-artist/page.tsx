import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { becomeArtist } from '@/app/actions/profile';
import { ActionForm, SubmitButton } from '@/components/forms';

export const metadata = { title: 'Become an artist' };

export default async function BecomeArtist() {
  const session = await requireSession('/submit/become-artist');
  if (session.profile.is_artist) redirect('/submit');
  return (
    <div className="container-page py-8 max-w-2xl flex flex-col gap-6">
      <h1 className="h-display text-[52px] leading-[0.9] misprint">Your art.<br />Your crowd.<br />Zero risk.</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card p-4"><p className="font-display text-2xl">YOU BRING</p><p className="text-sm text-body pt-1">The design, your Instagram/YouTube audience, and hype during drop week.</p></div>
        <div className="bg-ink text-white border-2 border-ink rounded-2xl p-4"><p className="font-display text-2xl text-acid">WE HANDLE</p><p className="text-sm pt-1">Payments, DTG printing, quality checks, shipping, returns, support and your payouts.</p></div>
      </div>
      <ActionForm action={becomeArtist} className="card p-5 flex flex-col gap-4">
        <label className="flex gap-3 items-start font-semibold">
          <input type="checkbox" name="agree" className="w-6 h-6 mt-0.5 accent-[#FF3EA5]" />
          I have read the <Link href="/legal/artist-terms" className="underline" target="_blank">artist terms</Link>. I will only submit original work.
        </label>
        <SubmitButton>Turn on artist mode</SubmitButton>
      </ActionForm>
    </div>
  );
}
