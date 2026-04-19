/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Syne', 'sans-serif'],
      },
      colors: {
        base: '#0a0a0f',
        panel: '#111118',
        elevated: '#0d0d14',
        border: '#1e1e2e',
        primary: '#e8e8f0',
        secondary: '#666680',
        muted: '#333350',
        blue: '#4488ff',
        green: '#00ff88',
        red: '#ff4466',
        amber: '#ffaa00',
        purple: '#aa44ff',
      },
    },
  },
  plugins: [],
};
