import { redirect } from 'next/navigation';

/** CARTA foi descontinuado — aprovações ficam em Work. */
export default function CartaHubPage() {
  redirect('/hub/work');
}
