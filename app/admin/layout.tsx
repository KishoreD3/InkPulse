import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const NAV = [
  ['/admin', 'Dashboard'],
  ['/admin/submissions', 'Submissions'],
  ['/admin/drops', 'Drops'],
  ['/admin/orders', 'Orders & print'],
  ['/admin/returns', 'Returns'],
  ['/admin/codes', 'Codes & referrals'],
  ['/admin/causes', 'Causes & money'],
  ['/admin/payouts', 'Artist payouts'],
  ['/admin/moderation', 'Moderation'],
  ['/admin/users', 'Users'],
  ['/admin/settings', 'Settings'],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="container-page py-6 flex flex-wrap gap-6 items-start">
      <nav aria-label="Admin" className="flex-[1_1_200px] md:max-w-[220px] card p-3 flex md:flex-col gap-1 overflow-x-auto">
        <p className="label-mono text-cobalt px-2 pb-1 hidden md:block">Ops console</p>
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="px-3 py-2 rounded-lg font-semibold whitespace-nowrap hover:bg-acid">{label}</Link>
        ))}
      </nav>
      <div className="flex-[999_1_640px] min-w-0">{children}</div>
    </div>
  );
}
