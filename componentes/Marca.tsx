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

/**
 * El sello grande, la versión oficial sobre fondo oscuro: círculo y volcán en
 * línea blanca, con la sigla dentro. Va en vector y no en PNG a propósito —
 * queda nítido a cualquier tamaño, pesa cero y toma el color de quien lo
 * contiene, así que un destino con otra paleta no necesita otro archivo.
 */
export function SelloVLF({ tamano = 132, sigla = 'VLF' }: { tamano?: number; sigla?: string }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 100 100" aria-hidden="true"
         fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="50" cy="50" r="46" strokeWidth="3" />
      {/* Las dos crestas con el cráter en medio, abiertas hasta el borde */}
      <path d="M13 69 L38 34 Q42.5 27.5 47 34 L51 40.5 L55.5 32 Q60 25.5 64.5 32 L87 69"
            strokeWidth="3.4" />
      {/* La línea del suelo, donde se apoya la sigla */}
      <path d="M8 69.5 Q50 64.5 92 69.5" strokeWidth="3" />
      {/* El humo, saliendo del cráter */}
      <path d="M51 36 Q56.5 27.5 51.5 20 Q46.5 12.5 53 5.5" strokeWidth="2.9" />
      <text x="50" y="88" fontFamily="Montserrat, sans-serif" fontSize={sigla.length > 3 ? 21 : 27}
            fontWeight="900" fill="currentColor" stroke="none" textAnchor="middle"
            letterSpacing="1.5">{sigla}</text>
    </svg>
  );
}

/**
 * El sello con el nombre debajo. El "CR" va en naranja, igual que en la barra
 * y que en la hoja de marca: es la parte que hace que se lea como un dominio.
 */
export function MarcaVLF({
  marca, sigla = 'VLF', dominio, tamano = 132, logoUrl,
}: {
  marca: string;
  sigla?: string;
  dominio?: string | null;
  tamano?: number;
  /** El sello oficial, de dst_destino.logo_url. Sin él se dibuja el vectorial. */
  logoUrl?: string | null;
}) {
  // "Visit La Fortuna CR" -> "VisitLaFortuna" + "CR", como el logo oficial.
  const junto = marca.replace(/\s+/g, '');
  const corte = junto.toLowerCase().lastIndexOf('cr');
  const base = corte > 0 ? junto.slice(0, corte) : junto;
  const cola = corte > 0 ? junto.slice(corte) : '';
  const punto = dominio ? dominio.slice(dominio.lastIndexOf('.')) : '';

  return (
    <div className="marca-sello">
      {logoUrl
        ? <img src={logoUrl} alt={marca} width={tamano} height={tamano}
               style={{ width: tamano, height: 'auto' }} />
        : <SelloVLF tamano={tamano} sigla={sigla} />}
      {/* El nombre va en texto y no en la imagen: así se lee, se busca, se
          traduce solo con marca_nombre y queda nítido en cualquier pantalla. */}
      <div className="marca-nombre">
        {base}<i>{cola}</i><span>{punto}</span>
      </div>
    </div>
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
