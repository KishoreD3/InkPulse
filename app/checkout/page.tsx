import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data';
import { CheckoutClient } from './CheckoutClient';
import { describeCode, myRewardCodes } from '@/lib/discounts';
import type { Address, Design, PriceType } from '@/lib/types';

export const metadata = { title: 'Checkout' };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const mode = searchParams.from === 'bag' ? 'bag' : 'back';
  const qs = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]).toString();
  const session = await requireSession(`/checkout?${qs}`);
  const supabase = createClient();
  const [settings, { data: addresses }, rewards] = await Promise.all([
    getSettings(),
    supabase.from('addresses').select('*').order('is_default', { ascending: false }),
    myRewardCodes(session.user.id),
  ]);

  let backing: { design: Design; price: number; priceType: PriceType } | null = null;
  if (mode === 'back') {
    const { data: d } = await supabase.from('designs').select('*').eq('slug', searchParams.design ?? '').maybeSingle();
    if (!d) return <Gone />;
    const { data: q } = await supabase.rpc('price_quote', { p_design: d.id });
    const quote = (q as { price: number; price_type: PriceType; order_type: string }[] | null)?.[0];
    if (!quote || quote.order_type !== 'backing') return <Gone />;
    backing = { design: d as Design, price: quote.price, priceType: quote.price_type };
  }

  return (
    <div className="container-page py-6 max-w-3xl">
      <h1 className="h-display text-[40px] misprint pb-5">{mode === 'back' ? 'Back this drop' : 'Checkout'}</h1>
      <CheckoutClient
        mode={mode}
        addresses={(addresses ?? []) as Address[]}
        backing={backing ? {
          design: { id: backing.design.id, slug: backing.design.slug, name: backing.design.name, colours: backing.design.colours, art_front_url: backing.design.art_front_url },
          price: backing.price, priceType: backing.priceType,
          colour: searchParams.colour ?? backing.design.colours[0]?.name ?? '',
          size: searchParams.size ?? 'L',
          qty: Math.min(5, Math.max(1, Number(searchParams.qty) || 1)),
        } : null}
        initialCode={searchParams.code ?? null}
        rewards={rewards.map((r) => ({ code: r.code, label: describeCode(r) }))}
        settings={{ retail_price: settings.retail_price, shipping_fee: settings.shipping_fee, free_shipping_over: settings.free_shipping_over, artist_pct: settings.artist_pct, gst_pct: settings.gst_pct, sizes: settings.sizes }}
      />
    </div>
  );
}

function Gone() {
  return (
    <div className="container-page py-16 max-w-xl text-center">
      <h1 className="h-display text-5xl">Not open for backing</h1>
      <p className="pt-3 text-body">Voting for this design has locked or it is not live. Check the current drop.</p>
      <Link href="/" className="btn-pink mt-6">See the live drop</Link>
    </div>
  );
}
