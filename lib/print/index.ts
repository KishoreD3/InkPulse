import 'server-only';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/notify/dispatch';
import { publicEnv } from '@/lib/env';

export interface PrintLine {
  order_number: number;
  order_id: string;
  design_slug: string;
  design_name: string;
  artwork_url: string;
  shirt_colour: string;
  shirt_hex: string;
  size: string;
  qty: number;
  ship_name: string;
  ship_phone: string;
  ship_line1: string;
  ship_line2: string;
  ship_city: string;
  ship_state: string;
  ship_pin: string;
}

export interface PrintResult { mode: string; filePath?: string; partnerRef?: string }

const absolute = (url: string) => (url.startsWith('http') ? url : `${publicEnv.siteUrl.replace(/\/$/, '')}${url}`);

export function toCsv(lines: PrintLine[]): string {
  if (lines.length === 0) return '';
  const cols = Object.keys(lines[0]) as (keyof PrintLine)[];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...lines.map((l) => cols.map((c) => esc(c === 'artwork_url' ? absolute(String(l[c])) : l[c])).join(','))].join('\n');
}

/**
 * Hand a batch to the print partner.
 *  - csv:     saves the batch CSV to Storage (print-batches/) and emails ops a signed link.
 *  - webhook: POSTs JSON to PRINT_PARTNER_URL, signed with an HMAC of the body.
 *             Point this at a small adapter for Qikink/Printrove's order API once you
 *             have their API docs and credentials (their payload formats differ).
 */
export async function submitBatch(batchId: string, lines: PrintLine[]): Promise<PrintResult> {
  const mode = process.env.PRINT_PARTNER_MODE || 'csv';
  const admin = createAdminClient();

  if (mode === 'webhook') {
    const url = process.env.PRINT_PARTNER_URL;
    if (!url) throw new Error('PRINT_PARTNER_URL is not set');
    const body = JSON.stringify({ batch_id: batchId, lines: lines.map((l) => ({ ...l, artwork_url: absolute(l.artwork_url) })) });
    const sig = crypto.createHmac('sha256', process.env.PRINT_PARTNER_API_KEY || '').update(body).digest('hex');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.PRINT_PARTNER_API_KEY ?? ''}`, 'X-Inkpulse-Signature': sig },
      body,
    });
    if (!res.ok) throw new Error(`print partner ${res.status}: ${await res.text().catch(() => '')}`);
    const json = (await res.json().catch(() => ({}))) as { id?: string; reference?: string };
    return { mode, partnerRef: json.id ?? json.reference };
  }

  const path = `${new Date().toISOString().slice(0, 10)}/batch-${batchId}.csv`;
  const { error } = await admin.storage.from('print-batches').upload(path, new Blob([toCsv(lines)], { type: 'text/csv' }), { upsert: true });
  if (error) throw new Error(`csv upload: ${error.message}`);
  const { data: signed } = await admin.storage.from('print-batches').createSignedUrl(path, 60 * 60 * 24 * 7);
  if (process.env.PRINT_OPS_EMAIL) {
    const units = lines.reduce((s, l) => s + l.qty, 0);
    await sendEmail(process.env.PRINT_OPS_EMAIL, `Print batch ready · ${units} tees`,
      `A new INKPULSE print batch is ready (${units} tees, ${new Set(lines.map((l) => l.order_id)).size} orders).\n\nDownload CSV (valid 7 days): ${signed?.signedUrl ?? path}`).catch(() => {});
  }
  return { mode, filePath: path };
}
