'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page py-20 text-center flex flex-col items-center gap-4">
      <h1 className="h-display text-6xl misprint">Misprint</h1>
      <p className="text-body">Something went wrong loading this page.</p>
      <button onClick={reset} className="btn-pink">Try again</button>
    </div>
  );
}
