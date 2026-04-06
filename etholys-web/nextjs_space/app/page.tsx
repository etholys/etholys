import Link from 'next/link';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function HomePage() {
  let userCount = 0;
  let dbStatus = "Conectada";

  try {
    userCount = await prisma.user.count();
  } catch (error: any) {
    dbStatus = "Error: " + error.message;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', backgroundColor: '#f9fafb', color: '#111827', padding: '2rem' }}>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>¡Etholys está funcionando!</h1>
      
      <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', marginBottom: '2rem', textAlign: 'center', maxWidth: '600px', width: '100%' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Estado de la Base de Datos</h2>
        <p style={{ fontSize: '1.125rem', color: '#4b5563', marginBottom: '0.5rem' }}>
          Estado: <strong>{dbStatus}</strong>
        </p>
        <p style={{ fontSize: '1.125rem', color: '#4b5563', marginBottom: '1rem' }}>
          Usuarios registrados: <strong>{userCount}</strong>
        </p>
        
        {userCount === 0 && (
          <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '0.5rem', textAlign: 'left' }}>
            <p style={{ marginBottom: '0.5rem' }}><strong>¡Atención! La base de datos está vacía.</strong></p>
            <p style={{ fontSize: '0.95rem' }}>
              El error 404 que ves al intentar loguearte pasa porque el usuario que estás ingresando <strong>no existe</strong> en esta base de datos local de Docker. Al fallar el login, el sistema te manda a <code>/api/auth/error</code> y tira 404.
            </p>
            <p style={{ fontSize: '0.95rem', marginTop: '0.5rem' }}>
              Para solucionarlo, precisás registrar una cuenta nueva (por ejemplo, yendo a la ruta de Onboarding) o correr el script de seed de tu proyecto para cargar los usuarios de prueba.
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/api/auth/signin" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#1f2937', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500' }}>
          Intentar Login
        </Link>
        <Link href="/onboarding" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500' }}>
          Ir a Registro / Onboarding
        </Link>
      </div>
    </div>
  );
}
