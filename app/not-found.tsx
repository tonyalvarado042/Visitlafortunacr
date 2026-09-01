import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <div className="aviso-error">
      <h1>404</h1>
      <p>Esta página no existe o cambió de dirección.</p>
      <p style={{ marginTop: 20 }}><Link href="/" style={{ color: 'var(--naranja)', fontWeight: 700 }}>← Inicio</Link></p>
    </div>
  );
}
