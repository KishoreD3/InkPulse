import Link from 'next/link';
import { getCurrentDrop, getDropDesigns, getRetailWinners, getSettings } from '@/lib/data';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadPosts } from '@/lib/feed';
import { isConfigured } from '@/lib/env';
import { artistCut, dropLabel, inr, num } from '@/lib/format';
import { Avatar } from '@/components/PostCard';
import { getOpenTopics, getTopic, topicTitle } from '@/lib/topics';
import { dayTime, daysUntil } from '@/lib/format';
import { DropHero } from '@/components/DropHero';
import { Board } from '@/components/Board';
import { ArtistPanel, HowItWorksStrip } from '@/components/Panels';
import { PostCard } from '@/components/PostCard';
import { ProductCard, SectionHead, TrustStrip } from '@/components/ProductCard';
import { Tee } from '@/components/Tee';
import { colourway, tileFor } from '@/lib/colourway';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!isConfigured()) return <NotConfigured />;
  const [settings, drop, session] = await Promise.all([getSettings(), getCurrentDrop(), getSession()]);
  const designs = drop ? await getDropDesigns(drop.id) : [];
  const supabase = createClient();

  const [votes, winners, feed, voterCount, topic, openTopics] = await Promise.all([
    session && drop
      ? supabase.from('votes').select('design_id').eq('drop_id', drop.id).is('withdrawn_at', null).then((r) => (r.data ?? []).map((v) => v.design_id as string))
      : Promise.resolve([] as string[]),
    getRetailWinners(),
    loadPosts({ limit: 3, userId: session?.user.id }),
    drop ? supabase.rpc('drop_voter_count', { p_drop: drop.id }).then((r) => (typeof r.data === 'number' ? r.data : 0)) : Promise.resolve(0),
    getTopic(drop?.id),
    getOpenTopics(),
  ]);
  const openTopic = openTopics[0];

  const top = designs[0];
  const slotsLocked = designs.slice(0, settings.winners_per_drop).filter((d) => d.vote_count >= settings.backer_threshold).length;

  const catalogue = [...designs, ...winners];
  const byCategory = settings.categories.map((c) => ({ c, d: catalogue.find((x) => x.category === c) })).slice(0, 8);
  const live = drop?.status === 'live';

  return (
    <>
      <section className="bg-yellow overflow-hidden">
        <div className="container-page grid md:grid-cols-2 items-center gap-8 min-h-[440px] md:min-h-[500px] py-10 md:py-0">
          <div className="flex flex-col gap-5 z-10">
            <span className="self-start bg-white rounded px-2.5 py-1.5 text-[11px] font-black tracking-[0.12em]">
              {drop ? `${dropLabel(drop.number)} · ${live ? 'VOTING NOW' : drop.status === 'scheduled' ? 'OPENS MONDAY' : 'VOTING CLOSED'}` : 'NEXT DROP SOON'}
            </span>
            <h1 className="text-[44px] md:text-[64px] font-black uppercase leading-[0.9] tracking-[-0.045em]">
              {drop ? <>The {topicTitle(topic)}<br />battle</> : <>The crowd<br />prints</>}
            </h1>
            <p className="max-w-[470px] text-[16px] leading-relaxed">
              {designs.length > 0 ? `${designs.length} designs. ` : ''}Your votes decide the {settings.winners_per_drop} tees we print on Friday.
              Back a design for {inr(settings.backer_price)} — charged only if it prints. Every tee pays its artist{' '}
              {inr(artistCut(settings.retail_price, settings.gst_pct, settings.artist_pct))}.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#board" className="btn-ink !min-h-[48px] !px-6">{live ? 'Vote now →' : 'See the leaderboard →'}</a>
              <Link href="/shop?view=winners" className="btn-white !min-h-[48px] !px-6 !border-ink">Shop winners</Link>
            </div>
          </div>
          {top ? (
            <Link href={`/d/${top.slug}`} className="relative h-[340px] md:h-[460px] self-end hidden sm:block" aria-label={`${top.name}, currently #1`}>
              <span aria-hidden className="absolute left-6 top-6 w-[340px] h-[340px] md:w-[420px] md:h-[420px] rounded-full bg-ink" />
              <span className="absolute left-16 top-10 md:top-12 w-[300px] md:w-[360px] h-[300px] md:h-[420px] rounded-t-[180px] rounded-b-[14px] overflow-hidden grid place-items-center"
                style={{ backgroundColor: tileFor(top.slug).bg }}>
                <Tee shirt={colourway(top).hex} art={colourway(top).art} size="88%" label={`${top.name} by @${top.artist?.handle}`} />
              </span>
              <b className="absolute left-0 bottom-10 w-[104px] h-[104px] rounded-full bg-white grid place-items-center text-center shadow-[5px_5px_0_#11120F]">
                <span><span className="block text-[25px] font-black leading-none">{inr(settings.backer_price)}</span><span className="block text-[9px] tracking-[0.08em] font-bold pt-1">IF IT PRINTS</span></span>
              </b>
              <span className="absolute right-4 top-6 rounded bg-white px-2.5 py-1.5 text-[11px] font-black">#1 · {top.name}</span>
            </Link>
          ) : null}
        </div>
      </section>

      {byCategory.length > 0 && (
        <nav aria-label="Shop by category" className="container-page pt-8 flex gap-5 md:gap-6 md:justify-center overflow-x-auto no-scrollbar">
          {byCategory.map(({ c, d }) => (
            <Link key={c} href={`/shop?cat=${encodeURIComponent(c)}`} className="flex flex-col items-center gap-2 shrink-0 text-[12px] font-bold">
              <span className="w-[76px] h-[76px] md:w-[88px] md:h-[88px] rounded-full overflow-hidden grid place-items-center border border-line" style={{ backgroundColor: d ? tileFor(d.slug).bg : '#F2F2EE' }}>
                {d ? <Tee shirt={colourway(d).hex} art={colourway(d).art} size="82%" /> : null}
              </span>
              {c}
            </Link>
          ))}
          <Link href="/shop?view=winners" className="flex flex-col items-center gap-2 shrink-0 text-[12px] font-bold">
            <span className="w-[76px] h-[76px] md:w-[88px] md:h-[88px] rounded-full bg-ink text-yellow grid place-items-center text-[11px] font-black">WINNERS</span>
            Printed winners
          </Link>
        </nav>
      )}

      <div id="board" className="container-page pt-12 flex flex-wrap gap-10 items-start scroll-mt-6">
        <div className="flex-[999_1_620px] min-w-0">
          {drop ? (
            <Board
              dropId={drop.id}
              initial={designs}
              voted={votes}
              signedIn={Boolean(session)}
              votingOpen={live && new Date(drop.locks_at) > new Date()}
              threshold={settings.backer_threshold}
              backerPrice={settings.backer_price}
              winners={settings.winners_per_drop}
              categories={settings.categories}
            />
          ) : (
            <p className="card-flat p-6">The first drop has not been scheduled yet.</p>
          )}
        </div>

        <aside className="flex-[1_1_320px] min-w-0 flex flex-col gap-5">
          {drop ? <DropHero drop={drop} settings={settings} voters={voterCount} slotsLocked={slotsLocked} topic={topicTitle(topic)} /> : null}
          {openTopic && (
            <section className="rounded-[14px] bg-yellow p-5 flex flex-col gap-2.5">
              <span className="eyebrow !text-ink">ARTISTS · OPEN TOPIC · DROP {String(openTopic.number).padStart(3, '0')}</span>
              <p className="text-[28px] font-black tracking-[-0.03em] leading-none">{topicTitle(openTopic.topic)}</p>
              {openTopic.topic?.brief && <p className="text-[13px] line-clamp-3">{openTopic.topic.brief}</p>}
              <p className="text-[12px] font-bold">
                Submissions close {dayTime(openTopic.submissions_close_at)} IST{daysUntil(openTopic.submissions_close_at) > 1 ? ` · ${daysUntil(openTopic.submissions_close_at)} days left` : ' · last day'}
              </p>
              <Link href="/topics" className="btn-ink self-start !min-h-[38px]">See the brief &amp; submit →</Link>
            </section>
          )}
          <section className="card p-5 flex flex-col gap-3.5">
            <div className="flex justify-between items-baseline">
              <h2 className="text-[20px] font-extrabold tracking-[-0.02em]">The Pulse</h2>
              <Link href="/pulse" className="text-[12px] font-extrabold hover:underline">Open feed →</Link>
            </div>
            {feed.posts.map((p) => (
              <PostCard key={p.id} post={p} liked={feed.liked.has(p.id)} reposted={feed.reposted.has(p.id)} userId={session?.user.id ?? null} />
            ))}
          </section>
        </aside>
      </div>

      {winners.length > 0 && (
        <section className="container-page pt-16">
          <SectionHead eyebrow="CHOSEN BY THE COMMUNITY" title="New winners" href="/shop?view=winners" action="Shop all" />
          <div className="grid grid-flow-col auto-cols-[200px] md:auto-cols-[248px] gap-4 overflow-x-auto no-scrollbar pb-1">
            {winners.map((w) => (
              <ProductCard key={w.id} d={w} price={settings.retail_price} badge={w.final_rank ? `WINNER · #${w.final_rank}` : 'WINNER'} />
            ))}
          </div>
        </section>
      )}

      <div className="pt-16"><HowItWorksStrip backerPrice={settings.backer_price} retailPrice={settings.retail_price} winners={settings.winners_per_drop} artistPct={settings.artist_pct} /></div>

      <ArtistsPaid artistPct={settings.artist_pct} />
      <ArtistPanel artistPct={settings.artist_pct} />
      <div className="pt-14"><TrustStrip /></div>
    </>
  );
}

async function ArtistsPaid({ artistPct }: { artistPct: number }) {
  const supabase = createClient();
  const [{ data: totals }, { data: top }] = await Promise.all([supabase.rpc('artist_totals'), supabase.rpc('top_artists', { p_limit: 6 })]);
  const t = (totals as { earned: number; artists_printed: number; tees_sold: number }[] | null)?.[0];
  const artists = (top ?? []) as { id: string; handle: string; name: string | null; avatar_url: string | null; printed: number; tees_sold: number }[];
  if (!t || (t.earned === 0 && artists.length === 0)) return null;
  return (
    <section className="container-page pt-16">
      <div className="flex flex-wrap gap-10 items-start">
        <div className="flex-[1_1_320px] flex flex-col gap-3.5">
          <p className="eyebrow">THE PEOPLE BEHIND THE PRINT</p>
          <h2 className="text-[34px] md:text-[44px] font-black tracking-[-0.04em] leading-[0.95]">Artists, paid.</h2>
          <p className="text-[15px] text-body leading-relaxed">{artistPct}% of every tee goes to the person who drew it. Not a contest prize — a cut of every sale, for as long as it sells.</p>
          <div className="flex gap-3 pt-1">
            <div className="bg-yellow rounded-xl px-4 py-3"><p className="text-[26px] font-black leading-none">{inr(t.earned)}</p><p className="eyebrow !text-ink pt-1">earned by artists</p></div>
            <div className="bg-cream rounded-xl px-4 py-3"><p className="text-[26px] font-black leading-none">{num(t.tees_sold)}</p><p className="eyebrow pt-1">tees sold</p></div>
          </div>
          <Link href="/artists" className="text-[13px] font-extrabold hover:underline">Meet the artists →</Link>
        </div>
        {artists.length > 0 && (
          <ol className="flex-[2_1_480px] min-w-0 grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {artists.map((a) => (
              <li key={a.id}>
                <Link href={`/a/${a.handle}`} className="card p-4 flex items-center gap-3 hover:border-strong">
                  <Avatar handle={a.handle} url={a.avatar_url} size={48} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold truncate">@{a.handle}</span>
                    <span className="block text-[12px] text-muted">{a.printed} printed · {num(a.tees_sold)} tees</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function NotConfigured() {
  return (
    <div className="container-page py-16 max-w-2xl">
      <h1 className="text-5xl font-black tracking-[-0.04em]">Almost there</h1>
      <p className="pt-4 text-lg">Connect Supabase to see the live drop. Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and keys, run the migrations, then restart <code>npm run dev</code>.</p>
    </div>
  );
}
