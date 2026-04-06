import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ETHOLYS — Fábrica de Soluciones | Laboratorio I+D+i',
  description: 'Soluciones integradas de software, hardware y metodologías para transformar la gestión institucional, el desarrollo rural y la innovación productiva.',
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  icons: { icon: '/favicon.svg' },
  openGraph: { images: ['/og-image.png'] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
