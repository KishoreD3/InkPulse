'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BATTLE, OPEN_TOPIC, archive, img, num } from '@/lib/dnd/catalog';
import { dh, submissionsCloseAt, votingClosesAt } from '@/lib/dnd/cycle';
import { useNow, useStore } from '@/lib/dnd/store';
import { Btn, Icon, Photo, SectionHead } from '../ui';

export function TopicsView() {
  const { state, update, toast } = useStore();
  const router = useRouter();
  const now = useNow(60_000);
  const reminded = state.reminders.includes('next-topic');
  const closes = now ? votingClosesAt(now) : null;
  const istDay = now ? new Date(now + 5.5 * 3_600_000).getUTCDay() : 4;
  const week: [string, string][] = [['MON', 'Vote opens'], ['TUE', 'Voting'], ['WED', 'Voting'], ['THU', 'Closes 9 PM'], ['FRI', 'Top 3 print'], ['SAT', 'In production'], ['SUN', 'Next tease']];
  const today = (istDay + 6) % 7;

  const stages: [string, string, string, string, string, string][] = [
    [`0${OPEN_TOPIC.drop}`, OPEN_TOPIC.title, 'SUBMISSIONS OPEN', now ? `${dh(submissionsCloseAt(now) - now)} left · ${OPEN_TOPIC.entries + state.submissions.length} entries` : `${OPEN_TOPIC.entries} entries`, '/studio', 's0'],
    ['045', 'Night Shift', 'IN REVIEW', 'Finalists Mon 10 AM', '/topics#cycle', 's1'],
    [`0${BATTLE.drop}`, BATTLE.topic, 'VOTING NOW', closes && now ? `Closes Thu, 9 PM · ${dh(closes - now)}` : 'Closes Thu, 9 PM', '/battle', 's2'],
    ['043', 'Future Folklore', 'PRINTING', 'Ships this week', '/shop?collection=new', 's3'],
  ];
  const remind = () => {
    update({ reminders: reminded ? state.reminders.filter((r) => r !== 'next-topic') : [...state.reminders, 'next-topic'] });
    if (!reminded) toast('Reminder set', 'We’ll nudge you Monday at 10 AM. Only this once.');
  };

  return (
    <div className="page-width topics">
      <div className="page-title"><p className="eyebrow">THE CLUB NEVER SLEEPS (EVEN IF YOU DO)</p><h1>Four drops. Four stages.</h1><p className="muted">While one idea becomes a tee, the next one is already brewing.</p></div>
      <div className="stage-grid">
        {stages.map(([n, t, s, d, href, c]) => (
          <article key={n} className={`stage ${c}`} onClick={() => router.push(href)}>
            <span>DROP {n}</span><em>{s}</em><h2><Link href={href} onClick={(e) => e.stopPropagation()}>{t}</Link></h2><p>{d}</p><Icon name="arrow" />
          </article>
        ))}
        <article className="stage next"><span>NEXT TOPIC</span><h2>Mon<br />10 AM</h2><p>Fresh brief, every week.</p><Btn v="yellow" onClick={remind}>{reminded ? '✓ Reminder set' : 'Set a reminder'}</Btn></article>
      </div>
      <section className="week" id="cycle">
        <div><p className="eyebrow">THIS WEEK</p><h2>The drop cycle</h2></div>
        {week.map(([d, t], i) => <article key={d} className={i === today ? 'on' : ''} aria-current={i === today ? 'date' : undefined}><b>{d}</b><span>{t}</span></article>)}
      </section>
      <SectionHead eyebrow="DROP ARCHIVE" title="Past battles, permanent winners" />
      <div className="archive">
        {archive.map((a) => (
          <article key={a.drop}>
            <div><span>DROP 0{a.drop}</span><h3>{a.title}</h3></div>
            <div className="arch-thumbs">{[1, 2, 3].map((n) => <Photo key={n} src={img.archive(a.drop, n)} alt="" />)}</div>
            <span className="muted">{num(a.votes)} votes</span>
            <Link className="link" href="/shop">See winners →</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
