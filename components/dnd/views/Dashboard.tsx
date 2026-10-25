'use client';
import { useState } from 'react';
import { ARTIST_SHARE, inr, img, num } from '@/lib/dnd/catalog';
import { dateTime } from '@/lib/dnd/cycle';
import { useStore } from '@/lib/dnd/store';
import { Btn, Icon, Photo } from '../ui';

const MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const SALES = [31, 38, 29, 44, 40, 47, 42, 65, 54, 78, 69, 92];
const STATIC_ROWS = [
  { title: 'Midnight Auto', drop: '043', status: 'Winner', votes: '6,204', sales: 1208, thumb: img.product('midnight-auto', 1) },
  { title: 'Kaapi Futures', drop: '041', status: 'Winner', votes: '5,102', sales: 874, thumb: img.product('kaapi-futures', 1) },
  { title: 'Filter Coffee Club', drop: '045', status: 'In review', votes: '—', sales: 0, thumb: img.file('filter-coffee-club') },
  { title: 'After Dark', drop: '046', status: 'Submitted', votes: '—', sales: 0, thumb: img.file('after-dark') },
];
const PAYOUTS = [['1 Oct', 15120], ['1 Sep', 12870], ['1 Aug', 14355], ['1 Jul', 9570]] as const;
const TABS = ['Overview', 'Submissions', 'Sales & earnings', 'Payouts', 'Profile'] as const;

export function DashboardView() {
  const { state, update, toast } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const [range, setRange] = useState(6);
  const [upi, setUpi] = useState(state.payoutUpi);
  const [bio, setBio] = useState(state.artistBio);
  const rows = [
    ...state.submissions.map((s) => ({ title: s.title, drop: '046', status: s.status, votes: '—', sales: 0, thumb: s.image ?? img.hero, at: s.createdAt })),
    ...STATIC_ROWS.map((r) => ({ ...r, at: 0 })),
  ];
  const month = SALES[SALES.length - 1] * 200 + 80;
  const upiOk = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upi.trim());

  const table = (limit?: number) => (
    <section className="sub-table"><div><h2>Your submissions</h2>{limit && <button className="link" onClick={() => setTab('Submissions')}>View all</button>}</div>
      <table><thead><tr>{['DESIGN', 'DROP', 'STATUS', 'VOTES', 'SALES'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.slice(0, limit).map((r, i) => (
          <tr key={`${r.title}-${i}`}>
            <td><Photo src={r.thumb} alt="" className="tbl-photo" /><b>{r.title}</b>{r.at ? <small className="muted"> · {dateTime(r.at)}</small> : null}</td>
            <td>Drop {r.drop}</td>
            <td><span className={`status s${r.status === 'Winner' ? 2 : r.status === 'In review' ? 0 : 1}`}>{r.status}</span></td>
            <td>{r.votes}</td><td>{r.sales ? num(r.sales) : '—'}</td>
          </tr>
        ))}</tbody></table>
    </section>
  );
  const chart = (
    <section className="chart"><div><h2>Monthly sales</h2><select value={range} aria-label="Range" onChange={(e) => setRange(Number(e.target.value))}><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select></div>
      <div className="bars" style={{ gridTemplateColumns: `repeat(${range}, 1fr)` }}>{SALES.slice(-range).map((h, i, a) => (
        <div key={i} title={`${MONTHS.slice(-range)[i]}: ${h * 2} tees · ${inr(h * 2 * ARTIST_SHARE)}`}><i style={{ height: `${h}%` }} className={i === a.length - 1 ? 'now' : ''} /><span>{MONTHS.slice(-range)[i]}</span></div>
      ))}</div>
    </section>
  );

  return (
    <div className="page-width dash">
      <aside className="dash-side"><p className="eyebrow">ARTIST STUDIO</p><b>Nilofer S.</b>
        {TABS.map((x) => <button key={x} aria-current={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{x}<Icon name="arrow" size={14} /></button>)}
        <a className="aside-link" href="/">← Back to store</a>
      </aside>
      <div>
        <div className="dash-head"><div><p className="eyebrow">{tab.toUpperCase()}</p><h1>{tab === 'Overview' ? `Nilofer, you made ${inr(month)} this month. 🌙` : tab}</h1></div><Btn v="dark" href="/studio"><Icon name="plus" /> New submission</Btn></div>
        {tab === 'Overview' && (
          <>
            <div className="earn">{[['LIFETIME EARNINGS', '₹1,42,560', 'from 864 tees'], ['THIS MONTH', inr(month), '↑ 18% vs last month'], ['NEXT PAYOUT', '₹16,005', `to ${state.payoutUpi} · 1 Nov`]].map(([a, b, c], i) => <article key={a} className={i === 0 ? 'hi' : ''}><span>{a}</span><b>{b}</b><small>{c}</small></article>)}</div>
            {chart}
            {table(4)}
          </>
        )}
        {tab === 'Submissions' && table()}
        {tab === 'Sales & earnings' && (
          <>
            {chart}
            <section className="sub-table"><div><h2>By design</h2></div>
              <table><thead><tr>{['DESIGN', 'TEES SOLD', 'YOUR CUT', 'EARNED'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{STATIC_ROWS.filter((r) => r.sales).map((r) => <tr key={r.title}><td><Photo src={r.thumb} alt="" className="tbl-photo" /><b>{r.title}</b></td><td>{num(r.sales)}</td><td>{inr(ARTIST_SHARE)} / tee</td><td>{inr(r.sales * ARTIST_SHARE)}</td></tr>)}</tbody></table>
            </section>
          </>
        )}
        {tab === 'Payouts' && (
          <>
            <section className="co-card">
              <h2>Payout account</h2>
              <p className="muted">Paid on the 1st of every month, after the 7-day return window.</p>
              <div className="upi"><input value={upi} onChange={(e) => setUpi(e.target.value)} aria-label="Payout UPI ID" /><button disabled={!upiOk} onClick={() => { update({ payoutUpi: upi.trim() }); toast('Payout account saved', `Next payout goes to ${upi.trim()}.`); }}>Save</button></div>
              {!upiOk && <p className="field-error">Use the name@bank format.</p>}
            </section>
            <section className="sub-table"><div><h2>History</h2></div>
              <table><thead><tr>{['DATE', 'AMOUNT', 'TO', 'STATUS'].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{PAYOUTS.map(([d, a]) => <tr key={d}><td>{d}</td><td>{inr(a)}</td><td>{state.payoutUpi}</td><td><span className="status s2">Paid</span></td></tr>)}</tbody></table>
            </section>
          </>
        )}
        {tab === 'Profile' && (
          <form className="co-card" onSubmit={(e) => { e.preventDefault(); update({ artistBio: bio.trim() }); toast('Profile saved', 'Your bio is updated.'); }}>
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
