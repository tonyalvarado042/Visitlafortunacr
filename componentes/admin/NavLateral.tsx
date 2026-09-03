'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { ruta: string; nombre: string; grupo: string };

export function NavLateral({ items }: { items: Item[] }) {
  const ruta = usePathname();
  let grupoAnterior: string | null = null;
  return (
    <nav>
      {items.map((item) => {
        const activo = item.ruta === '/admin' ? ruta === '/admin' : ruta.startsWith(item.ruta);
        const cabecera = item.grupo && item.grupo !== grupoAnterior ? <div className="grupo">{item.grupo}</div> : null;
        grupoAnterior = item.grupo;
        return (
          <div key={item.ruta}>
            {cabecera}
            <Link href={item.ruta} className={activo ? 'activo' : ''}>{item.nombre}</Link>
          </div>
        );
      })}
    </nav>
  );
}
