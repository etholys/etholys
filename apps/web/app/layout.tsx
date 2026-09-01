import './globals.css';
import Providers from './providers';
import type { Metadata, Viewport } from 'next';
import { Figtree, Syne } from 'next/font/google';

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-etholys-sans',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-etholys-display',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

/** Sem force-dynamic no root: login e vitrine respondem mais depressa. Rotas que precisam de dados dinâmicos marcam-se a nível de segmento. */

function metadataBaseUrl(): URL {
  const raw = (process.env.NEXTAUTH_URL || '').trim() || 'http://localhost:3000';
  try {
    return new URL(raw);
  } catch {
    return new URL('http://localhost:3000');
  }
}

export const metadata: Metadata = {
  title: 'ETHOLYS — Fábrica de Soluciones | Laboratorio I+D+i',
  description:
    'Ecosistema de soluciones para gestionar, financiar, ejecutar, aprender y decidir mejor.',
  metadataBase: metadataBaseUrl(),
  icons: { icon: '/favicon.svg' },
  openGraph: { images: ['/og-image.png'] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${figtree.variable} ${syne.variable} min-h-screen font-[family-name:var(--font-etholys-sans)] antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
