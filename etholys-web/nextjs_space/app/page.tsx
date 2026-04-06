import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f9fafb', color: '#111827' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>¡Etholys está funcionando!</h1>
      <p style={{ fontSize: '1.125rem', color: '#4b5563', marginBottom: '2rem' }}>
        El servidor web levantó correctamente y la base de datos está conectada.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link href="/dashboard" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#0d9488', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500' }}>
          Ir al Dashboard
        </Link>
        <Link href="/api/auth/signin" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1f2937', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500' }}>
          Iniciar Sesión
        </Link>
      </div>
    </div>
  );
}
