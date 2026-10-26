import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RCQI Dashboard | Jinja Regional Referral Hospital',
  description: 'Regional Continuous Quality Improvement (RCQI) dashboard for Jinja Regional Referral Hospital: patient safety, hand hygiene, infection prevention and control, 5S and HFQAP.',
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  themeColor: '#3B4420',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Urbanist:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
