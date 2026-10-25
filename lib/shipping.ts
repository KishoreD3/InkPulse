import 'server-only';
// Delivery estimate for a PIN code. Tees print in Tamil Nadu, so the estimate grows with distance.
// The place name comes from India Post's public PIN code directory. To use your courier's own
// serviceability API instead (Shiprocket, Delhivery…), replace checkPincode below; the store
// only needs { ok, place, minDays, maxDays }.

export type PincodeCheck = { ok: boolean; place: string | null; minDays: number; maxDays: number };

/** Days in transit after printing, by the first digits of the PIN (postal region). */
function transit(pin: string): [number, number] {
  const two = Number(pin.slice(0, 2));
  if (two >= 60 && two <= 64) return [2, 3];               // Tamil Nadu & Puducherry
  if ((two >= 50 && two <= 59) || (two >= 67 && two <= 69)) return [3, 5]; // rest of the south
  if (two >= 78 && two <= 79) return [6, 9];               // North East
  if (two === 18 || two === 19 || two === 74) return [6, 8]; // J&K, Ladakh, Andaman
  return [4, 7];
}

export async function checkPincode(pin: string): Promise<PincodeCheck> {
  const [minDays, maxDays] = transit(pin);
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { next: { revalidate: 60 * 60 * 24 * 30 }, signal: AbortSignal.timeout(4000) });
    const json = (await res.json()) as { Status: string; PostOffice: { Name: string; District: string; State: string }[] | null }[];
    const po = json?.[0]?.PostOffice?.[0];
    if (json?.[0]?.Status === 'Error' || (json?.[0] && !po)) return { ok: false, place: null, minDays, maxDays };
    return { ok: true, place: po ? `${po.Name}, ${po.District}` : null, minDays, maxDays };
  } catch {
    // Directory unreachable: still give the regional estimate.
    return { ok: true, place: null, minDays, maxDays };
  }
}
