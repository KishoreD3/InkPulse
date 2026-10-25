import './ops.css';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/SetupNotice';
import { Toaster } from '@/components/Toaster';

// The ops console (admin + sign-in) keeps its own Tailwind styling, separate from the storefront.
// Links back to the store are plain <a> tags so the store loads with only its own stylesheet.
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ops min-h-screen flex flex-col bg-paper text-ink font-sans">
      {!isConfigured() && <SetupNotice />}
      <header className="border-b-2 border-ink bg-card">
        <div className="container-page h-14 flex items-center justify-between">
          <a href="/" className="font-display text-2xl uppercase tracking-wide">The DND Club · Ops</a>
          <a href="/" className="text-sm font-bold underline">Back to the store</a>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <Toaster />
    </div>
  );
}
