import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
import { Header } from '@/components/Header';
import { TabBar } from '@/components/TabBar';
import { Footer } from '@/components/Footer';
import { PwaRegister } from '@/components/PwaRegister';
import { Toaster } from '@/components/Toaster';
import { getSession } from '@/lib/auth';
import { getCurrentDrop, getSettings } from '@/lib/data';
import { getTopic, topicTitle } from '@/lib/topics';
import { isConfigured, publicEnv } from '@/lib/env';
import { SetupNotice } from '@/components/SetupNotice';
import { ReferralClaim } from '@/components/ReferralClaim';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: 'INKPULSE — The crowd prints', template: '%s · INKPULSE' },
  description: 'Weekly t-shirt drops voted by the community. Back early at ₹899 with UPI AutoPay — debited only if it prints.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/favicon-32.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'INKPULSE', statusBarStyle: 'black-translucent' },
  openGraph: { type: 'website', siteName: 'INKPULSE', images: ['/icons/icon-512.png'] },
};

export const viewport: Viewport = {
  themeColor: '#FFD232',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const configured = isConfigured();
  const session = configured ? await getSession().catch(() => null) : null;
  let unread = 0;
  if (session) {
    const { createClient } = await import('@/lib/supabase/server');
    const { count } = await createClient().from('notifications')
      .select('id', { count: 'exact', head: true }).is('read_at', null);
    unread = count ?? 0;
  }
  // Header strip: live topic + countdown, backer price and shop categories. Never block the page on it.
  const shell = configured
    ? await Promise.all([getSettings(), getCurrentDrop()])
        .then(async ([settings, drop]) => ({
          settings,
          drop: drop ? { live: drop.status === 'live', topic: topicTitle(await getTopic(drop.id)), locksAt: drop.locks_at } : null,
        }))
        .catch(() => null)
    : null;

  return (
    <html lang="en-IN">
      <body className="min-h-screen flex flex-col pb-[72px] md:pb-0">
        <a href="#main" className="sr-only-focusable fixed top-2 left-2 z-50 btn-white">Skip to content</a>
        {!configured && <SetupNotice />}
        <Header
          signedIn={Boolean(session)}
          handle={session?.profile.handle}
          isAdmin={Boolean(session?.profile.is_admin)}
          isArtist={Boolean(session?.profile.is_artist)}
          unread={unread}
          drop={shell?.drop}
          backerPrice={shell?.settings.backer_price}
          categories={shell?.settings.categories}
        />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
        <TabBar />
        <Toaster />
        <PwaRegister />
        {session && cookies().has('ink_ref') && <ReferralClaim />}
      </body>
    </html>
  );
}
