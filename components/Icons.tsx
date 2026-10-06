type P = { size?: number; className?: string; filled?: boolean };
const base = (size = 22) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

export const Bolt = ({ size, className, filled }: P) => (
  <svg {...base(size)} className={className} fill={filled ? 'currentColor' : 'none'}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
);
export const Pulse = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
);
export const Heart = ({ size, className, filled }: P) => (
  <svg {...base(size)} className={className} fill={filled ? '#FF3EA5' : 'none'}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>
);
export const Bag = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>
);
export const Plus = ({ size, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={3}><path d="M12 5v14M5 12h14" /></svg>
);
export const Up = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={3}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
);
export const Search = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
);
export const Bell = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" /><path d="M10 21h4" /></svg>
);
export const Back = ({ size, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.6}><path d="M15 5l-7 7 7 7" /></svg>
);
export const Share = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3v13M7 8l5-5 5 5" /><path d="M5 13v6h14v-6" /></svg>
);
export const Comment = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 5h16v11H9l-5 4V5z" /></svg>
);
export const Repost = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M17 3l4 4-4 4" /><path d="M3 11V9a2 2 0 0 1 2-2h16" /><path d="M7 21l-4-4 4-4" /><path d="M21 13v2a2 2 0 0 1-2 2H3" /></svg>
);
export const Shield = ({ size, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.6}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
);
export const Lock = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
);
export const Pin = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 21s-7-6-7-12a7 7 0 0 1 14 0c0 6-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>
);
export const Scissors = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.5 7.5L20 18M8.5 16.5L20 6" /></svg>
);
export const Flag = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 21V4h11l-1.5 4L16 12H5" /></svg>
);
export const User = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
);
