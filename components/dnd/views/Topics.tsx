'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { num, type Stage } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { dh } from '@/lib/dnd/cycle';
import { useNow, useStore } from '@/lib/dnd/store';
import { Btn, Empty, Icon, Photo, SectionHead } from '../ui';

const PHASE: Record<Stage['phase'], [string, string, string]> = {
  submissions: ['SUBMISSIONS OPEN', '/studio', 's0'],
  review: ['IN REVIEW', '/topics#cycle', 's1'],
  voting: ['VOTING NOW', '/battle', 's2'],
  printing: ['PRINTING', '/shop?collection=new', 's3'],
};
const pad = (n: number) => String(n).padStart(3, '0');

export function TopicsView() {
  const { state, toggleReminder } = useStore();
  const { stages, openTopic, archive, battle, mode } = useCatalog();
  const router = useRouter();
  const now = useNow(60_000);
  const reminded = state.reminders.includes('next-topic');
  const istDay = now ? new Date(now + 5.5 * 3_600_000).getUTCDay() : 4;
  const week: [string, string][] = [['MON', 'Vote opens'], ['TUE', 'Voting'], ['WED', 'Voting'], ['THU', 'Closes 9 PM'], ['FRI', `Top ${battle.winners} print`], ['SAT', 'In production'], ['SUN', 'Next tease']];
  const today = (istDay + 6) % 7;

  const note = (st: Stage) => {
    const left = st.at && now ? dh(st.at - now) : null;
    switch (st.phase) {
      case 'submissions': {
        const entries = (openTopic?.entries ?? 0) + (mode === 'demo' ? state.submissions.length : 0);
        return left ? `${left} left · ${entries} entries` : `${entries} entries`;
      }
      case 'review': return 'Finalists Mon 10 AM';
      case 'voting': return left ? `Closes Thu, 9 PM · ${left}` : 'Closes Thu, 9 PM';
      default: return 'Ships this week';
    }
  };

  return (
    <div className="page-width topics">
      <div className="page-title"><p className="eyebrow">THE CLUB NEVER SLEEPS (EVEN IF YOU DO)</p><h1>Four drops. Four stages.</h1><p className="muted">While one idea becomes a tee, the next one is already brewing.</p></div>
      <div className="stage-grid">
        {stages.map((st) => {
          const [label, href, c] = PHASE[st.phase];
          return (
            <article key={st.drop} className={`stage ${c}`} onClick={() => router.push(href)}>
              <span>DROP {pad(st.drop)}</span><em>{label}</em><h2><Link href={href} onClick={(e) => e.stopPropagation()}>{st.title}</Link></h2><p>{note(st)}</p><Icon name="arrow" />
            </article>
          );
        })}
        <article className="stage next"><span>NEXT TOPIC</span><h2>Mon<br />10 AM</h2><p>Fresh brief, every week.</p><Btn v="yellow" onClick={() => toggleReminder('next-topic')}>{reminded ? '✓ Reminder set' : 'Set a reminder'}</Btn></article>
      </div>
      <section className="week" id="cycle">
        <div><p className="eyebrow">THIS WEEK</p><h2>The drop cycle</h2></div>
        {week.map(([d, t], i) => <article key={d} className={i === today ? 'on' : ''} aria-current={i === today ? 'date' : undefined}><b>{d}</b><span>{t}</span></article>)}
      </section>
      <SectionHead eyebrow="DROP ARCHIVE" title="Past battles, permanent winners" />
      {archive.length ? (
        <div className="archive">
          {archive.map((a) => (
            <article key={a.drop}>
              <div><span>DROP {pad(a.drop)}</span><h3>{a.title}</h3></div>
              <div className="arch-thumbs">{a.thumbs.map((src, n) => <Photo key={n} src={src} alt="" />)}</div>
              <span className="muted">{num(a.votes)} votes</span>
              <Link className="link" href="/shop">See winners →</Link>
            </article>
          ))}
        </div>
      ) : <Empty title="The first battle is still to come." body="Winners from every finished drop land here." />}
    </div>
  );
}
