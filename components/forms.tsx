'use client';
import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { toast } from './Toaster';

type Result = { ok: boolean; error?: string } | null;
type Action = (state: Result, form: FormData) => Promise<Result>;

export function SubmitButton({ children, className = 'btn-pink' }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? 'Saving…' : children}</button>;
}

/** A form bound to a server action that returns { ok, error }, with toast feedback. */
export function ActionForm({ action, children, className, success = 'Saved.' }: {
  action: Action; children: React.ReactNode; className?: string; success?: string;
}) {
  const [state, formAction] = useFormState(action, null);
  useEffect(() => {
    if (!state) return;
    toast(state.ok ? { message: success } : { message: state.error ?? 'Something went wrong.', tone: 'error' });
  }, [state, success]);
  return <form action={formAction} className={className}>{children}</form>;
}

export function Field({ label, name, defaultValue, placeholder, type = 'text', required, hint, inputMode, maxLength }: {
  label: string; name: string; defaultValue?: string | null; placeholder?: string; type?: string; required?: boolean;
  hint?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="field-label">{label}</label>
      <input id={name} name={name} type={type} className="input" defaultValue={defaultValue ?? ''} placeholder={placeholder}
        required={required} inputMode={inputMode} maxLength={maxLength} />
      {hint && <p className="text-xs text-muted pt-1">{hint}</p>}
    </div>
  );
}
