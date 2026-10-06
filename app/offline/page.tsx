export const metadata = { title: 'Offline' };
export const dynamic = 'force-dynamic';

export default function Offline() {
  return (
    <div className="container-page py-20 text-center flex flex-col items-center gap-4">
      <h1 className="h-display text-6xl misprint">You&apos;re offline</h1>
      <p className="text-body max-w-md">Vote counts need a connection. Reconnect and pull to refresh.</p>
    </div>
  );
}
