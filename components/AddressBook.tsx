'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAddress, saveAddress } from '@/app/actions/profile';
import { ActionForm, Field, SubmitButton } from './forms';
import type { Address } from '@/lib/types';

export const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

export function AddressForm({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter();
  return (
    <ActionForm
      action={async (s, f) => { const r = await saveAddress(s, f); if (r.ok) { onSaved?.(); router.refresh(); } return r; }}
      className="grid gap-3 sm:grid-cols-2"
      success="Address saved."
    >
      <Field label="Full name" name="name" required />
      <Field label="Mobile" name="phone" inputMode="numeric" required placeholder="10 digits" />
      <div className="sm:col-span-2"><Field label="House, street" name="line1" required /></div>
      <div className="sm:col-span-2"><Field label="Area, landmark" name="line2" /></div>
      <Field label="PIN code" name="pin" inputMode="numeric" required maxLength={6} />
      <Field label="City" name="city" required />
      <div>
        <label htmlFor="state" className="field-label">State</label>
        <select id="state" name="state" className="input" defaultValue="Tamil Nadu" required>
          {STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <Field label="Label" name="label" defaultValue="Home" />
      <div className="sm:col-span-2"><SubmitButton className="btn-ink">Save address</SubmitButton></div>
    </ActionForm>
  );
}

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const [adding, setAdding] = useState(addresses.length === 0);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3">
      {addresses.map((a) => (
        <div key={a.id} className="flex items-start gap-3 border-2 border-ink rounded-xl p-3">
          <div className="flex-1 text-sm">
            <p className="font-bold">{a.label}{a.is_default && <span className="sticker bg-acid ml-2 !text-[10px] !py-0">Default</span>}</p>
            <p>{a.name} · {a.phone}</p>
            <p className="text-body">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pin}</p>
          </div>
          <button className="text-sm underline" onClick={async () => { await deleteAddress(a.id); router.refresh(); }}>Remove</button>
        </div>
      ))}
      {adding ? <AddressForm onSaved={() => setAdding(false)} /> : <button className="btn-white btn-sm self-start" onClick={() => setAdding(true)}>Add address</button>}
    </div>
  );
}
