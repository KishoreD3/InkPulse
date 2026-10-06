'use client';
import { useId } from 'react';

const BODY =
  'M72 24 C80 31 90 34 100 34 C110 34 120 31 128 24 L157 33 C166 36 172 41 176 48 L191 84 C183 89 174 92 165 93 L156 73 C155 100 156 140 158 186 C120 190 80 190 42 186 C44 140 45 100 44 73 L35 93 C26 92 17 89 9 84 L24 48 C28 41 34 36 43 33 Z';
const NECK = 'M72 24 C82 16 118 16 128 24 C120 31 110 34 100 34 C90 34 80 31 72 24Z';

/**
 * Photo-style tee mockup: the artwork is printed into the chest area and the
 * fabric shading (folds, highlights, cotton grain) sits on top of the print.
 * Artwork can be any PNG/SVG; it is fitted into a 76×112 chest print area.
 */
export function Tee({
  shirt = '#E4FF3B',
  art,
  size = 200,
  label,
  className,
}: {
  shirt?: string;
  art?: string | null;
  size?: number | string;
  label?: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const id = (k: string) => `${k}-${uid}`;
  return (
    <svg
      viewBox="0 0 200 200"
      width={typeof size === 'number' ? size : undefined}
      height={typeof size === 'number' ? size : undefined}
      style={typeof size === 'string' ? { width: size, height: 'auto', aspectRatio: '1 / 1' } : undefined}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <filter id={id('drop')} x="-25%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000" floodOpacity="0.32" />
        </filter>
        <clipPath id={id('body')}><path d={BODY} /></clipPath>
        <linearGradient id={id('side')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.3" />
          <stop offset="0.24" stopColor="#000" stopOpacity="0" />
          <stop offset="0.76" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={id('top')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.82" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
        <filter id={id('blur')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <filter id={id('tex')} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves={2} seed={7} />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.1 0" />
        </filter>
      </defs>

      <path d={NECK} fill={shirt} />
      <path d={NECK} fill="#000" opacity="0.38" />
      <path d={BODY} fill={shirt} filter={`url(#${id('drop')})`} />

      {art ? (
        <image href={art} x="62" y="52" width="76" height="112" preserveAspectRatio="xMidYMin meet" opacity="0.95" />
      ) : null}

      <g clipPath={`url(#${id('body')})`} pointerEvents="none">
        <rect width="200" height="200" fill={`url(#${id('side')})`} />
        <rect width="200" height="200" fill={`url(#${id('top')})`} />
        <g filter={`url(#${id('blur')})`} fill="#000" opacity="0.2">
          <path d="M44 74 C57 86 63 101 65 120 C60 105 52 93 44 87Z" />
          <path d="M156 74 C143 86 137 101 135 120 C140 105 148 93 156 87Z" />
          <path d="M66 172 C88 161 112 163 136 173 C112 168 88 168 66 176Z" />
          <path d="M28 54 C32 66 35 78 37 91 L32 93 C30 79 28 66 28 54Z" />
          <path d="M172 54 C168 66 165 78 163 91 L168 93 C170 79 172 66 172 54Z" />
          <path d="M120 130 C128 145 132 160 132 182 C126 162 122 148 116 136Z" />
        </g>
        <g filter={`url(#${id('blur')})`} fill="#fff" opacity="0.16">
          <path d="M80 42 C92 48 108 48 120 42 C112 54 88 54 80 42Z" />
          <path d="M58 118 C62 138 63 158 61 178 C67 158 67 138 63 118Z" />
          <path d="M146 46 C156 52 164 62 170 76 C160 66 152 58 146 52Z" />
        </g>
        <rect width="200" height="200" filter={`url(#${id('tex')})`} />
      </g>
      <g fill="none" stroke="#000" pointerEvents="none">
        <path d="M72 24 C80 31 90 34 100 34 C110 34 120 31 128 24" strokeOpacity="0.24" strokeWidth="3.4" />
        <path d="M74 26.5 C81 32.5 90 36 100 36 C110 36 119 32.5 126 26.5" strokeOpacity="0.12" strokeWidth="0.8" strokeDasharray="1.2 1.2" />
        <path d="M12 81 C20 86 28 89 36 90" strokeOpacity="0.2" strokeWidth="0.9" />
        <path d="M188 81 C180 86 172 89 164 90" strokeOpacity="0.2" strokeWidth="0.9" />
        <path d="M43 181 C80 185 120 185 157 181" strokeOpacity="0.2" strokeWidth="0.9" />
      </g>
    </svg>
  );
}

/** Pick the shirt colour + artwork for a colourway (falls back to the first colour). */
export function colourway(design: { colours: { name: string; hex: string; art?: string }[]; art_front_url: string }, name?: string) {
  const c = design.colours.find((x) => x.name === name) ?? design.colours[0] ?? { name: 'Default', hex: '#FFFFFF' };
  return { name: c.name, hex: c.hex, art: c.art || design.art_front_url };
}

/** Tile background colours rotate per design so the board feels like a print wall. */
const TILES = [
  { bg: '#FF3EA5', dark: false },
  { bg: '#E4FF3B', dark: false },
  { bg: '#111111', dark: true },
  { bg: '#BFEBD6', dark: false },
  { bg: '#2F4BFF', dark: true },
  { bg: '#FFFFFF', dark: false },
];
export function tileFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TILES[h % TILES.length];
}
