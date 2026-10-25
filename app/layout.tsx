import type { Metadata, Viewport } from 'next';
import { publicEnv } from '@/lib/env';
import { PwaRegister } from '@/components/PwaRegister';

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: 'The DND Club — Dressed, not disturbed', template: '%s · The DND Club' },
  description: 'Crowd-picked graphic tees by independent Indian artists. Vote free, back a design at ₹899 and pay only if it prints.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/favicon-32.png', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'DND Club', statusBarStyle: 'default' },
  openGraph: { type: 'website', siteName: 'The DND Club', images: ['/icons/icon-512.png'] },
};

export const viewport: Viewport = {
  themeColor: '#6C4BFF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Applies the saved DND (night) mode before first paint so the page never flashes cream.
const nightScript = `try{if(localStorage.getItem('dnd-night')==='1')document.documentElement.classList.add('night')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: nightScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap"
        />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
