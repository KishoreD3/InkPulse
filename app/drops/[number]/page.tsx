import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDropDesigns } from '@/lib/data';
import { dateShort, dropLabel } from '@/lib/format';
import { Tee, colourway, tileFor } from '@/components/Tee';
import type { Drop } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DropResults({ params }: { params: { number: string } }) {
  const { data } = await createClient().from('drops').select('*').eq('number', Number(params.number)).maybeSingle();
  if (!data) notFound();
  const drop = data as Drop;
  const designs = await getDropDesigns(drop.id);
  return (
    <div className="container-page py-6 flex flex-col gap-6">
      <h1 className="h-display text-[48px] misprint">{dropLabel(drop.number)} results</h1>
      <p className="label-mono">Opened {dateShort(drop.opens_at)} · {drop.status}</p>
      <ol className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {designs.map((d, i) => {
          const c = colourway(d); const t = tileFor(d.slug);
          return (
            <li key={d.id}>
              <Link href={`/d/${d.slug}`} className={`card p-3 flex flex-col gap-2 ${d.status === 'won' ? 'shadow-hard-lg' : ''}`}>
                <span className={`relative h-[200px] border-2 border-ink rounded-xl grid place-items-center ${t.dark ? 'halftone-dark' : 'halftone-light'}`} style={{ backgroundColor: t.bg }}>
                  <Tee shirt={c.hex} art={c.art} size={180} />
                  <span className="absolute top-2 left-2 w-11 h-11 rounded-full border-2 border-ink bg-acid grid place-items-center font-display">#{d.final_rank ?? i + 1}</span>
                </span>
                <span className="font-display text-xl uppercase">{d.name}</span>
                <span className="font-mono text-[11px]">{d.vote_count.toLocaleString('en-IN')} VOTES · {d.status === 'won' ? 'PRINTED' : d.status === 'lost' ? 'DID NOT PRINT' : 'LIVE'}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
