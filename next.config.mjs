/** @type {import('next').NextConfig} */
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co').hostname;
  } catch {
    return 'example.supabase.co';
  }
})();

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: supabaseHost }],
  },
  async redirects() {
    // Older links (some still sent in notifications) point at the pre-redesign routes.
    return [
      { source: '/causes', destination: '/artists', permanent: true },
      { source: '/d/:slug', destination: '/design/:slug', permanent: true },
      { source: '/a/:handle', destination: '/artists/:handle', permanent: true },
      { source: '/me', destination: '/account', permanent: true },
      { source: '/me/:path*', destination: '/account', permanent: true },
      { source: '/notifications', destination: '/account?tab=alerts', permanent: true },
      { source: '/submit', destination: '/studio', permanent: true },
      { source: '/submit/:path*', destination: '/studio', permanent: true },
      { source: '/pulse', destination: '/artists', permanent: false },
      { source: '/pulse/:path*', destination: '/artists', permanent: false },
    ];
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
