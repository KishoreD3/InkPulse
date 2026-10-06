import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data';
import { getSession } from '@/lib/auth';
import { dropPhase, getPipeline, topicTitle } from '@/lib/topics';
import { dayTime, daysUntil, dropLabel, num } from '@/lib/format';
import { CycleTimeline } from '@/components/CycleTimeline';
import { Countdown } from '@/components/Countdown';
import type { Drop, DropTopic } from '@/lib/types';

export const metadata = { title: 'Topics', description: 'A new topic every Monday. Artists answer it, the crowd votes, the best get printed.' };
export const dynamic = 'force-dynamic';

export default async function TopicsPage() {
  const [pipeline, settings, session] = await Promise.all([getPipeline(), getSettings(), getSession()]);
  const supabase = createClient();
  const counts = new Map<string, number>(await Promise.all(pipeline.map(async (d) => {
    const { data } = await supabase.rpc('topic_submission_count', { p_drop: d.id });
    return [d.id, (data as number) ?? 0] as [string, number];
  })));
  const { data: past } = await supabase.from('drops').select('*').in('status', ['locked', 'printing', 'shipped'])
    .order('number', { ascending: false }).limit(8);
  const pastDrops = (past ?? []) as Drop[];
  const { data: pastTopics } = pastDrops.length
    ? await supabase.from('drop_topics').select('*').in('drop_id', pastDrops.map((d) => d.id))
    : { data: [] };
  const pastByDrop = new Map(((pastTopics ?? []) as DropTopic[]).map((t) => [t.drop_id, t]));
  const isArtist = Boolean(session?.profile.is_artist);
  const submitHref = (dropId: string) => (isArtist ? `/submit?topic=${dropId}` : session ? '/submit/become-artist' : `/signin?next=/submit?topic=${dropId}`);

  return (
    <div className="container-page py-8 flex flex-col gap-8">
      <header className="flex flex-col gap-3 max-w-3xl">
        <h1 className="h-display text-[clamp(52px,8vw,96px)] leading-[0.9] misprint">Topics</h1>
        <p className="text-lg text-body">
          A new topic every Monday at {settings.topic_time.slice(0, 5)} IST. Artists get about {settings.topic_lead_days - settings.review_days - 2} days to answer it,
          we review for originality, then you vote Monday to Thursday. The top {settings.winners_per_drop} print on Friday.
        </p>
      </header>

      {pipeline.map((d) => {
        const phase = dropPhase(d);
        const n = counts.get(d.id) ?? 0;
        if (phase === 'upcoming') {
          return (
            <section key={d.id} className="border-2 border-dashed border-ink rounded-[22px] p-5 md:p-7 flex flex-col gap-3">
              <p className="label-mono">{dropLabel(d.number)} · topic reveal</p>
              <p className="h-display text-[clamp(36px,5vw,56px)] leading-none">??? </p>
              <p className="text-body">Revealed {dayTime(d.topic_at)} IST. Turn on notifications to hear it first.</p>
              <CycleTimeline drop={d} phase={phase} />
            </section>
          );
        }
        if (phase === 'submissions') {
          return (
            <section key={d.id} className="bg-acid border-2 border-ink rounded-[22px] shadow-hard p-5 md:p-7 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="sticker bg-ink text-acid">{dropLabel(d.number)} · OPEN FOR SUBMISSIONS</span>
                <span className="label-mono">{num(n)} design{n === 1 ? '' : 's'} in so far</span>
              </div>
              <h2 className="h-display text-[clamp(44px,7vw,88px)] leading-[0.9] uppercase">{topicTitle(d.topic)}</h2>
              {d.topic?.brief && <p className="text-lg max-w-3xl leading-relaxed">{d.topic.brief}</p>}
              {d.topic?.prompts.length ? (
                <div className="flex flex-wrap gap-2" aria-label="Ideas to start from">
                  {d.topic.prompts.map((p) => <span key={p} className="chip bg-card">{p}</span>)}
                </div>
              ) : null}
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="label-mono">Submissions close {dayTime(d.submissions_close_at)} IST</p>
                  <Countdown to={d.submissions_close_at} className="font-display text-[48px] leading-none" unitsClassName="font-mono text-[10px] tracking-[3px]" />
                </div>
                <Link href={submitHref(d.id)} className="btn-pink !min-h-[56px] !text-xl">Submit for this topic</Link>
              </div>
              <p className="text-sm">Up to {settings.max_designs_per_artist} designs per artist. Originals only — every entry is checked before it reaches the vote.</p>
              <CycleTimeline drop={d} phase={phase} />
            </section>
          );
        }
        return (
          <section key={d.id} className={`border-2 border-ink rounded-[22px] p-5 md:p-7 flex flex-col gap-3 ${phase === 'voting' ? 'bg-ink text-haze halftone-dark shadow-hard-pink' : 'card'}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`sticker ${phase === 'voting' ? 'bg-pink' : 'bg-card'}`}>
                {dropLabel(d.number)} · {phase === 'voting' ? 'VOTING NOW' : 'IN REVIEW'}
              </span>
              <span className={`label-mono ${phase === 'voting' ? 'text-mist' : 'text-muted'}`}>{num(n)} designs answered this topic</span>
            </div>
            <h2 className={`h-display text-[clamp(36px,5vw,64px)] leading-[0.9] uppercase ${phase === 'voting' ? 'text-acid' : ''}`}>{topicTitle(d.topic)}</h2>
            {phase === 'voting'
              ? <p>Voting locks {dayTime(d.locks_at)} IST. <Link href="/#board" className="font-bold underline text-acid">Vote now</Link></p>
              : <p className="text-body">Submissions are closed and under review. Voting opens {dayTime(d.opens_at)} IST{daysUntil(d.opens_at) ? ` — in ${daysUntil(d.opens_at)} days` : ''}.</p>}
            <CycleTimeline drop={d} phase={phase} dark={phase === 'voting'} />
          </section>
        );
      })}

      {pastDrops.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="h-display text-3xl">Past topics</h2>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {pastDrops.map((d) => (
              <Link key={d.id} href={`/drops/${d.number}`} className="card p-4 flex flex-col gap-1 shadow-hard-sm">
                <span className="label-mono text-muted">{dropLabel(d.number)}</span>
                <span className="font-display text-2xl uppercase leading-none">{topicTitle(pastByDrop.get(d.id))}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
