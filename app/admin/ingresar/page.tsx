import { FormularioIngreso } from './FormularioIngreso';

export const dynamic = 'force-dynamic';

export default async function PaginaIngreso({ searchParams }: { searchParams: Promise<{ volver?: string; error?: string }> }) {
  const { volver, error } = await searchParams;
  return (
    <div className="ingreso">
      <div className="caja-ingreso">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, fontWeight: 800 }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--naranja)', display: 'inline-block' }} />
          Visit <span style={{ color: 'var(--naranja)' }}>Destinos</span> · Panel
        </div>
        <h1>Entrar</h1>
        <p className="sub">Solo el equipo invitado. Si te invitaron, creá tu cuenta con ese mismo correo.</p>
        {error === 'enlace' && <div className="aviso mal">El enlace ya no sirve. Pedí uno nuevo.</div>}
        <FormularioIngreso volver={volver ?? '/admin'} />
      </div>
    </div>
  );
}
