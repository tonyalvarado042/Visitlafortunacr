import type { Destino } from '@/lib/destino';

export function Pie({ destino }: { destino: Destino }) {
  const lugar = [destino.nombre_largo ?? destino.nombre, destino.region, destino.pais_nombre]
    .filter(Boolean)
    .join(', ');

  return (
    <footer>
      <div className="pie-caja">
        <div className="legal">© {new Date().getFullYear()} {destino.dominio} · {lugar}</div>
      </div>
    </footer>
  );
}
