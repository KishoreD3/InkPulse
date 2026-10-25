'use client';
import { useEffect, useState } from 'react';
import type { ArtistDashboard } from '@/app/api/store/artist/route';
import { DEFAULT_PRICES, img, inr, num } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { dateTime } from '@/lib/dnd/cycle';
import { useStore, type Submission } from '@/lib/dnd/store';
import { Btn, Empty, Icon, Photo } from '../ui';

const TABS = ['Overview', 'Submissions', 'Sales & earnings', 'Payouts', 'Profile'] as const;
const DB_STATUS: Record<string, Submission['status']> = {
  draft: 'Submitted', in_review: 'In review', changes_requested: 'Changes requested', approved: 'In review',
  rejected: 'Not selected', live: 'Live', won: 'Winner', lost: 'Not selected',
};

/** The demo artist, Nilofer: a year of sales and two printed winners. */
function demoDashboard(subs: Submission[]): ArtistDashboard {
  const share = DEFAULT_PRICES.artistShare;
  const sales = [31, 38, 29, 44, 40, 47, 42, 65, 54, 78, 69, 92];
  const labels = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const month = sales[sales.length - 1] * 200 + 80;
  return {
    name: 'Nilofer S.',
    designs: [
      ...subs.map((s) => ({ id: s.id, slug: '', title: s.title, drop: s.drop || 46, status: s.status, votes: 0, sold: 0, earned: 0, thumb: s.image ?? img.hero, at: s.createdAt })),
      { id: 'd1', slug: 'midnight-auto', title: 'Midnight Auto', drop: 43, status: 'Winner', votes: 6204, sold: 1208, earned: 1208 * share, thumb: img.product('midnight-auto', 1), at: 0 },
      { id: 'd2', slug: 'kaapi-futures', title: 'Kaapi Futures', drop: 41, status: 'Winner', votes: 5102, sold: 874, earned: 874 * share, thumb: img.product('kaapi-futures', 1), at: 0 },
      { id: 'd3', slug: '', title: 'Filter Coffee Club', drop: 45, status: 'In review', votes: 0, sold: 0, earned: 0, thumb: img.file('filter-coffee-club'), at: 0 },
      { id: 'd4', slug: '', title: 'After Dark', drop: 46, status: 'Submitted', votes: 0, sold: 0, earned: 0, thumb: img.file('after-dark'), at: 0 },
    ],
    lifetime: 142560, lifetimeTees: 864, thisMonth: month, lastMonth: Math.round(month / 1.18), nextPayout: 16005,
    months: sales.map((h, i) => ({ label: labels[i], tees: h * 2, amount: h * 2 * share })),
    payouts: [['2026-10-01', 15120], ['2026-09-01', 12870], ['2026-08-01', 14355], ['2026-07-01', 9570]].map(([d, a]) => ({ at: Date.parse(d as string), amount: a as number, utr: null })),
  };
}

export function DashboardView() {
  const { state, saveProfile, toast, mode, session, hydrated } = useStore();
  const { prices } = useCatalog();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const [range, setRange] = useState(6);
  const [upi, setUpi] = useState(state.payoutUpi);
  const [bio, setBio] = useState(state.artistBio);
  const [live, setLive] = useState<ArtistDashboard | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setUpi(state.payoutUpi); setBio(state.artistBio); }, [state.payoutUpi, state.artistBio]);
  useEffect(() => {
    if (mode !== 'live' || !session) return;
    fetch('/api/store/artist').then((r) => (r.ok ? r.json() : Promise.reject(r))).then(setLive).catch(() => setFailed(true));
  }, [mode, session]);

  if (mode === 'live' && !live) {
    return <div className="page-width dash">{failed ? <Empty title="We couldn’t load your studio." body="Refresh the page to try again." /> : <div className="skeleton" />}</div>;
  }
  const data = live ?? demoDashboard(hydrated ? state.submissions : []);
  const first = data.name.split(' ')[0];
  const change = data.lastMonth ? Math.round(((data.thisMonth - data.lastMonth) / data.lastMonth) * 100) : null;
  const max = Math.max(1, ...data.months.map((m) => m.amount));
  const upiOk = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upi.trim());
  const statusOf = (s: string) => DB_STATUS[s] ?? s;
  const save = async (patch: Parameters<typeof saveProfile>[0], title: string, body: string) => {
    const err = await saveProfile(patch);
    if (err) toast('Not saved', err); else toast(title, body);
  };

  const table = (limit?: number) => (
    data.designs.length ? (
      <section className="sub-table"><div><h2>Your submissions</h2>{limit && <button className="link" onClick={() => setTab('Submissions')}>View all</button>}</div>
        <table><thead><tr>{['DESIGN', 'DROP', 'STATUS', 'VOTES', 'SALES'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{data.designs.slice(0, limit).map((r) => {
            const st = statusOf(r.status);
            return (
              <tr key={r.id}>
                <td><Photo src={r.thumb} alt="" className="tbl-photo" /><b>{r.title}</b>{r.at ? <small className="muted"> · {dateTime(r.at)}</small> : null}</td>
                <td>{r.drop ? `Drop ${String(r.drop).padStart(3, '0')}` : '—'}</td>
                <td><span className={`status s${st === 'Winner' ? 2 : st === 'In review' || st === 'Live' ? 0 : 1}`}>{st}</span></td>
                <td>{r.votes ? num(r.votes) : '—'}</td><td>{r.sold ? num(r.sold) : '—'}</td>
              </tr>
            );
          })}</tbody></table>
      </section>
    ) : <Empty emoji="🎨" title="No submissions yet." body="Read this week’s brief and send your first design."><Btn v="dark" href="/studio">Submit a design</Btn></Empty>
  );
  const months = data.months.slice(-range);
  const chart = (
    <section className="chart"><div><h2>Monthly sales</h2><select value={range} aria-label="Range" onChange={(e) => setRange(Number(e.target.value))}><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></div>
      <div className="bars" style={{ gridTemplateColumns: `repeat(${range}, 1fr)` }}>{months.map((m, i) => (
        <div key={i} title={`${m.label}: ${m.tees} tees · ${inr(m.amount)}`}><i style={{ height: `${Math.max(2, Math.round((m.amount / max) * 100))}%` }} className={i === months.length - 1 ? 'now' : ''} /><span>{m.label}</span></div>
      ))}</div>
    </section>
  );
  const sold = data.designs.filter((r) => r.sold);

  return (
    <div className="page-width dash">
      <aside className="dash-side"><p className="eyebrow">ARTIST STUDIO</p><b>{data.name}</b>
        {TABS.map((x) => <button key={x} aria-current={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{x}<Icon name="arrow" size={14} /></button>)}
        <a className="aside-link" href="/">← Back to store</a>
      </aside>
      <div>
        <div className="dash-head"><div><p className="eyebrow">{tab.toUpperCase()}</p><h1>{tab === 'Overview' ? (data.thisMonth ? `${first}, you made ${inr(data.thisMonth)} this month. 🌙` : `Welcome to your studio, ${first}. 🌙`) : tab}</h1></div><Btn v="dark" href="/studio"><Icon name="plus" /> New submission</Btn></div>
        {tab === 'Overview' && (
          <>
            <div className="earn">{[
              ['LIFETIME EARNINGS', inr(data.lifetime), `from ${num(data.lifetimeTees)} tees`],
              ['THIS MONTH', inr(data.thisMonth), change == null ? `${prices.artistPct}% of every tee` : `${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}% vs last month`],
              ['NEXT PAYOUT', inr(data.nextPayout), state.payoutUpi ? `to ${state.payoutUpi} · 1st of the month` : 'Add a payout UPI ID'],
            ].map(([a, b, c], i) => <article key={a} className={i === 0 ? 'hi' : ''}><span>{a}</span><b>{b}</b><small>{c}</small></article>)}</div>
            {chart}
            {table(4)}
          </>
        )}
        {tab === 'Submissions' && table()}
        {tab === 'Sales & earnings' && (
          <>
            {chart}
            <section className="sub-table"><div><h2>By design</h2></div>
              {sold.length ? (
                <table><thead><tr>{['DESIGN', 'TEES SOLD', 'YOUR CUT', 'EARNED'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{sold.map((r) => <tr key={r.id}><td><Photo src={r.thumb} alt="" className="tbl-photo" /><b>{r.title}</b></td><td>{num(r.sold)}</td><td>{inr(prices.artistShare)} / tee</td><td>{inr(r.earned)}</td></tr>)}</tbody></table>
              ) : <p className="muted">Sales show up here once one of your designs prints.</p>}
            </section>
          </>
        )}
        {tab === 'Payouts' && (
          <>
            <section className="co-card">
              <h2>Payout account</h2>
              <p className="muted">Paid on the 1st of every month, after the 7-day return window.</p>
              <div className="upi"><input value={upi} onChange={(e) => setUpi(e.target.value)} aria-label="Payout UPI ID" placeholder="yourname@upi" /><button disabled={!upiOk} onClick={() => void save({ payoutUpi: upi.trim() }, 'Payout account saved', `Next payout goes to ${upi.trim()}.`)}>Save</button></div>
              {!upiOk && <p className="field-error">Use the name@bank format.</p>}
            </section>
            <section className="sub-table"><div><h2>History</h2></div>
              {data.payouts.length ? (
                <table><thead><tr>{['DATE', 'AMOUNT', 'REFERENCE', 'STATUS'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{data.payouts.map((p) => <tr key={p.at}><td>{dateTime(p.at)}</td><td>{inr(p.amount)}</td><td>{p.utr ?? state.payoutUpi}</td><td><span className="status s2">Paid</span></td></tr>)}</tbody></table>
              ) : <p className="muted">No payouts yet.</p>}
            </section>
          </>
        )}
        {tab === 'Profile' && (
          <form className="co-card" onSubmit={(e) => { e.preventDefault(); void save({ artistBio: bio.trim() }, 'Profile saved', 'Your bio is updated.'); }}>
            <h2>Public profile</h2>
            <label className="field"><span>Bio <small className="muted">{bio.length}/240</small></span><textarea maxLength={240} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
            <p className="muted small">Shown on your artist page and on every design you submit.</p>
            <Btn v="dark" type="submit" disabled={bio.trim().length < 10}>Save profile</Btn>
          </form>
        )}
      </div>
    </div>
  );
}
