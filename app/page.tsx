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
import { Tee, colourway, tileFor } from '@/components/Tee';

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

  return (
    <>
      <section className="container-page pt-6 md:pt-14 pb-10 flex flex-wrap gap-8 md:gap-12 items-center">
        <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5">
          <span className="self-start -rotate-3 sticker bg-acid !text-[13px]">
            {drop ? `${dropLabel(drop.number)} ${drop.status === 'live' ? 'IS LIVE' : drop.status === 'scheduled' ? 'OPENS MONDAY' : 'IS LOCKED'}` : 'NEXT DROP SOON'}
          </span>
          <h1 className="h-display text-[clamp(56px,9vw,136px)] leading-[0.88] misprint">The crowd<br />prints.</h1>
          {drop && (
            <p className="font-display text-[clamp(22px,3vw,32px)] uppercase leading-none">
              This week&apos;s topic: <span className="highlight">{topicTitle(topic)}</span>
            </p>
          )}
          <p className="max-w-[540px] text-lg leading-relaxed text-body">
            Every Monday a new topic goes out and independent artists answer it. Two weeks later their designs face the vote — you vote till Thursday. The top {settings.winners_per_drop} hit the press on Friday.
            Back early at {inr(settings.backer_price)} with UPI AutoPay — debited only if it prints. Every tee pays the artist who drew it
            ({inr(artistCut(settings.retail_price, settings.gst_pct, settings.artist_pct))} on a {inr(settings.retail_price)} tee).
          </p>
          <div className="flex flex-wrap gap-3.5">
            <a href="#board" className="btn-pink !min-h-[58px] !px-7 !text-[22px]">Start voting</a>
            <Link href="/submit" className="btn-white !min-h-[58px] !px-7 !text-[22px]">Drop a design</Link>
          </div>
        </div>
        <div className="flex-[1_1_380px] min-w-0 flex flex-col gap-4">
          {drop ? <DropHero drop={drop} settings={settings} voters={voterCount} slotsLocked={slotsLocked} topic={topicTitle(topic)} /> : null}
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

      <HowItWorksStrip backerPrice={settings.backer_price} retailPrice={settings.retail_price} winners={settings.winners_per_drop} artistPct={settings.artist_pct} />

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
          <div className="md:hidden pt-6"><ArtistPanel compact artistPct={settings.artist_pct} /></div>
        </div>

        <aside className="flex-[1_1_320px] min-w-0 flex flex-col gap-6">
          {openTopic && (
            <section className="bg-acid border-2 border-ink rounded-[22px] shadow-hard p-5 flex flex-col gap-2.5">
              <span className="self-start -rotate-3 bg-ink text-acid px-2 py-0.5 rounded font-display text-[13px] tracking-wider">
                ARTISTS · OPEN TOPIC · DROP {String(openTopic.number).padStart(3, '0')}
              </span>
              <p className="font-display text-[38px] leading-[0.92] uppercase">{topicTitle(openTopic.topic)}</p>
              {openTopic.topic?.brief && <p className="text-sm line-clamp-3">{openTopic.topic.brief}</p>}
              <p className="text-sm font-bold">
                Submissions close {dayTime(openTopic.submissions_close_at)} IST{daysUntil(openTopic.submissions_close_at) > 1 ? ` · ${daysUntil(openTopic.submissions_close_at)} days left` : ' · last day'}
              </p>
              <Link href="/topics" className="btn-ink self-start">See the brief &amp; submit</Link>
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

      <ArtistsPaid artistPct={settings.artist_pct} />
      <div className="hidden md:block"><ArtistPanel artistPct={settings.artist_pct} /></div>
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
    <section className="border-t-2 border-ink">
      <div className="container-page py-14 flex flex-wrap gap-10 items-start">
        <div className="flex-[1_1_320px] flex flex-col gap-3.5">
          <h2 className="h-display text-[56px] leading-[0.9] misprint-blue">Artists,<br />paid.</h2>
          <p className="text-[17px] text-body">{artistPct}% of every tee goes to the person who drew it. Not a contest prize — a cut of every sale, for as long as it sells.</p>
          <div className="flex gap-3 pt-1">
            <div className="bg-acid border-2 border-ink rounded-xl px-4 py-2 shadow-hard-sm"><p className="font-display text-3xl leading-none">{inr(t.earned)}</p><p className="label-mono">earned by artists</p></div>
            <div className="bg-card border-2 border-ink rounded-xl px-4 py-2 shadow-hard-sm"><p className="font-display text-3xl leading-none">{num(t.tees_sold)}</p><p className="label-mono">tees sold</p></div>
          </div>
          <Link href="/artists" className="font-bold underline">Meet the artists</Link>
        </div>
        {artists.length > 0 && (
          <ol className="flex-[2_1_480px] min-w-0 grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {artists.map((a) => (
              <li key={a.id}>
                <Link href={`/a/${a.handle}`} className="card p-4 flex items-center gap-3 shadow-hard-sm">
                  <Avatar handle={a.handle} url={a.avatar_url} size={48} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold truncate">@{a.handle}</span>
                    <span className="block label-mono text-muted">{a.printed} printed · {num(a.tees_sold)} tees</span>
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
      <h1 className="h-display text-6xl misprint">Almost there</h1>
      <p className="pt-4 text-lg">Connect Supabase to see the live drop. Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and keys, run the migrations, then restart <code>npm run dev</code>.</p>
    </div>
  );
}
