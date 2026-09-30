import './globals.css';
import Providers from './providers';
import type { Metadata, Viewport } from 'next';
import { Figtree, Syne } from 'next/font/google';
import Script from 'next/script';

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

/** Evita flash do tema escuro quando a preferência guardada é clara. */
const APPEARANCE_BOOT = `(function(){try{var c=document.cookie.match(/(?:^|; )etholys_appearance=([^;]*)/);var a=c?decodeURIComponent(c[1]):(localStorage.getItem('etholys_appearance')||'dark');if(a!=='light')a='dark';document.documentElement.dataset.appearance=a;document.documentElement.style.colorScheme=a;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script id="etholys-appearance-boot" strategy="beforeInteractive">
          {APPEARANCE_BOOT}
        </Script>
      </head>
      <body className={`${figtree.variable} ${syne.variable} min-h-screen font-[family-name:var(--font-etholys-sans)] antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
