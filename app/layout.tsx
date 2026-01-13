import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { I18nProvider } from '@/lib/i18n/context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Facturio - Facturation simplifiee',
  description: 'Gerez vos factures, devis et clients en toute simplicite',
  openGraph: {
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <I18nProvider>
          {children}
          <Toaster position="top-right" />
        </I18nProvider>
      </body>
    </html>
  );
}
