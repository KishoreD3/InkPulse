import { redirect } from 'next/navigation';
import { SignInView } from '@/components/dnd/views/SignIn';
import { getStoreSession } from '@/lib/dnd/session';
import { isConfigured } from '@/lib/env';

export const metadata = { title: 'Sign in' };

const ERRORS: Record<string, string> = {
  banned: 'This account has been suspended. Write to us if you think that’s a mistake.',
  callback: 'That sign-in link didn’t work or has expired. Try again.',
};

export default async function SignInPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const raw = searchParams.next ?? '/account';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account';
  if (await getStoreSession()) redirect(next);
  const error = searchParams.error ? ERRORS[searchParams.error] ?? 'Sign-in failed. Please try again.' : null;
  return <SignInView next={next} error={error} configured={isConfigured()} />;
}
