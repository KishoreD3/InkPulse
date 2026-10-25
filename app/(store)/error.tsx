'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page-width section">
      <div className="empty">
        <span>🌀</span>
        <h3>Misprint.</h3>
        <p className="muted">Something went wrong loading this page.</p>
        <button className="btn btn-dark" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
