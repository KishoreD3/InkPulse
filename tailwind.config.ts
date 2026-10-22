import type { Config } from 'tailwindcss';

/**
 * INKPULSE store theme (from the Figma Make "E-commerce web app INKPULSE" file):
 * white pages, near-black ink, one loud yellow, red only for LIVE, green for savings.
 *
 * The old neo-brutal token names are kept as aliases so every screen picks up the
 * new theme without a rewrite: `pink` and `acid` are now the brand yellow, `cobalt`
 * is the live red, and `border-ink` draws a hairline instead of a 2px black rule.
 */
const yellow = '#FFD232';
const red = '#E53935';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#11120F',
        paper: '#FFFFFF',
        card: '#FFFFFF',
        cream: '#F6F5EF',
        soft: '#F7F7F4',
        line: '#E7E7E2',
        yellow: { DEFAULT: yellow, soft: '#FFF4C7' },
        red: { DEFAULT: red, soft: '#FDECEC' },
        green: { DEFAULT: '#1E9E5A', soft: '#EAF8EF' },
        // legacy aliases
        pink: { DEFAULT: yellow, soft: '#FFE58A' },
        acid: yellow,
        cobalt: { DEFAULT: red, soft: '#FDECEC' },
        muted: '#6F716B',
        body: '#3D3E39',
        mist: '#B9BAB4',
        haze: '#F2F2EE',
      },
      borderColor: {
        // `border-ink` used to be the brutalist 2px black rule; it is now the hairline.
        ink: '#E7E7E2',
        strong: '#11120F',
      },
      borderWidth: {
        2: '1px',
        3: '2px',
      },
      fontFamily: {
        display: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        marker: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        hard: '0 1px 2px rgb(17 18 15 / 0.05), 0 6px 18px -8px rgb(17 18 15 / 0.12)',
        'hard-sm': '0 1px 2px rgb(17 18 15 / 0.06)',
        'hard-lg': '0 2px 4px rgb(17 18 15 / 0.05), 0 18px 40px -16px rgb(17 18 15 / 0.22)',
        'hard-pink': '0 18px 40px -16px rgb(17 18 15 / 0.35)',
        lift: '0 12px 30px -12px rgb(17 18 15 / 0.25)',
      },
      keyframes: {
        tick: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        pop: { '0%': { transform: 'scale(0.9)' }, '60%': { transform: 'scale(1.06)' }, '100%': { transform: 'scale(1)' } },
        pulse: { '0%,100%': { boxShadow: '0 0 0 3px rgb(229 57 53 / 0.18)' }, '50%': { boxShadow: '0 0 0 6px rgb(229 57 53 / 0.05)' } },
      },
      animation: {
        tick: 'tick 32s linear infinite',
        pop: 'pop 220ms ease-out',
        live: 'pulse 1.7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
