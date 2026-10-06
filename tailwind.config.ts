import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        paper: '#E4DEFF',
        card: '#FFFFFF',
        pink: { DEFAULT: '#FF3EA5', soft: '#FF6FBC' },
        acid: '#E4FF3B',
        cobalt: { DEFAULT: '#2F4BFF', soft: '#E4E8FF' },
        muted: '#4E4A66',
        body: '#36324D',
        mist: '#B8B3CF',
        haze: '#E5E1F5',
      },
      fontFamily: {
        display: ['Anton', 'Impact', 'sans-serif'],
        marker: ['"Permanent Marker"', 'cursive'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        hard: '4px 4px 0 #111111',
        'hard-sm': '2px 2px 0 #111111',
        'hard-lg': '6px 6px 0 #111111',
        'hard-pink': '5px 5px 0 #FF3EA5',
      },
      keyframes: {
        tick: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        pop: { '0%': { transform: 'scale(0.9)' }, '60%': { transform: 'scale(1.06)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        tick: 'tick 26s linear infinite',
        pop: 'pop 220ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
