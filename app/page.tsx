import Link from 'next/link';
import { getCause, getCurrentDrop, getDropDesigns, getRetailWinners, getSettings } from '@/lib/data';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadPosts } from '@/lib/feed';
import { isConfigured } from '@/lib/env';
import { dropLabel, inr } from '@/lib/format';
import { DropHero } from '@/components/DropHero';
import { Board } from '@/components/Board';
import { ArtistPanel, HowItWorksStrip } from '@/components/Panels';
import { PostCard } from '@/components/PostCard';
import { Tee, colourway, tileFor } from '@/components/Tee';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!isConfigured()) return <NotConfigured />;
  const [settings, drop, session] = await Promise.all([getSettings(), getCurrentDrop(), getSession()]);
  const designs = drop ? await getDropDesigns(drop.id) : [];
  const supabase = createClient();

  const [votes, cause, winners, feed, voterCount] = await Promise.all([
    session && drop
      ? supabase.from('votes').select('design_id').eq('drop_id', drop.id).is('withdrawn_at', null).then((r) => (r.data ?? []).map((v) => v.design_id as string))
      : Promise.resolve([] as string[]),
    getCause(drop?.cause_id ?? null),
    getRetailWinners(),
    loadPosts({ limit: 3, userId: session?.user.id }),
    drop ? supabase.rpc('drop_voter_count', { p_drop: drop.id }).then((r) => (typeof r.data === 'number' ? r.data : 0)) : Promise.resolve(0),
  ]);

  const top = designs[0];
  const slotsLocked = designs.slice(0, settings.winners_per_drop).filter((d) => d.vote_count >= settings.backer_threshold).length;

  return (
    <>
      <section className="container-page pt-6 md:pt-14 pb-10 flex flex-wrap gap-8 md:gap-12 items-center">
        <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5">
          <span className="self-start -rotate-3 sticker bg-acid !text-[13px]">
            {drop ? `${dropLabel(drop.number)} ${drop.status === 'live' ? 'IS LIVE' : drop.status === 'scheduled' ? 'OPENS MONDAY' : 'IS LOCKED'}` : 'NEXT DROP SOON'}
          </span>
          <h1 className="h-display text-[clamp(56px,9vw,136px)] leading-[0.88] misprint">The crowd<br />prints.</h1>
          <p className="max-w-[540px] text-lg leading-relaxed text-body">
            Independent artists drop graphics every Monday. You vote till Thursday. The top {settings.winners_per_drop} hit the press on Friday.
            Back early at {inr(settings.backer_price)} with UPI AutoPay — debited only if it prints — and 15% of our profit funds a cause you pick.
          </p>
          <div className="flex flex-wrap gap-3.5">
            <a href="#board" className="btn-pink !min-h-[58px] !px-7 !text-[22px]">Start voting</a>
            <Link href="/submit" className="btn-white !min-h-[58px] !px-7 !text-[22px]">Drop a design</Link>
          </div>
        </div>
        <div className="flex-[1_1_380px] min-w-0 flex flex-col gap-4">
          {drop ? <DropHero drop={drop} settings={settings} voters={voterCount} slotsLocked={slotsLocked} /> : null}
          {top && drop?.status === 'live' && (
            <Link href={`/d/${top.slug}`} className="relative h-[260px] border-2 border-ink rounded-[18px] bg-pink halftone-light grid place-items-center shadow-hard">
              <Tee shirt={colourway(top).hex} art={colourway(top).art} size={230} label={`${top.name} by @${top.artist?.handle}`} />
              <span className="absolute top-3 left-3 w-[74px] h-[74px] rounded-full bg-acid border-2 border-ink -rotate-[10deg] grid place-items-center text-center font-display leading-none">
                <span><span className="block text-[26px]">#1</span><span className="block text-[10px] tracking-wider">RIGHT NOW</span></span>
              </span>
              <span className="absolute bottom-3 right-3 -rotate-[4deg] bg-card border-2 border-ink px-2.5 py-1 rounded-md font-marker text-sm">{top.name} · @{top.artist?.handle}</span>
            </Link>
          )}
        </div>
      </section>

      <HowItWorksStrip backerPrice={settings.backer_price} retailPrice={settings.retail_price} winners={settings.winners_per_drop} />

      <div id="board" className="container-page py-12 flex flex-wrap gap-10 items-start scroll-mt-28">
        <div className="flex-[999_1_600px] min-w-0">
          {drop ? (
            <Board
              dropId={drop.id}
              initial={designs}
              voted={votes}
              signedIn={Boolean(session)}
              votingOpen={drop.status === 'live' && new Date(drop.locks_at) > new Date()}
              threshold={settings.backer_threshold}
              backerPrice={settings.backer_price}
              winners={settings.winners_per_drop}
              categories={settings.categories}
            />
          ) : (
            <p className="card p-6">The first drop has not been scheduled yet.</p>
          )}
          <div className="md:hidden pt-6"><ArtistPanel compact /></div>
        </div>

        <aside className="flex-[1_1_320px] min-w-0 flex flex-col gap-6">
          {cause && (
            <section className="bg-cobalt halftone-dark text-white border-2 border-ink rounded-[22px] shadow-hard p-5 flex flex-col gap-2.5">
              <span className="self-start -rotate-3 bg-acid text-ink border-2 border-ink px-2 py-0.5 rounded font-display text-[13px] tracking-wider">THIS DROP’S CAUSE</span>
              <p className="font-display text-[34px] leading-[0.95] uppercase">{cause.name}</p>
              <p className="text-sm text-cobalt-soft">With {cause.partner?.name ?? 'our partner'} · 15% of net profit</p>
              <Link href="/causes" className="text-white font-bold text-sm underline">Vote for the next cause</Link>
            </section>
          )}

          <section className="card p-5 flex flex-col gap-3.5">
            <div className="flex justify-between items-baseline">
              <h2 className="h-display text-[28px] [text-shadow:2px_2px_0_#FF3EA5]">The Pulse</h2>
              <Link href="/pulse" className="text-sm font-bold underline">Open feed</Link>
            </div>
            {feed.posts.map((p) => (
              <PostCard key={p.id} post={p} liked={feed.liked.has(p.id)} reposted={feed.reposted.has(p.id)} userId={session?.user.id ?? null} />
            ))}
          </section>

          {winners.length > 0 && (
            <section className="card p-5 flex flex-col gap-3">
              <h2 className="h-display text-[28px]">Printed &amp; buyable</h2>
              {winners.map((w) => {
                const c = colourway(w); const t = tileFor(w.slug);
                return (
                  <Link key={w.id} href={`/d/${w.slug}`} className="flex items-center gap-3 p-2 border-2 border-ink rounded-xl">
                    <span className={`w-16 h-16 border-2 border-ink rounded-[10px] grid place-items-center ${t.dark ? 'halftone-dark' : 'halftone-light'}`} style={{ backgroundColor: t.bg }}>
                      <Tee shirt={c.hex} art={c.art} size={60} />
                    </span>
                    <span className="flex-1"><span className="block font-display text-lg uppercase">{w.name}</span><span className="block font-mono text-[11px] text-muted">@{w.artist?.handle}</span></span>
                    <span className="font-display text-lg">{inr(settings.retail_price)}</span>
                  </Link>
                );
              })}
            </section>
          )}
        </aside>
      </div>

      <div className="hidden md:block"><ArtistPanel /></div>
      <Receipts />
    </>
  );
}

async function Receipts() {
  const { data } = await createClient().from('cause_payouts')
    .select('amount, paid_at, receipt_url, utr, drop:drops(number), cause:causes(name)')
    .eq('published', true).order('paid_at', { ascending: false }).limit(5);
  const rows = (data ?? []) as unknown as { amount: number; receipt_url: string | null; utr: string | null; drop: { number: number } | null; cause: { name: string } | null }[];
  if (rows.length === 0) return null;
  return (
    <section className="border-t-2 border-ink">
      <div className="container-page py-14 flex flex-wrap gap-10 items-start">
        <div className="flex-[1_1_320px] flex flex-col gap-3.5">
          <h2 className="h-display text-[56px] leading-[0.9] misprint-blue">The<br />receipts.</h2>
          <p className="text-[17px] text-body">Every rupee pledged to a cause is listed with its bank transfer reference. No “up to”, no estimates.</p>
          <Link href="/causes" className="font-bold underline">Full impact ledger</Link>
        </div>
        <div className="flex-[2_1_480px] min-w-0 overflow-x-auto bg-card border-2 border-ink rounded-md shadow-hard-lg">
          <table className="w-full min-w-[520px] font-mono text-sm">
            <thead><tr className="bg-ink text-acid text-left"><th className="p-4">DROP</th><th className="p-4">CAUSE</th><th className="p-4">PAID OUT</th><th className="p-4">PROOF</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t-2 border-dashed border-ink">
                  <td className="p-4 font-bold">D{r.drop?.number}</td>
                  <td className="p-4 font-sans font-semibold">{r.cause?.name}</td>
                  <td className="p-4">{inr(r.amount)}</td>
                  <td className="p-4">{r.receipt_url ? <a className="text-cobalt font-bold underline" href={r.receipt_url}>RECEIPT</a> : <span className="text-muted">UTR {r.utr ?? '—'}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function NotConfigured() {
  return (
    <div className="container-page py-16 max-w-2xl">
      <h1 className="h-display text-6xl misprint">Almost there</h1>
      <p className="pt-4 text-lg">Connect Supabase to see the live drop. Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and keys, run the migrations, then restart <code>npm run dev</code>.</p>
    </div>
  );
}
