'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { COLOURS, SIZES, SIZE_CHART, inr, num, off } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { dayRange } from '@/lib/dnd/cycle';
import { useNow, useStore } from '@/lib/dnd/store';
import { ArtistLink, FinalistCard, ProductCard, VoteBtn } from '../cards';
import { Btn, CareTag, Countdown, Crumbs, Icon, Photo, SectionHead } from '../ui';
import { sizesFor } from './Shop';

const PINS: Record<string, string> = {
  '560038': 'Indiranagar, Bengaluru', '400050': 'Bandra West, Mumbai', '110001': 'Connaught Place, New Delhi',
  '600017': 'T. Nagar, Chennai', '500081': 'Madhapur, Hyderabad', '700016': 'Park Street, Kolkata', '411001': 'Camp, Pune', '682001': 'Fort Kochi, Kochi',
};

type PinInfo = { ok: boolean; place: string | null; minDays: number; maxDays: number };
const pad = (n: number) => String(n).padStart(3, '0');

export function DesignView({ id }: { id: string }) {
  const { winners, battle, prices, productById, finalistById, artistBySlug } = useCatalog();
  const { back: BACK, retail: RETAIL, mrp: MRP, artistShare: ARTIST_SHARE } = prices;
  const product = productById(id);
  const finalist = finalistById(id);
  const live = Boolean(finalist);
  const { state, addToBag, toggleVote, update, board: rank } = useStore();
  const router = useRouter();
  const now = useNow(15_000);
  const colours = COLOURS.filter((c) => (product ?? finalist)!.colours.includes(c.key));
  const sizes = product ? sizesFor(product) : [...SIZES];
  const [size, setSize] = useState<string>(sizes.includes('M') ? 'M' : sizes[0]);
  const [colour, setColour] = useState(colours[0].key);
  const [mode, setMode] = useState<'back' | 'vote'>('back');
  const [modal, setModal] = useState(false);
  const [open, setOpen] = useState(0);
  const [shot, setShot] = useState(live && finalist!.photos.length > 1 ? 1 : 0);
  const [pinEdit, setPinEdit] = useState(false);
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [pinInfo, setPinInfo] = useState<PinInfo | null>(null);

  const checkPin = async (code: string) => {
    const res = await fetch(`/api/store/pincode?pin=${code}`).catch(() => null);
    const info = res?.ok ? ((await res.json()) as PinInfo) : null;
    setPinInfo(info);
    return info;
  };
  useEffect(() => {
    if (/^[1-9]\d{5}$/.test(state.pincode)) void checkPin(state.pincode);
  }, [state.pincode]);

  useEffect(() => {
    if (!modal) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setModal(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [modal]);

  const backingIds = state.bag.filter((b) => b.kind === 'back').map((b) => b.id);
  const board = rank(now);
  const me = board.find((s) => s.id === id);
  const gallery = (product ?? finalist)!.photos;
  const name = (product ?? finalist)!.name;
  const artistName = (product ?? finalist)!.artist;
  const artist = artistBySlug((product ?? finalist)!.artistSlug);
  const backed = backingIds.includes(id);
  const voted = state.votes.includes(id);
  const lowStock = product?.low && product.low.size === size ? product.low.left : null;
  const pinPlace = pinInfo?.place ?? PINS[state.pincode] ?? (state.pincode ? 'PIN' : 'Add your PIN code');
  const today = now ?? battle.opensAt;
  const deliverBase = live ? battle.printsAt : today;
  // Printed to order: about 2 days to print, then the courier's transit time.
  const [dMin, dMax] = pinInfo ? (live ? [pinInfo.minDays + 1, pinInfo.maxDays + 1] : [pinInfo.minDays + 2, pinInfo.maxDays + 2]) : live ? [3, 7] : [5, 7];

  const add = () => addToBag({ kind: live ? 'back' : 'buy', id, size, colour });
  const savePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = pin.trim();
    if (!/^[1-9]\d{5}$/.test(code)) { setPinErr('Enter a 6-digit PIN code.'); return; }
    const info = await checkPin(code);
    if (info && !info.ok) { setPinErr('We couldn’t find that PIN code.'); return; }
    update({ pincode: code });
    setPinEdit(false);
    setPinErr('');
  };

  const accordions = live
    ? [
      ['How backing works', `${inr(BACK)} is a payment hold, not a charge. If this design finishes top ${battle.winners}, we charge and print it. If not, the hold is released that night and you get a 48-hour Backer Pass to buy any new winner at ${inr(BACK)}.`],
      ['The idea', finalist!.story],
      ['Fabric & fit', '240 GSM combed cotton, pre-shrunk and bio-washed. Relaxed unisex oversized fit. Printed to order in Tamil Nadu. Care: cold wash inside out, do not dry-clean, do not disturb.'],
      ['Shipping & exchanges', 'Winners print on Friday and ship in 5–7 days. Free shipping across India. One free size exchange within 7 days of delivery.'],
    ]
    : [
      ['Product details', `${product!.story} Winner of Drop ${pad(product!.drop)} · ${product!.topic}. ${product!.fit} fit.`],
      ['Fabric & fit', '240 GSM combed cotton, pre-shrunk and bio-washed. Relaxed unisex fit, true to size. Printed to order in Tamil Nadu. Care: cold wash inside out, do not dry-clean, do not disturb.'],
      ['Artist story', artist ? `${artist.bio} ${artist.name} earns ${inr(ARTIST_SHARE)} from every tee sold, forever.` : `${artistName} earns ${inr(ARTIST_SHARE)} from every tee sold.`],
      ['Shipping & exchanges', 'Printed to order and shipped in 5–7 days. Free shipping across India. One free size exchange within 7 days of delivery. No COD.'],
    ];

  return (
    <div className="page-width pdp">
      <Crumbs items={[['Home', '/'], live ? [`Live Battle · Drop ${pad(battle.drop)}`, '/battle'] : ['Winners', '/shop'], [name]]} />
      <div className="pdp-grid">
        <div className="gallery">
          <div className="main-photo">
            <Photo src={gallery[shot]} alt={name} tint={(product ?? finalist)!.image} eager />
            <span className={`sticker ${live ? 'red' : ''}`}>{live ? `LIVE FINALIST · #${me?.rank ?? ''}` : product!.badge}</span>
            <CareTag text={live ? 'DO NOT DISTURB' : product!.care} tilt={-6} />
          </div>
          {gallery.length > 1 && (
            <div className="thumbs" style={{ gridTemplateColumns: `repeat(${gallery.length}, 1fr)` }}>
              {gallery.map((s, k) => (
                <button key={s} className={k === shot ? 'on' : ''} aria-label={`Photo ${k + 1}`} aria-pressed={k === shot} onClick={() => setShot(k)}><Photo src={s} alt="" /></button>
              ))}
            </div>
          )}
        </div>
        <div className="pdp-info">
          <p className={`pdp-tag ${live ? 'live' : ''}`}>{live ? <><i className="live-dot" /> LIVE FINALIST · RANK #{me?.rank} · {battle.topic.toUpperCase()}</> : `COMMUNITY WINNER · DROP ${pad(product!.drop)} · ${product!.topic.toUpperCase()}`}</p>
          <h1>{name}</h1>
          <ArtistLink name={artistName} className="artist-link" />
          {live && me ? (
            <>
              <div className="vote-stat">
                <strong>{num(me.live)}</strong>
                <span>votes · {me.rank === 1 ? (board[1] ? `leading #2 by ${num(me.live - board[1].live)}` : 'leading') : `${num(board[0].live - me.live)} behind #1`} · {num(me.backersLive)} backers</span>
                <div className="meter"><i style={{ width: `${Math.round((me.live / Math.max(1, board[0].live * 1.05)) * 100)}%` }} /></div>
              </div>
              <div className="closing"><span><Icon name="clock" size={17} /> Voting closes in</span><b><Countdown /></b></div>
              <div className="choices" role="radiogroup">
                <button role="radio" aria-checked={mode === 'back'} className={`choice ${mode === 'back' ? 'on' : ''}`} onClick={() => setMode('back')}><i /><div><b>Back it <strong>{inr(BACK)}</strong> <s>{inr(RETAIL)}</s> <span className="green">{off(BACK, RETAIL)}% OFF</span></b><p>Your vote + this tee reserved in your size. Charged only if it finishes top {battle.winners}.</p><span className="sticker">MOST POPULAR</span></div></button>
                <button role="radio" aria-checked={mode === 'vote'} className={`choice ${mode === 'vote' ? 'on' : ''}`} onClick={() => setMode('vote')}><i /><div><b>Just vote — Free</b><p>Support the artist. One vote per design. Buy later if it wins.</p></div></button>
              </div>
            </>
          ) : product ? (
            <>
              {product.reviews > 0 && <div className="stars"><b>★ {product.rating}</b><span>{num(product.reviews)} ratings · {Math.round(product.reviews * 0.27)} reviews</span></div>}
              <div className="big-price"><strong>{inr(RETAIL)}</strong><s>{inr(MRP)}</s><span className="green">{off(RETAIL)}% OFF</span><small>incl. of all taxes</small></div>
              <p className="artist-share">{inr(ARTIST_SHARE)} from this tee goes straight to the artist.</p>
            </>
          ) : null}
          {(!live || mode === 'back') && (
            <>
              <div className="opt-label"><b>Colour: <span>{COLOURS.find((c) => c.key === colour)?.name}</span></b></div>
              <div className="swatches">{colours.map((c) => <button key={c.key} aria-label={c.name} title={c.name} aria-pressed={c.key === colour} className={c.key === colour ? 'on' : ''} style={{ background: c.hex }} onClick={() => setColour(c.key)} />)}</div>
              <div className="opt-label"><b>Select size</b><button onClick={() => setModal(true)}>Size guide</button></div>
              <div className="sizes">{SIZES.map((s) => {
                const ok = sizes.includes(s);
                return <button key={s} disabled={!ok} title={ok ? undefined : 'Not cut in this fit'} aria-pressed={size === s} className={size === s ? 'on' : ''} onClick={() => setSize(s)}>{s}</button>;
              })}</div>
              <p className="stock">{lowStock ? `🔥 Only ${lowStock} left in ${size} · ` : '🔥 '}{live ? `${num(me?.backersLive ?? finalist!.backers)} people backed this` : `${num(product!.sold)} people bought this`}</p>
            </>
          )}
          <div className="pdp-cta">
            {live
              ? (mode === 'back'
                ? <><Btn v="dark" onClick={add}>{backed ? `Update backing · ${size}` : `Back it · ${size} · ${inr(BACK)}`}</Btn><VoteBtn id={id} votes={me?.live ?? 0} /></>
                : <VoteBtn id={id} votes={me?.live ?? 0} />)
              : <><Btn v="dark" onClick={add}>Add to bag · {inr(RETAIL)}</Btn><Btn v="yellow" onClick={() => { add(); router.push('/bag'); }}>Buy now</Btn></>}
          </div>
          <div className="delivery">
            <Icon name="pin" />
            {pinEdit ? (
              <form className="pin-form" onSubmit={savePin}>
                <input autoFocus inputMode="numeric" maxLength={6} placeholder="6-digit PIN" aria-label="PIN code" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
                <button type="submit">Check</button>
                {pinErr && <span className="field-error">{pinErr}</span>}
              </form>
            ) : (
              <>
                <div><b>{live ? `Ships ${dayRange(deliverBase, dMin, dMax)} if it wins` : `Delivery by ${dayRange(deliverBase, dMin, dMax)}`}</b><span>{pinPlace} {state.pincode}</span></div>
                <button onClick={() => { setPin(state.pincode); setPinEdit(true); }}>Change</button>
              </>
            )}
          </div>
          <div className="accordions">
            {accordions.map(([x, body], i) => (
              <div key={x}><button aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}><b>{x}</b><span>{open === i ? '−' : '+'}</span></button>
                {open === i && <p>{body}{x === 'Artist story' && artist && <> <Link className="link" href={`/artists/${artist.slug}`}>Meet {artist.name.split(' ')[0]} →</Link></>}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
      {live ? (
        <section className="section">
          <SectionHead eyebrow="SAME BATTLE" title={`More from ${battle.topic}`} action="See leaderboard" href="/battle" />
          <div className="rail">{board.filter((x) => x.id !== id).slice(0, 4).map((x) => <FinalistCard key={x.id} s={x} leader={board[0].live} />)}</div>
        </section>
      ) : (
        <>
          {product!.reviews > 0 && <section className="section">
            <SectionHead eyebrow="DO NOT DOUBT" title="Real people. Real fits." />
            <div className="review-summary"><div><b>{product!.rating}</b><span>★★★★★</span><p>{num(product!.reviews)} ratings</p></div><div className="bars">{[5, 4, 3, 2, 1].map((x, i) => <p key={x}>{x}★ <span><i style={{ width: `${88 - i * 19}%` }} /></span></p>)}</div><div className="fit"><p className="eyebrow">FIT VERDICT</p><b>True to size</b><small>78% said so</small></div></div>
          </section>}
          <section className="section">
            <SectionHead eyebrow="YOU MIGHT ALSO LIKE" title={`More ${product!.mood}`} action="Shop all" href="/shop" />
            <div className="rail products">{winners.filter((w) => w.id !== id).sort((a, b) => Number(b.mood === product!.mood) - Number(a.mood === product!.mood)).slice(0, 4).map((w) => <ProductCard key={w.id} p={w} />)}</div>
          </section>
        </>
      )}
      {modal && (
        <div className="modal-bg" onClick={() => setModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Size guide" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" aria-label="Close" onClick={() => setModal(false)}><Icon name="close" /></button>
            <p className="eyebrow">FIND YOUR FIT</p><h2>Size guide</h2><p className="muted">Inches. For an oversized look, pick your usual size. Tap a row to select it.</p>
            <table><thead><tr>{['SIZE', 'CHEST', 'LENGTH', 'SHOULDER'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{SIZE_CHART.filter((r) => sizes.includes(r[0] as never)).map((r) => <tr key={r[0]} className={r[0] === size ? 'on' : ''} onClick={() => setSize(r[0])}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
            <Btn v="dark" onClick={() => setModal(false)}>Got it · {size}</Btn>
          </div>
        </div>
      )}
      <div className="sticky-buy">
        <div><small>{live ? (mode === 'back' ? 'BACK IF IT PRINTS' : 'FREE VOTE') : 'TOTAL'}</small><b>{live && mode === 'vote' ? '₹0' : inr(live ? BACK : RETAIL)}</b></div>
        {live && mode === 'vote'
          ? <Btn v="dark" onClick={() => toggleVote(id)}>{voted ? '✓ Voted' : 'Vote free'}</Btn>
          : <Btn v="dark" onClick={add}>{live ? (backed ? `Update · ${size}` : `Back it · ${size}`) : `Add to bag · ${size}`}</Btn>}
      </div>
    </div>
  );
}
