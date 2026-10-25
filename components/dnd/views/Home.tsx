'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { img, inr, moods, reviews } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { dh, shortDate } from '@/lib/dnd/cycle';
import { useNow, useStore } from '@/lib/dnd/store';
import { FinalistCard, ProductCard, Trust, fans } from '../cards';
import { Btn, CareTag, Countdown, Icon, Photo, SectionHead } from '../ui';

export function HomeView() {
  const { board: rank, mode } = useStore();
  const { winners, finalists, artists, battle, openTopic, prices } = useCatalog();
  const now = useNow(30_000);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const board = rank(now);
  const leader = board[0];
  const fresh = winners[0];
  const drop = (n: number) => String(n).padStart(3, '0');
  const featured = [...artists].sort((a, b) => b.wins - a.wins || b.followers - a.followers)[0];
  const first = featured?.name.split(' ')[0] ?? '';

  const slides = [
    leader
      ? { tag: `DROP ${drop(battle.drop)} · VOTING NOW`, title: <>Do not<br />disturb.<br /><em>We’re voting.</em></>, copy: `${finalists.length} designs, 4 days. The crowd picks ${battle.winners} to print on Friday. Back your favourite at ${inr(prices.back)}, pay only if it wins.`, cta: 'Enter the battle', href: '/battle', img: leader.card, caption: `currently #1 · ${leader.name}`, link: `/design/${leader.id}` }
      : { tag: battle.drop ? `DROP ${drop(battle.drop)} · NEXT BATTLE` : 'NEXT BATTLE', title: <>Do not<br />disturb.<br /><em>Voting soon.</em></>, copy: `The next battle opens ${battle.drop ? shortDate(battle.opensAt) : 'Monday'} at 10 AM. The crowd picks ${battle.winners} to print.`, cta: 'How it works', href: '/topics', img: img.hero, caption: 'finalists announced Monday', link: '/topics' },
    ...(fresh ? [{ tag: 'FRESH OFF THE PRESS', title: <>Dressed,<br />not<br /><em>disturbed.</em></>, copy: 'Crowd-picked graphic tees by independent Indian artists. Printed only when you order.', cta: 'Shop new drops', href: '/shop?collection=new', img: fresh.photos[0], caption: `${fresh.name} · ${inr(prices.retail)}`, link: `/design/${fresh.id}` }] : []),
    { tag: openTopic ? `DROP ${drop(openTopic.drop)} · ARTISTS WANTED` : 'ARTISTS WANTED', title: <>Your art.<br />Our tee.<br /><em>Their wardrobe.</em></>, copy: `${openTopic ? `Topic: “${openTopic.title}”. ${openTopic.maxEntries} entries each. ` : ''}${prices.artistPct}% of every sale is yours, forever.`, cta: 'Submit your art', href: '/studio', img: img.hero, caption: 'your design could be here', link: '/studio' },
  ];
  const s = slides[slide];

  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => setSlide((x) => (x + 1) % slides.length), 8000);
    return () => window.clearTimeout(t);
  }, [slide, paused, slides.length]);

  return (
    <>
      <section className={`hero hero-${slide}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel">
        <div className="page-width hero-grid">
          <div className="hero-copy">
            <span className="sticker white">{s.tag}</span>
            <h1>{s.title}</h1>
            <p>{s.copy}</p>
            <div className="row"><Btn v="dark" href={s.href}>{s.cta} <Icon name="arrow" /></Btn><Btn v="ghost" href="/shop">Browse all tees</Btn></div>
          </div>
          <div className="hero-art">
            <Link href={s.link} className="hanger big">
              <span className="hole" />
              <b>PLEASE</b>
              <strong>DO NOT DISTURB</strong>
              <Photo src={s.img} alt="Featured tee" className="hanger-photo" eager />
              <small>{s.caption}</small>
            </Link>
            <span className="burst">{inr(prices.back)}<small>IF IT PRINTS</small></span>
            <CareTag text="DO NOT DRY-CLEAN" tilt={8} />
          </div>
        </div>
        <div className="hero-controls">
          <button aria-label="Previous slide" onClick={() => setSlide((slide + slides.length - 1) % slides.length)}>←</button>
          {slides.map((_, i) => <button key={i} aria-label={`Slide ${i + 1}`} aria-current={i === slide} className={`dot ${i === slide ? 'on' : ''}`} onClick={() => setSlide(i)} />)}
          <button aria-label="Next slide" onClick={() => setSlide((slide + 1) % slides.length)}>→</button>
        </div>
      </section>

      <section className="page-width moods" aria-label="Shop by mood">
        {moods.map((m) => (
          // eslint-disable-next-line @next/next/no-img-element
          <Link key={m.slug} href={`/shop?mood=${m.slug}`}><span className="mood-icon"><img src={img.mood(m.slug)} alt="" /></span>{m.name}</Link>
        ))}
      </section>

      {leader && (
        <section className="page-width">
          <div className="battle-strip">
            <div className="bs-head">
              <div><span className="live-label"><i className="live-dot" /> DO NOT DISTURB · BATTLE IN PROGRESS</span><h2>{battle.topic}</h2><p>Top {battle.winners} by votes print Friday. Vote free, or back for {inr(prices.back)}.</p></div>
              <div className="big-timer"><small>VOTING CLOSES IN</small><Countdown /></div>
            </div>
            <div className="rail">{board.slice(0, 4).map((f) => <FinalistCard key={f.id} s={f} leader={leader.live} dark />)}</div>
            <Link className="link light" href="/battle">See all {finalists.length} finalists <Icon name="arrow" size={16} /></Link>
          </div>
        </section>
      )}

      {winners.length > 0 && <section className="page-width section">
        <SectionHead eyebrow="CROWD-PICKED · FRESHLY PRINTED" title={<>Do not <span className="hl">miss</span>.</>} action="Shop all" href="/shop" />
        <div className="rail products">{winners.slice(0, 5).map((p, i) => <ProductCard key={p.id} p={p} tilt={i === 1 ? -4 : i === 3 ? 3 : 0} />)}</div>
      </section>}

      <section className="how">
        <div className="page-width">
          <SectionHead eyebrow="HOW THE CLUB WORKS" title={<>Shh… <span className="hl">the crowd</span> is deciding.</>} />
          <div className="steps">
            {[
              ['🌙', 'Monday', 'A new topic drops', 'A fresh creative brief every Monday, 10 AM.'],
              ['🎨', '10 days', 'Artists create', 'Indie artists submit. Curators pick the finalists.'],
              ['🗳️', 'Mon – Thu', 'You decide', `Vote free, or back for ${inr(prices.back)}. Top ${battle.winners} win.`],
              ['📦', 'Friday', 'We print', 'Winners print Friday and ship in 5–7 days.'],
            ].map(([e, d, t, c]) => (
              <div key={t} className="step"><span className="step-emoji">{e}</span><small>{d}</small><h3>{t}</h3><p>{c}</p></div>
            ))}
          </div>
        </div>
      </section>

      {winners.length > 4 && <section className="page-width section">
        <SectionHead eyebrow="THE CLUB’S FAVOURITES" title="Bestsellers" action="View all" href="/shop?collection=bestsellers" />
        <div className="grid4">{[...winners].sort((a, b) => b.sold - a.sold).map((p, i) => <ProductCard key={p.id} p={p} tilt={i === 2 ? 4 : i === 5 ? -3 : 0} />)}</div>
      </section>}

      <section className="page-width artist-feature">
        {featured ? (
          <div className="af-card">
            <Photo src={featured.photo} tint={featured.image} alt={featured.name} className="af-photo" />
            <div>
              <p className="eyebrow">DO NOT DUPE · ORIGINAL ART ONLY</p>
              <h2>Meet {first}.<br />{inr(prices.artistShare)} on every tee, forever.</h2>
              <p>{featured.bio ? `“${featured.bio}” ` : ''}{featured.wins} {featured.wins === 1 ? 'win' : 'wins'}, {featured.finalists} {featured.finalists === 1 ? 'finalist' : 'finalists'}, {fans(featured.followers)} people following along.</p>
              <Btn v="dark" href={`/artists/${featured.slug}`}>Meet the artist <Icon name="arrow" /></Btn>
            </div>
          </div>
        ) : <div className="af-card"><div><p className="eyebrow">ORIGINAL ART ONLY</p><h2>Artists earn {prices.artistPct}% of every tee, forever.</h2><Btn v="dark" href="/studio">Be the first <Icon name="arrow" /></Btn></div></div>}
        <aside className="af-submit">
          <span className="sticker white">{openTopic ? `DROP ${drop(openTopic.drop)} · OPEN` : 'NEXT TOPIC MONDAY'}</span>
          <h3>Make art?<br />Make it<br />wearable.</h3>
          <p>{openTopic ? `Topic: ${openTopic.title}. ${now ? `${dh(openTopic.closesAt - now)} left.` : 'Open now.'}` : 'A new brief goes up every Monday at 10 AM.'}</p>
          <Btn v="dark" href={openTopic ? '/studio' : '/topics'}>{openTopic ? 'Submit your design' : 'See the calendar'} <Icon name="arrow" /></Btn>
        </aside>
      </section>

      {mode === 'demo' && <section className="page-width section">
        <SectionHead eyebrow="DO NOT DOUBT" title="Real people. Real fits." />
        <div className="reviews-row">
          {reviews.map((r, i) => (
            <article key={r.name} className={`review r${i}`}><b>★★★★★</b><p>“{r.quote}”</p><small>{r.name} · Verified buyer</small></article>
          ))}
        </div>
      </section>}
      <Trust />
    </>
  );
}
