import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DESIGN_SELECT, getSettings } from '@/lib/data';
import { getSession } from '@/lib/auth';
import { artistCut, dropLabel, inr, timeAgo } from '@/lib/format';
import { BuyBox } from '@/components/BuyBox';
import { Avatar } from '@/components/PostCard';
import { CommentForm } from '@/components/CommentForm';
import { FollowButton } from '@/components/FollowButton';
import { ShareButton } from '@/components/ShareButton';
import { ShareKit } from '@/components/ShareKit';
import { WaitlistButton } from '@/components/WaitlistButton';
import { getTopic, topicTitle } from '@/lib/topics';
import { ReportButton } from '@/components/ReportButton';
import { Tee, colourway, tileFor } from '@/components/Tee';
import type { Comment, DesignWithArtist, Drop, PriceType, Review } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function load(slug: string) {
  const { data } = await createClient().from('designs').select(DESIGN_SELECT).eq('slug', slug).maybeSingle();
  return data as DesignWithArtist | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const d = await load(params.slug);
  if (!d) return { title: 'Design not found' };
  return {
    title: `${d.name} by @${d.artist?.handle}`,
    description: d.story ?? `Vote for ${d.name} on INKPULSE. Only the top 3 get printed.`,
    openGraph: { images: [{ url: `/d/${d.slug}/card`, width: 1200, height: 630, alt: `${d.name} on INKPULSE` }] },
    twitter: { card: 'summary_large_image', images: [`/d/${d.slug}/card`] },
  };
}

export default async function DesignPage({ params }: { params: { slug: string } }) {
  const design = await load(params.slug);
  if (!design) notFound();
  const supabase = createClient();
  const [settings, session] = await Promise.all([getSettings(), getSession()]);

  const [{ data: drop }, { data: quoteRows }, { data: comments }, { data: siblings }] = await Promise.all([
    design.drop_id ? supabase.from('drops').select('*').eq('id', design.drop_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc('price_quote', { p_design: design.id }),
    supabase.from('comments').select('*, author:profiles!comments_author_id_fkey(id, handle, name, avatar_url, is_artist)')
      .eq('design_id', design.id).order('created_at', { ascending: false }).limit(30),
    design.drop_id
      ? supabase.from('designs').select(DESIGN_SELECT).eq('drop_id', design.drop_id).neq('id', design.id)
          .in('status', ['live', 'won', 'lost']).order('vote_count', { ascending: false }).limit(4)
      : Promise.resolve({ data: [] }),
  ]);

  const d = drop as Drop | null;
  const topic = d ? await getTopic(d.id) : null;
  const quote = (quoteRows as { price: number; price_type: PriceType; order_type: 'backing' | 'retail' }[] | null)?.[0] ?? null;
  const votingOpen = design.status === 'live' && d?.status === 'live' && new Date(d.locks_at) > new Date();

  let voted = false;
  let following = false;
  if (session) {
    const [{ count: v }, { count: f }] = await Promise.all([
      supabase.from('votes').select('id', { count: 'exact', head: true }).eq('design_id', design.id).is('withdrawn_at', null),
      supabase.from('follows').select('artist_id', { count: 'exact', head: true }).eq('follower_id', session.user.id).eq('artist_id', design.artist_id),
    ]);
    voted = (v ?? 0) > 0;
    following = (f ?? 0) > 0;
  }

  // Live rank among the drop's designs.
  let rank: number | null = design.final_rank;
  if (votingOpen && design.drop_id) {
    const { count } = await supabase.from('designs').select('id', { count: 'exact', head: true })
      .eq('drop_id', design.drop_id).eq('status', 'live').gt('vote_count', design.vote_count);
    rank = (count ?? 0) + 1;
  }
  const inPrintZone = rank !== null && rank <= settings.winners_per_drop && design.status !== 'lost';
  const finished = design.status === 'lost' || (design.status === 'won' && !quote);
  const [{ data: stats }, { data: summaryRows }, { data: reviewRows }, waitCount, onList] = await Promise.all([
    supabase.rpc('artist_stats', { p_artist: design.artist_id }),
    supabase.rpc('design_review_summary', { p_design: design.id }),
    supabase.from('reviews').select('*, author:profiles!reviews_user_id_fkey(id, handle, name, avatar_url)')
      .eq('design_id', design.id).eq('hidden', false).order('created_at', { ascending: false }).limit(12),
    finished ? supabase.rpc('waitlist_count', { p_design: design.id }).then((r) => (r.data as number) ?? 0) : Promise.resolve(0),
    finished && session
      ? supabase.from('design_waitlist').select('design_id', { count: 'exact', head: true }).eq('design_id', design.id).eq('user_id', session.user.id).then((r) => (r.count ?? 0) > 0)
      : Promise.resolve(false),
  ]);
  const summary = (summaryRows as { reviews: number; avg_rating: number | null; runs_small: number; true_to_size: number; runs_large: number }[] | null)?.[0];
  const reviews = (reviewRows ?? []) as Review[];
  const fitVerdict = summary && summary.reviews > 0
    ? [['Runs small', summary.runs_small], ['True to size', summary.true_to_size], ['Runs large', summary.runs_large]].sort((a, b) => (b[1] as number) - (a[1] as number))[0]
    : null;
  const printed = (stats as { printed: number }[] | null)?.[0]?.printed ?? 0;

  return (
    <div className="container-page pb-16">
      <nav aria-label="Breadcrumb" className="py-4 label-mono text-muted flex gap-2 flex-wrap">
        <Link href="/">{d ? dropLabel(d.number) : 'Designs'}</Link><span>/</span>{d && <><Link href="/topics">{topicTitle(topic)}</Link><span>/</span></>}
        <span className="text-ink">{design.name}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-6">
          <BuyBox
            design={design}
            sizes={settings.sizes}
            quote={quote}
            retailPrice={settings.retail_price}
            threshold={settings.backer_threshold}
            votingOpen={Boolean(votingOpen)}
            voted={voted}
            signedIn={Boolean(session)}
            rankLabel={rank ? `#${rank}` : undefined}
            stamp={design.status === 'won' ? 'PRINTED' : design.status === 'lost' ? 'FINAL' : inPrintZone ? 'PRINT ZONE' : 'IN THE RACE'}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="h-display text-[48px] md:text-[72px] leading-[0.9] misprint">{design.name}</h1>
              <ShareButton title={`Vote for ${design.name} on INKPULSE`} path={`/d/${design.slug}`} />
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/a/${design.artist?.handle}`}><Avatar handle={design.artist?.handle ?? '?'} url={design.artist?.avatar_url} size={44} /></Link>
              <div className="flex-1">
                <Link href={`/a/${design.artist?.handle}`} className="font-bold">@{design.artist?.handle}</Link>
                <p className="label-mono text-muted">{printed} designs printed</p>
              </div>
              {session?.user.id !== design.artist_id && (
                <FollowButton artistId={design.artist_id} initial={following} signedIn={Boolean(session)} />
              )}
            </div>
            <ShareKit slug={design.slug} name={design.name} live={Boolean(votingOpen)}
              kind={session?.user.id === design.artist_id ? 'artist' : voted ? 'voted' : 'design'} />
            {design.status === 'won' && <p className="sticker bg-acid self-start">Printed · finished #{design.final_rank}</p>}
            {design.status === 'lost' && <p className="sticker bg-card self-start">Didn&apos;t make the cut · finished #{design.final_rank}</p>}
            {summary && summary.reviews > 0 && (
              <a href="#reviews" className="text-sm font-bold self-start">
                <span className="text-pink" aria-hidden>★</span> {summary.avg_rating} · {summary.reviews} review{summary.reviews > 1 ? 's' : ''}
                {fitVerdict && (fitVerdict[1] as number) > 0 ? ` · ${fitVerdict[0]}` : ''}
              </a>
            )}
          </div>

          {finished && (
            <WaitlistButton designId={design.id} slug={design.slug} initial={onList} count={waitCount} signedIn={Boolean(session)} />
          )}

          {design.story && (
            <section className="flex flex-col gap-2">
              <h2 className="h-display text-3xl"><span className="highlight">From the artist</span></h2>
              <p className="text-[17px] leading-relaxed text-body">{design.story}</p>
              {design.perk && <p className="font-marker text-lg -rotate-1">Backer perk: {design.perk}</p>}
            </section>
          )}

          {(() => {
            const price = quote?.price ?? settings.retail_price;
            const gst = Math.round(price - price / (1 + settings.gst_pct / 100));
            const artist = artistCut(price, settings.gst_pct, settings.artist_pct);
            const making = settings.unit_cost + settings.shipping_cost;
            const rest = Math.max(price - gst - artist - making, 0);
            const parts = [
              { k: `@${design.artist?.handle} (artist)`, v: artist, cls: 'bg-pink' },
              { k: 'Blank, DTG print, packing, shipping', v: making, cls: 'bg-ink' },
              { k: 'GST', v: gst, cls: 'bg-mist' },
              { k: 'INKPULSE (payments, support, the platform)', v: rest, cls: 'bg-cobalt' },
            ].filter((x) => x.v > 0);
            return (
              <section className="border-2 border-dashed border-ink rounded-[18px] p-4 flex flex-col gap-2.5">
                <h2 className="font-display text-xl tracking-wide">WHERE YOUR {inr(price)} GOES</h2>
                <div className="flex h-5 border-2 border-ink rounded-md overflow-hidden" aria-hidden>
                  {parts.map((x) => <div key={x.k} className={`${x.cls} border-r-2 border-ink last:border-r-0`} style={{ flex: x.v }} />)}
                </div>
                <ul className="text-sm flex flex-col gap-1">
                  {parts.map((x) => (
                    <li key={x.k} className="flex justify-between gap-3"><span className="flex items-center gap-2"><span className={`w-3 h-3 border-2 border-ink rounded-sm ${x.cls}`} aria-hidden />{x.k}</span><strong>{inr(x.v)}</strong></li>
                  ))}
                </ul>
                <p className="text-sm bg-pink border-2 border-ink rounded-xl p-3 font-semibold">
                  @{design.artist?.handle} earns {inr(artist)} on this tee — and on every one after it, including reprints.
                </p>
              </section>
            );
          })()}
        </div>
      </div>

      {reviews.length > 0 && (
        <section id="reviews" className="pt-12 mt-12 border-t-2 border-ink flex flex-col gap-4 scroll-mt-24" aria-labelledby="reviews-title">
          <h2 id="reviews-title" className="h-display text-3xl">
            <span className="highlight">On real people</span>{' '}
            <span className="font-sans text-base font-bold align-middle">★ {summary?.avg_rating} from {summary?.reviews}</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <article key={r.id} className="card p-4 flex flex-col gap-2">
                {r.photo_urls.length > 0 && (
                  <div className="flex gap-2">
                    {r.photo_urls.map((u) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={u} src={u} alt={`Photo by @${r.author?.handle}`} loading="lazy" className="w-full max-w-[33%] aspect-square object-cover border-2 border-ink rounded-lg" />
                    ))}
                  </div>
                )}
                <p aria-label={`${r.rating} out of 5`} className="text-pink text-lg leading-none">{'★'.repeat(r.rating)}<span className="text-mist">{'★'.repeat(5 - r.rating)}</span></p>
                {r.body && <p className="text-[15px] leading-relaxed">{r.body}</p>}
                <p className="label-mono text-muted flex items-center gap-2">
                  @{r.author?.handle} · size {r.size}{r.fit ? ` · ${r.fit === 'true' ? 'true to size' : `runs ${r.fit}`}` : ''} · {timeAgo(r.created_at)}
                  <span className="ml-auto"><ReportButton targetType="review" targetId={r.id} signedIn={Boolean(session)} /></span>
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] pt-12 border-t-2 border-ink mt-12">
        <section className="flex flex-col gap-4" aria-labelledby="comments-title">
          <h2 id="comments-title" className="h-display text-3xl">Comments</h2>
          <CommentForm designId={design.id} signedIn={Boolean(session)} />
          {((comments ?? []) as Comment[]).map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar handle={c.author?.handle ?? '?'} url={c.author?.avatar_url} size={38} />
              <div className="flex-1 text-[15px] leading-relaxed">
                <span className="font-bold">@{c.author?.handle}</span>{' '}
                {c.author_id === design.artist_id && <span className="sticker bg-pink !text-[10px] !py-0">Artist</span>}{' '}
                <span className="font-mono text-[11px] text-muted">{timeAgo(c.created_at)}</span>
                <p>{c.body}</p>
              </div>
              <ReportButton targetType="comment" targetId={c.id} signedIn={Boolean(session)} />
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-3.5">
          <h2 className="h-display text-3xl">{d ? `Also in ${String(d.number).padStart(3, '0')}` : 'More designs'}</h2>
          {((siblings ?? []) as DesignWithArtist[]).map((s) => {
            const c = colourway(s); const t = tileFor(s.slug);
            return (
              <Link key={s.id} href={`/d/${s.slug}`} className="flex items-center gap-3.5 p-2.5 card shadow-hard-sm">
                <span className={`w-[72px] h-[72px] border-2 border-ink rounded-xl grid place-items-center ${t.dark ? 'halftone-dark' : 'halftone-light'}`} style={{ backgroundColor: t.bg }}>
                  <Tee shirt={c.hex} art={c.art} size={68} />
                </span>
                <span className="flex-1"><span className="block font-display text-xl uppercase">{s.name}</span><span className="block font-mono text-[11px] text-muted">@{s.artist?.handle}</span></span>
                <span className="font-display text-lg">{s.vote_count.toLocaleString('en-IN')}</span>
              </Link>
            );
          })}
          <div className="pt-2"><ReportButton targetType="design" targetId={design.id} signedIn={Boolean(session)} /></div>
        </section>
      </div>
    </div>
  );
}
