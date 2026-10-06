import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { TabBar } from '@/components/TabBar';
import { Footer } from '@/components/Footer';
import { PwaRegister } from '@/components/PwaRegister';
import { Toaster } from '@/components/Toaster';
import { getSession } from '@/lib/auth';
import { isConfigured, publicEnv } from '@/lib/env';
import { SetupNotice } from '@/components/SetupNotice';

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
  themeColor: '#111111',
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

  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Permanent+Marker&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap"
        />
      </head>
      <body className="min-h-screen flex flex-col pb-[84px] md:pb-0">
        <a href="#main" className="sr-only-focusable fixed top-2 left-2 z-50 btn-white">Skip to content</a>
        {!configured && <SetupNotice />}
        <Header
          signedIn={Boolean(session)}
          handle={session?.profile.handle}
          isAdmin={Boolean(session?.profile.is_admin)}
          isArtist={Boolean(session?.profile.is_artist)}
          unread={unread}
        />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
        <TabBar />
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
