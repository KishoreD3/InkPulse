import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-page py-20 text-center flex flex-col items-center gap-4">
      <h1 className="h-display text-[96px] leading-none misprint">404</h1>
      <p className="text-body">That page didn&apos;t make the cut.</p>
      <Link href="/" className="btn-pink">Back to the live drop</Link>
    </div>
  );
}
