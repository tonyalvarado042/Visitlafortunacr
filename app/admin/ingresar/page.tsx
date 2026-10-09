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
        {/* El enlace mágico va con PKCE: el navegador que lo ABRE tiene que ser
            el mismo que lo PIDIÓ, porque la mitad de la llave quedó en una
            cookie suya. Abrirlo desde el correo del teléfono habiéndolo pedido
            en la computadora falla, y sin decirlo nadie entiende por qué. */}
        {error === 'enlace' && (
          <div className="aviso mal">
            Ese enlace no sirvió. Pedí uno nuevo — y abrilo <strong>en el mismo
            navegador donde lo pediste</strong>, que es lo que suele fallar.
          </div>
        )}
        <FormularioIngreso volver={volver ?? '/admin'} />
      </div>
    </div>
  );
}
