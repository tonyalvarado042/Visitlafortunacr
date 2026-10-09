import Link from 'next/link';
import type { Metadata } from 'next';
import { LogoVLF } from '@/componentes/Marca';
import { salir } from './acciones';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi negocio',
  // Nada de esto va a buscadores: es el panel privado de cada comercio.
  robots: { index: false, follow: false },
};

/*
 * El panel del COMERCIANTE. Vive en /negocio y no en /admin a propósito: el
 * dueño de un hotel no tiene por qué poder ni asomarse a los leads, los
 * viajeros o los reportes del equipo. Separar la ruta es lo que garantiza que
 * un descuido de mañana no lo meta donde no va.
 */
export default function LayoutComercio({ children }: { children: React.ReactNode }) {
  return (
    <div className="comercio">
      <header className="comercio-barra">
        {/* El emblema dibujado y no el de La Fortuna: este panel es de la
            plataforma, y un comerciante puede tener negocios en más de un
            destino. Poner el logo de uno solo sería mentir. */}
        <Link className="logo" href="/negocio">
          <LogoVLF tamano={34} />
          <span className="texto">Mi negocio</span>
        </Link>
        <form action={salir}>
          <button type="submit" className="comercio-salir">Salir</button>
        </form>
      </header>
      <main className="comercio-cuerpo">{children}</main>
    </div>
  );
}
