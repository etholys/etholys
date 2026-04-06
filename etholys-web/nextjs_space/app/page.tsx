import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redirige automáticamente a la ruta del dashboard al entrar a localhost:3000
  redirect('/dashboard');
}
