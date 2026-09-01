'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="aviso-error">
      <h1>Algo se rompió</h1>
      <p>{error.message}</p>
      <p style={{ marginTop: 18 }}>
        <button className="boton" onClick={reset}>Reintentar</button>
      </p>
    </div>
  );
}
