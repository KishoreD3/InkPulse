import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { signOut, updateProfile } from '@/app/actions/profile';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { Avatar } from '@/components/PostCard';
import { PhoneVerify } from './PhoneVerify';
import { AddressBook } from '@/components/AddressBook';
import { AppSettings } from './AppSettings';
import type { Address } from '@/lib/types';

export const metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function MePage() {
  const session = await requireSession('/me');
  const supabase = createClient();
  const [{ data: addresses }, { count: votes }, { count: backed }, { count: following }] = await Promise.all([
    supabase.from('addresses').select('*').order('is_default', { ascending: false }),
    supabase.from('votes').select('id', { count: 'exact', head: true }).is('withdrawn_at', null),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('type', 'backing').in('status', ['backed', 'won', 'printing', 'shipped', 'delivered']),
    supabase.from('follows').select('artist_id', { count: 'exact', head: true }).eq('follower_id', session.user.id),
  ]);
  const p = session.profile;

  return (
    <div className="container-page py-8 max-w-3xl flex flex-col gap-8">
      <header className="flex items-center gap-4">
        <Avatar handle={p.handle} url={p.avatar_url} size={72} />
        <div className="flex-1">
          <h1 className="h-display text-[44px] misprint">@{p.handle}</h1>
          <p className="label-mono text-muted">Member since {new Date(p.created_at).getFullYear()}</p>
        </div>
        <form action={signOut}><button className="chip-off">Sign out</button></form>
      </header>

      <div className="grid grid-cols-3 gap-3">
        {[['Votes', votes ?? 0], ['Backed', backed ?? 0], ['Following', following ?? 0]].map(([k, v]) => (
          <div key={k} className="card-flat p-3 text-center"><p className="font-display text-3xl">{v}</p><p className="label-mono">{k}</p></div>
        ))}
      </div>

      <nav className="flex flex-wrap gap-2">
        <Link href="/orders" className="chip-off">My orders</Link>
        <Link href="/notifications" className="chip-off">Notifications</Link>
        {p.is_artist ? <Link href="/studio" className="chip-on">Artist studio</Link> : <Link href="/submit/become-artist" className="chip-off">Become an artist</Link>}
        {p.is_admin && <Link href="/admin" className="chip-on">Admin</Link>}
      </nav>

      <section id="phone" className="card p-5 flex flex-col gap-3 scroll-mt-28">
        <h2 className="h-display text-2xl">Mobile number</h2>
        {session.phoneVerified ? (
          <p className="font-semibold">Verified: +{session.user.phone} <span className="sticker bg-acid ml-2">Can vote</span></p>
        ) : (
          <PhoneVerify />
        )}
      </section>

      <section className="card p-5">
        <h2 className="h-display text-2xl pb-3">Profile</h2>
        <ActionForm action={updateProfile} className="flex flex-col gap-4">
          <Field label="Handle" name="handle" defaultValue={p.handle} required hint="3–24 lowercase letters, numbers or _" />
          <Field label="Name" name="name" defaultValue={p.name} maxLength={60} />
          <Field label="Location" name="location" defaultValue={p.location} maxLength={60} />
          <div>
            <label htmlFor="bio" className="field-label">Bio</label>
            <textarea id="bio" name="bio" className="input py-3 min-h-[96px]" maxLength={280} defaultValue={p.bio ?? ''} />
          </div>
          <Field label="Avatar URL" name="avatar_url" defaultValue={p.avatar_url} type="url" />
          <SubmitButton>Save profile</SubmitButton>
        </ActionForm>
      </section>

      <section className="card p-5">
        <h2 className="h-display text-2xl pb-3">Addresses</h2>
        <AddressBook addresses={(addresses ?? []) as Address[]} />
      </section>

      <section className="card p-5">
        <h2 className="h-display text-2xl pb-3">Alerts &amp; app</h2>
        <AppSettings notify={p.notify} />
      </section>
    </div>
  );
}
