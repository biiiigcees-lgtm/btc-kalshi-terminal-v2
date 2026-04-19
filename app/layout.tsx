// /app/layout.tsx
import type { Metadata } from 'next';
import { JetBrains_Mono, Syne } from 'next/font/google';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KALSHI · BTC · INTELLIGENCE',
  description: 'Professional Kalshi BTC 15-Minute Prediction Market Terminal',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${syne.variable}`}>
      <body className="bg-[#0a0a0f] text-[#e8e8f0] overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
