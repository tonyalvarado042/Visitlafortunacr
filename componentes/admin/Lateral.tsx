'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/*
 * La barra lateral del panel, que en el teléfono se pliega.
 *
 * EL PROBLEMA QUE RESUELVE: el menú tiene 19 entradas. En escritorio son una
 * columna de 236px y se ven todas, perfecto. Pero debajo de 900px la columna
 * pasa a ancho completo y las 19 quedan apiladas: unos 650px de muro negro que
 * hay que pasar scrolleando ANTES de ver el contenido de la página. Abrir el
 * panel en el teléfono era inservible.
 *
 * CÓMO SE ARREGLA: en el teléfono solo se ve la marca y un botón «Menú». El
 * resto —el selector de destino, las 19 entradas y el bloque del usuario— vive
 * dentro de `.lateral-cuerpo`, que se despliega al tocar el botón. En
 * escritorio el botón no existe y el cuerpo es `display: contents`, así que el
 * `margin-top: auto` del bloque de usuario sigue empujándolo al fondo como
 * siempre. Es decir: **en escritorio nada cambia**.
 *
 * Se cierra solo al navegar. Si no, uno toca «Reseñas», carga la página y el
 * menú sigue abierto tapándola.
 */
export function Lateral({ marca, children }: { marca: React.ReactNode; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();

  useEffect(() => { setAbierto(false); }, [ruta]);

  return (
    <aside className={abierto ? 'lateral abierto' : 'lateral'}>
      <div className="lateral-cabecera">
        {marca}
        <button
          type="button"
          className="lateral-boton"
          onClick={() => setAbierto((x) => !x)}
          aria-expanded={abierto}
          aria-controls="lateral-cuerpo"
        >
          {abierto ? 'Cerrar' : 'Menú'}
        </button>
      </div>
      <div className="lateral-cuerpo" id="lateral-cuerpo">{children}</div>
    </aside>
  );
}
