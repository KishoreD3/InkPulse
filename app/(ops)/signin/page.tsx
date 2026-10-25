import { SignInForm } from './SignInForm';

export const metadata = { title: 'Sign in' };

export default function SignInPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const next = searchParams.next && searchParams.next.startsWith('/') ? searchParams.next : '/';
  return (
    <div className="container-page py-10 md:py-16 max-w-lg">
      <h1 className="h-display text-[52px] misprint">Sign in</h1>
      <p className="pt-2 text-body">Vote, back designs and follow artists. Voting needs a verified Indian mobile number — one person, one vote.</p>
      {searchParams.error && (
        <p role="alert" className="mt-4 bg-pink border-2 border-ink rounded-xl p-3 font-semibold">
          {searchParams.error === 'banned' ? 'This account has been suspended.' : 'Sign-in failed. Please try again.'}
        </p>
      )}
      <SignInForm next={next} />
    </div>
  );
}
