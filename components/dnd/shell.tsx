'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BACK, BATTLE, COLLECTIONS, FITS, RETAIL, artists, finalists, img, inr, moods, winners } from '@/lib/dnd/catalog';
import { quote, useStore } from '@/lib/dnd/store';
import { Countdown, Icon, Logo, Photo, type IconName } from './ui';

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [search, setSearch] = useState(false);
  const standalone = path.startsWith('/studio');

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '/' && !typing) { e.preventDefault(); setSearch(true); }
      if (e.key === 'Escape') setSearch(false);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => setSearch(false), [path]);

  return (
    <div className="app">
      <a href="#main" className="skip">Skip to content</a>
      {!standalone && <Header path={path} openSearch={() => setSearch(true)} />}
      <main id="main">{children}</main>
      {!standalone && !path.startsWith('/checkout') && !path.startsWith('/result') && <Footer />}
      {!standalone && <MobileNav path={path} />}
      {search && <SearchOverlay close={() => setSearch(false)} />}
      <Toasts />
    </div>
  );
}

function Header({ path, openSearch }: { path: string; openSearch: () => void }) {
  const { state, hydrated, night, setNight } = useStore();
  const [megaOpen, setMegaOpen] = useState(false);
  const bag = hydrated ? quote(state).items : 0;
  const isShop = path.startsWith('/shop') || (path.startsWith('/design/') && winners.some((w) => path.endsWith(`/${w.id}`)));
  const isBattle = path.startsWith('/battle') || (path.startsWith('/design/') && finalists.some((f) => path.endsWith(`/${f.id}`)));
  const close = () => setMegaOpen(false);

  const line = (
    <>
      <span><Icon name="moon" size={13} /> DND is ON — notifications muted, deals unmuted</span><b>✦</b>
      <span>{BATTLE.topic} voting closes in <Countdown /></span><b>✦</b>
      <span>Back a design at {inr(BACK)} · pay only if it prints</span><b>✦</b>
      <span>Free shipping across India</span><b>✦</b>
      <span>Code SNOOZE10 · 10% off your first drop</span><b>✦</b>
    </>
  );
  return (
    <header className="site-header">
      <div className="status-strip"><div className="ticker"><div>{line}</div><div aria-hidden>{line}</div></div></div>
      <div className="header-main page-width">
        <Logo />
        <button className="searchbar" onClick={openSearch}><Icon name="search" size={18} /><span>Search “oversized”, “chennai artists”, “snooze”…</span><kbd>/</kbd></button>
        <div className="header-actions">
          <label className="dnd-switch" title="DND mode: night theme">
            <input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} aria-label="DND mode (night theme)" />
            <span className="track"><span className="thumb"><Icon name="moon" size={12} /></span></span>
            <em>DND mode</em>
          </label>
          <button className="icon-btn mobile-only" aria-label="Search" onClick={openSearch}><Icon name="search" /></button>
          <Link className="icon-btn" aria-label="Wishlist" href="/account?tab=wishlist"><Icon name="heart" /></Link>
          <Link className={`icon-btn ${path.startsWith('/account') || path.startsWith('/dashboard') ? 'active' : ''}`} aria-label="Account" href="/account"><Icon name="user" /></Link>
          <Link className={`icon-btn bag ${path.startsWith('/bag') || path.startsWith('/checkout') ? 'active' : ''}`} aria-label={`Bag, ${bag} items`} href="/bag"><Icon name="bag" />{bag > 0 && <em>{bag}</em>}</Link>
        </div>
      </div>

      <div className="nav-wrap">
        <nav className="main-nav page-width" aria-label="Primary">
          <div className="nav-links">
            <Link className={`nav-item ${path === '/' ? 'active' : ''}`} href="/"><Icon name="home" size={18} /><span>Home</span></Link>

            <div className={`nav-shop ${megaOpen ? 'open' : ''}`} onMouseEnter={() => setMegaOpen(true)} onMouseLeave={close}>
              <Link className={`nav-item ${isShop ? 'active' : ''}`} href="/shop" onClick={close} aria-expanded={megaOpen} aria-haspopup="true" onFocus={() => setMegaOpen(true)}>
                <span>Shop Tees</span>
                <svg className="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </Link>
              <div className="mega" onKeyDown={(e) => e.key === 'Escape' && close()}>
                <div className="mega-col">
                  <b>SHOP BY MOOD</b>
                  <div className="mega-list">
                    {moods.slice(0, 6).map((m) => (
                      <Link key={m.slug} className="mega-item" href={`/shop?mood=${m.slug}`} onClick={close}>
                        <span className="mega-emoji" style={{ background: m.color }}>{m.emoji}</span><span>{m.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="mega-col">
                  <b>SHOP BY FIT</b>
                  <div className="mega-list">
                    {FITS.map((f) => (
                      <Link key={f.name} className="mega-item" href={`/shop?fit=${encodeURIComponent(f.name)}`} onClick={close}>
                        <span className="mega-text"><strong>{f.name}</strong><small>{f.sub}</small></span><Icon name="arrow" size={14} />
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="mega-col">
                  <b>COLLECTIONS</b>
                  <div className="mega-list">
                    {COLLECTIONS.map((c) => (
                      <Link key={c.slug} className="mega-item" href={`/shop?collection=${c.slug}`} onClick={close}>
                        <span className="mega-text"><strong>{c.name}</strong><small>{c.tag}</small></span><Icon name="arrow" size={14} />
                      </Link>
                    ))}
                  </div>
                </div>
                <Link className="mega-promo" href="/battle" onClick={close}>
                  <span className="sticker red">LIVE · DROP 0{BATTLE.drop}</span>
                  <strong>Back {BATTLE.topic} at {inr(BACK)}</strong>
                  <p>Vote on {finalists.length} finalist designs. Top 3 go to print this Friday.</p>
                  <small>Enter the battle →</small>
                </Link>
              </div>
            </div>

            <Link className="nav-item" href="/shop?collection=new"><span>New Drops</span><em className="nav-pill">043</em></Link>
            <Link className={`nav-item nav-item-battle ${isBattle ? 'active' : ''}`} href="/battle"><i className="live-dot" /><span>Live Battle</span><em className="nav-pill live">VOTE</em></Link>
            <Link className={`nav-item ${path.startsWith('/topics') ? 'active' : ''}`} href="/topics"><span>Topics</span></Link>
            <Link className={`nav-item ${path.startsWith('/artists') ? 'active' : ''}`} href="/artists"><span>Artists</span></Link>
          </div>
          <Link className="nav-cta" href="/studio"><Icon name="plus" size={17} /><span>Submit Your Art</span></Link>
        </nav>
      </div>

      <div className="mood-bar">
        <div className="page-width mood-bar-inner">
          <span className="mood-bar-label">VIBE CHECK</span>
          <div className="mood-bar-pills">
            {moods.map((m) => <Link key={m.slug} className="mood-pill" href={`/shop?mood=${m.slug}`}><i>{m.emoji}</i><span>{m.name}</span></Link>)}
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { state, update, toast } = useStore();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const join = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setErr('Enter a valid email address.'); return; }
    setErr('');
    update({ newsletter: email.trim().toLowerCase() });
    toast('You’re unmuted', 'One email a week. Zero spam.');
    setEmail('');
  };
  const cols: [string, [string, string][]][] = [
    ['SHOP', [['New drops', '/shop?collection=new'], ['Bestsellers', '/shop?collection=bestsellers'], ['Live finalists', '/shop?view=live'], ['Under ₹999', '/shop?collection=under-999']]],
    ['THE CLUB', [['How it works', '/topics'], ['This week’s battle', '/battle'], ['Artists', '/artists'], ['Submit your art', '/studio']]],
    ['HELP', [['Track order', '/account?tab=orders'], ['Size guide', '/legal/size-guide'], ['Exchanges', '/legal/shipping-returns'], ['Contact', '/legal/contact']]],
  ];
  return (
    <footer className="footer">
      <div className="page-width">
        <div className="footer-hanger">
          <div className="hanger"><span className="hole" /><b>PLEASE</b><strong>DO NOT<br />DISTURB</strong><small>new drops inside</small></div>
          <div className="newsletter">
            <p className="eyebrow">THE ONLY NOTIFICATION WE SEND</p>
            <h2>One email a week.<br />Zero spam. Pinky promise.</h2>
            {state.newsletter ? (
              <p className="nl-done">✓ Unmuted · {state.newsletter} <button className="link small" onClick={() => update({ newsletter: null })}>Mute again</button></p>
            ) : (
              <form className="nl-form" onSubmit={join} noValidate>
                <input type="email" placeholder="your@email.com" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button type="submit" className="btn btn-yellow">Unmute me</button>
              </form>
            )}
            {err && <p className="field-error" role="alert">{err}</p>}
          </div>
        </div>
        <div className="footer-grid">
          <div><Logo light /><p>Dressed, not disturbed.<br />Original Indian art, printed to order.</p></div>
          {cols.map(([h, links]) => (
            <div key={h}><b>{h}</b>{links.map(([l, href]) => <Link key={l} href={href}>{l}</Link>)}</div>
          ))}
        </div>
        <div className="footer-big" aria-hidden>do not disturb.</div>
        <div className="footer-bottom">
          <span>UPI · RuPay · Visa · Mastercard</span>
          <span>© 2026 The DND Club · <Link href="/legal/terms">Terms</Link> · <Link href="/legal/privacy">Privacy</Link></span>
          <span>Instagram · YouTube · WhatsApp</span>
        </div>
      </div>
    </footer>
  );
}

function MobileNav({ path }: { path: string }) {
  const t = (href: string, icon: IconName, label: string, match: boolean) => (
    <Link className={match ? 'active' : ''} href={href}><Icon name={icon} size={20} /><span>{label}</span></Link>
  );
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {t('/', 'home', 'Home', path === '/')}
      {t('/shop', 'bag', 'Shop', path.startsWith('/shop') || path.startsWith('/bag'))}
      <Link className="submit-tab" href="/studio"><i><Icon name="plus" size={22} /></i><span>Submit</span></Link>
      {t('/battle', 'zap', 'Battle', path.startsWith('/battle'))}
      {t('/account', 'user', 'Account', path.startsWith('/account') || path.startsWith('/dashboard'))}
    </nav>
  );
}

const TOPICS = [
  { title: 'Monsoon Mood', note: 'Voting now', href: '/battle' },
  { title: 'Beautiful Chaos', note: 'Submissions open', href: '/studio' },
  { title: 'Night Shift', note: 'In review', href: '/topics' },
  { title: 'Future Folklore', note: 'Printing', href: '/shop?collection=new' },
];

function SearchOverlay({ close }: { close: () => void }) {
  const [q, setQ] = useState('');
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const term = q.trim().toLowerCase();
  const words = term.split(/\s+/).filter(Boolean);
  const match = (hay: string) => words.every((w) => hay.toLowerCase().includes(w));
  const hits = useMemo(() => {
    const designs = [
      ...winners.map((p) => ({ id: p.id, name: p.name, sub: `by ${p.artist} · ${p.mood} · ${p.fit}`, img: img.product(p.id, 1), price: inr(RETAIL), hay: `${p.name} ${p.artist} ${p.city} ${p.mood} ${p.fit} ${p.topic} winner` })),
      ...finalists.map((f) => ({ id: f.id, name: f.name, sub: `Live finalist · by ${f.artist}`, img: img.finalist(f.id), price: inr(BACK), hay: `${f.name} ${f.artist} ${f.city} ${BATTLE.topic} live finalist monsoon` })),
    ];
    return {
      designs: (words.length ? designs.filter((d) => match(d.hay)) : designs.slice(0, 4)).slice(0, 5),
      artists: artists.filter((a) => words.length && match(`${a.name} ${a.city} ${a.styles.join(' ')} artists`)).slice(0, 4),
      topics: TOPICS.filter((t) => words.length && match(`${t.title} ${t.note} topic`)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);
  const go = (href: string) => { close(); router.push(href); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const first = hits.designs[0];
    if (first) go(`/design/${first.id}`);
    else if (hits.artists[0]) go(`/artists/${hits.artists[0].slug}`);
  };
  return (
    <div className="search-bg" onClick={close} role="dialog" aria-modal="true" aria-label="Search">
      <div className="search-panel" ref={panel} onClick={(e) => e.stopPropagation()}>
        <form className="search-head" onSubmit={submit}>
          <Icon name="search" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search designs, artists, moods…" aria-label="Search" />
          <button type="button" className="link" onClick={close}>Esc</button>
        </form>
        <div className="search-cols">
          <section><p className="eyebrow">TRY</p><div className="chips">{['oversized', 'chennai', 'snooze', 'monsoon'].map((x) => <button key={x} onClick={() => setQ(x)}>{x}</button>)}</div></section>
          <section>
            <p className="eyebrow">DESIGNS</p>
            {hits.designs.length ? hits.designs.map((p) => (
              <button key={p.id} className="hit" onClick={() => go(`/design/${p.id}`)}>
                <Photo src={p.img} alt="" className="hit-photo" /><span><b>{p.name}</b><small>{p.sub}</small></span><strong>{p.price}</strong>
              </button>
            )) : <p className="muted">No matches. It’s on DND. 🌙</p>}
          </section>
          <section>
            <p className="eyebrow">ARTISTS & TOPICS</p>
            {hits.artists.map((a) => <button key={a.slug} className="hit text" onClick={() => go(`/artists/${a.slug}`)}>{a.name} · {a.city} →</button>)}
            {hits.topics.map((t) => <button key={t.title} className="hit text" onClick={() => go(t.href)}>{t.title} · {t.note} →</button>)}
            {!hits.artists.length && !hits.topics.length && (
              <>
                <button className="hit text" onClick={() => go('/artists')}>Browse all artists →</button>
                <button className="hit text" onClick={() => go('/topics')}>See this week’s topics →</button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast-icon"><Icon name="moon" size={16} /></span>
          <div><b>{t.title}</b><span>{t.body}</span></div>
          {t.action ? <Link href={t.action.href} onClick={() => dismissToast(t.id)}>{t.action.label}</Link> : <button onClick={() => dismissToast(t.id)} aria-label="Dismiss">✕</button>}
        </div>
      ))}
    </div>
  );
}
