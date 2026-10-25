import { NextResponse } from 'next/server';
import { checkPincode } from '@/lib/shipping';

export async function GET(request: Request) {
  const pin = new URL(request.url).searchParams.get('pin') ?? '';
  if (!/^[1-9]\d{5}$/.test(pin)) return NextResponse.json({ error: 'Enter a 6-digit PIN code.' }, { status: 400 });
  return NextResponse.json(await checkPincode(pin));
}
