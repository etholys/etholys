import './globals.css';
import Providers from './providers';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
  description: 'Soluciones integradas de software, hardware y metodologías para transformar la gestión institucional, el desarrollo rural y la innovación productiva.',
  metadataBase: metadataBaseUrl(),
  icons: { icon: '/favicon.svg' },
  openGraph: { images: ['/og-image.png'] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
