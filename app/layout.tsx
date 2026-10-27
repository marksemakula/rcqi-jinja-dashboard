import type { Metadata, Viewport } from 'next';
import '@fontsource/ubuntu/300.css';
import '@fontsource/ubuntu/400.css';
import '@fontsource/ubuntu/500.css';
import '@fontsource/ubuntu/700.css';
import '@fontsource/ubuntu/400-italic.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'CQI Dashboard | Jinja Regional Referral Hospital',
  description: 'Continuous Quality Improvement (CQI) dashboard for Jinja Regional Referral Hospital: patient safety, hand hygiene, infection prevention and control, 5S and HFQAP.',
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
      <body>{children}</body>
    </html>
  );
}
