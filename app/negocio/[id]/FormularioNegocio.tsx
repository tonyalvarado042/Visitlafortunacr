'use client';

import { useActionState } from 'react';
import type { MiNegocio } from '@/lib/comercio';
import { guardarMiNegocio, type EstadoComercio } from '../acciones';

const NADA: EstadoComercio = {};

const PRECIOS = [
  { valor: '',          texto: 'Sin indicar' },
  { valor: 'economico', texto: '$ · Económico' },
  { valor: 'moderado',  texto: '$$ · Moderado' },
  { valor: 'alto',      texto: '$$$ · Alto' },
  { valor: 'lujo',      texto: '$$$$ · Lujo' },
];

export function FormularioNegocio({ negocio }: { negocio: MiNegocio }) {
  const [estado, accion, pendiente] = useActionState(guardarMiNegocio, NADA);

  return (
    <form action={accion} className="forma comercio-forma">
      <input type="hidden" name="id" value={negocio.id} />

      <label>
        <span>Nombre del negocio *</span>
        <input name="nombre" type="text" defaultValue={negocio.nombre} required maxLength={120} />
      </label>

      <label>
        <span>Resumen</span>
        <textarea name="resumen" rows={2} maxLength={300} defaultValue={negocio.resumen ?? ''} />
        <small>Una línea. Es lo que se lee en las listas del directorio.</small>
      </label>

      <label>
        <span>Descripción</span>
        <textarea name="descripcion" rows={6} defaultValue={negocio.descripcion ?? ''} />
        <small>Contá qué hacen, qué los distingue y qué se va a encontrar quien llegue.</small>
      </label>

      <div className="forma-fila">
        <label>
          <span>Teléfono</span>
          <input name="telefono" type="tel" inputMode="tel" placeholder="+506…"
                 defaultValue={negocio.telefono ?? ''} />
        </label>
        <label>
          <span>WhatsApp</span>
          <input name="telefono_whatsapp" type="tel" inputMode="tel" placeholder="+506…"
                 defaultValue={negocio.telefono_whatsapp ?? ''} />
        </label>
      </div>

      <div className="forma-fila">
        <label>
          <span>Correo</span>
          <input name="email" type="email" defaultValue={negocio.email ?? ''} />
        </label>
        <label>
          <span>Sitio web</span>
          <input name="sitio_web" type="url" placeholder="https://…"
                 defaultValue={negocio.sitio_web ?? ''} />
        </label>
      </div>

      <label>
        <span>Dirección</span>
        <input name="direccion" type="text" maxLength={200} defaultValue={negocio.direccion ?? ''} />
      </label>

      <label>
        <span>Cómo llegar</span>
        <textarea name="como_llegar" rows={2} defaultValue={negocio.como_llegar ?? ''} />
        <small>Las señas de verdad: «200 metros al sur de la iglesia, mano derecha».</small>
      </label>

      <label>
        <span>Rango de precio</span>
        <select name="rango_precio" defaultValue={negocio.rango_precio ?? ''}>
          {PRECIOS.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
        </select>
      </label>

      <label className="forma-marca">
        <input type="checkbox" name="esta_cerrado" value="1" defaultChecked={negocio.esta_cerrado} />
        <span>Cerrado temporalmente</span>
        <small>Se sigue viendo en el directorio, pero avisa que ahora no están atendiendo.</small>
      </label>

      {/* Lo que no se toca desde acá, dicho de frente para que nadie lo busque. */}
      <p className="forma-nota">
        La categoría, si aparecés destacado y si tu ficha está publicada los maneja
        el equipo de {negocio.destino_dominio}. Si necesitás cambiar la categoría,
        escribinos.
      </p>

      {estado.error && <p className="forma-error">{estado.error}</p>}
      {estado.ok && <p className="forma-ok">{estado.ok}</p>}

      <button type="submit" className="boton" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
