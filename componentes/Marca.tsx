export function LogoVLF({ tamano = 32, sigla = 'VLF' }: { tamano?: number; sigla?: string }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="5" />
      <path d="M18 72 L40 38 Q44 32 48 38 L52 44 L58 36 Q62 30 66 36 L82 72 Z" fill="currentColor" />
      <path d="M44 26 Q49 20 46 14 Q43 9 48 5" stroke="currentColor" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <text x="50" y="66" fontFamily="Montserrat, sans-serif" fontSize={sigla.length > 3 ? 24 : 30}
            fontWeight="900" fill="#0B0B0B" textAnchor="middle">{sigla}</text>
    </svg>
  );
}

export function IconoVerificado({ tamano = 11 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="3.4" strokeLinecap="round" aria-hidden="true">
      <path d="M4 12.5l5 5 11-11" />
    </svg>
  );
}
