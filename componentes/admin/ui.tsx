import Link from 'next/link';

/* Piezas chicas y repetidas del panel. Sin estado: todo se renderiza en el servidor. */

export function Etiqueta({ color, children, suave = false }: { color?: string; children: React.ReactNode; suave?: boolean }) {
  return (
    <span className={`etiqueta${suave ? ' suave' : ''}`} style={!suave && color ? { background: color } : undefined}>
      {children}
    </span>
  );
}

export function Vacio({ texto }: { texto: string }) {
  return <div className="vacio">{texto}</div>;
}

export function Cabecera({ titulo, sub, migas, children }: {
  titulo: string; sub?: React.ReactNode; migas?: { ruta: string; nombre: string }[]; children?: React.ReactNode;
}) {
  return (
    <div className="cabecera">
      <div>
        {migas?.length ? (
          <div className="migas">
            {migas.map((m, i) => <span key={m.ruta}>{i > 0 ? ' / ' : ''}<Link href={m.ruta}>{m.nombre}</Link></span>)}
          </div>
        ) : null}
        <h1>{titulo}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {children ? <div className="acciones-cab">{children}</div> : null}
    </div>
  );
}

export function Kpi({ titulo, valor, nota, tono }: { titulo: string; valor: React.ReactNode; nota?: React.ReactNode; tono?: 'alerta' | 'bien' }) {
  return (
    <div className={`kpi${tono ? ` ${tono}` : ''}`}>
      <div className="valor">{valor}</div>
      <div className="titulo">{titulo}</div>
      {nota ? <div className="nota">{nota}</div> : null}
    </div>
  );
}

export function Aviso({ tipo = 'info', children }: { tipo?: 'ok' | 'mal' | 'info'; children: React.ReactNode }) {
  return <div className={`aviso ${tipo}`}>{children}</div>;
}

export function Barras({ filas, total }: { filas: { nombre: string; valor: number; color?: string }[]; total?: number }) {
  const maximo = Math.max(total ?? 0, ...filas.map((f) => f.valor), 1);
  return (
    <div className="barras">
      {filas.map((f) => (
        <div className="fila" key={f.nombre}>
          <span>{f.nombre}</span>
          <div className="barra-progreso"><i style={{ width: `${Math.round((f.valor / maximo) * 100)}%`, background: f.color ?? 'var(--verde)' }} /></div>
          <span className="num">{f.valor}</span>
        </div>
      ))}
    </div>
  );
}
