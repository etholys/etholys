import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'La Expedición Sostenible — FORGE',
  description: 'Activa tu acceso al curso en vivo. Optimizado para celular.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#047857',
};

export default function ExpedicionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
