import 'server-only';
import { secreto } from './secretos';

/*
 * El tipo de cambio del Banco Central de Costa Rica.
 *
 * Lo piden las tarifas de nacionales y residentes, que los operadores cobran
 * en colones. El tarifario de Paradise dice textualmente que se usa «el tipo
 * de cambio de COMPRA emitido por el Banco Central», así que se pide el
 * indicador 317 y no el 318: el 318 es el de venta y es más alto, lo que
 * haría que la conversión a dólares diera de menos y la comisión saliera
 * inflada. Un dígito de diferencia, plata de verdad.
 *
 * El servicio es SOAP y vive desde hace años en la misma dirección. Pide
 * suscripción: el BCCR manda un token por correo y ese par (correo + token)
 * va en la bóveda de llaves, nunca en el código.
 *
 * NO inventa nada. Si el servicio no contesta, si falta la suscripción o si
 * el número no se puede leer, devuelve el motivo y el llamador decide. Lo que
 * NUNCA pasa es que se guarde un tipo de cambio aproximado: con eso se cobra
 * mal y nadie se entera hasta que cuadran caja.
 */

const SERVICIO = 'https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx';

/** 317 = tipo de cambio de COMPRA. 318 sería el de venta: ver la cabecera. */
const INDICADOR_COMPRA = '317';

export type TipoDeCambio =
  | { ok: true; valor: number; fecha: string }
  | { ok: false; motivo: string };

/** dd/mm/aaaa, que es el único formato que el servicio acepta. */
function fechaTica(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/* El XML viene con el valor dentro de <NUM_VALOR> y la fecha en <DES_FECHA>.
   Se leen con expresión regular y no con un parseador entero: es un documento
   de dos campos y meter una dependencia para esto es desproporcionado. */
function leerNumero(xml: string): number | null {
  const m = xml.match(/<NUM_VALOR>\s*([\d.,]+)\s*<\/NUM_VALOR>/i);
  if (!m) return null;
  /* El servicio devuelve «505.45» con punto decimal. Se quitan separadores de
     miles por si algún día cambia, y se exige que quede un número sensato: un
     tipo de cambio fuera de 100–5000 es un error de lectura, no una noticia
     económica. */
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 100 || n > 5000) return null;
  return Math.round(n * 100) / 100;
}

function leerFecha(xml: string): string | null {
  const m = xml.match(/<DES_FECHA>\s*([^<]+?)\s*<\/DES_FECHA>/i);
  return m ? m[1] : null;
}

/**
 * El tipo de cambio de compra más reciente.
 *
 * Se piden los últimos días y no solo hoy: el BCCR no publica fines de semana
 * ni feriados, así que pedir «hoy» un domingo devuelve vacío. Con una ventana
 * corta siempre hay al menos un dato, y se toma el último.
 */
export async function tipoDeCambioDeCompra(diasAtras = 7): Promise<TipoDeCambio> {
  const [token, correo] = await Promise.all([
    secreto('BCCR_TOKEN'),
    secreto('BCCR_CORREO'),
  ]);
  if (!token || !correo) {
    return { ok: false, motivo: 'Falta la suscripción al BCCR (BCCR_TOKEN y BCCR_CORREO).' };
  }

  const hasta = new Date();
  const desde = new Date(Date.now() - diasAtras * 86_400_000);

  const sobre =
    `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ObtenerIndicadoresEconomicos xmlns="http://ws.sdde.bccr.fi.cr">
      <Indicador>${INDICADOR_COMPRA}</Indicador>
      <FechaInicio>${fechaTica(desde)}</FechaInicio>
      <FechaFinal>${fechaTica(hasta)}</FechaFinal>
      <Nombre>VisitLaFortunaCR</Nombre>
      <SubNiveles>N</SubNiveles>
      <CorreoElectronico>${correo}</CorreoElectronico>
      <Token>${token}</Token>
    </ObtenerIndicadoresEconomicos>
  </soap:Body>
</soap:Envelope>`;

  let xml: string;
  try {
    /* Doce segundos: es un servicio del Estado y a veces tarda, pero un cron
       colgado es peor que un cron que falla y se reintenta mañana. */
    const respuesta = await fetch(SERVICIO, {
      method: 'POST',
      headers: {
        'content-type': 'text/xml; charset=utf-8',
        soapaction: 'http://ws.sdde.bccr.fi.cr/ObtenerIndicadoresEconomicos',
      },
      body: sobre,
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!respuesta.ok) {
      return { ok: false, motivo: `El BCCR contestó ${respuesta.status}.` };
    }
    xml = await respuesta.text();
  } catch (fallo) {
    const porQue = fallo instanceof Error ? fallo.message : String(fallo);
    return { ok: false, motivo: `No se pudo hablar con el BCCR: ${porQue}` };
  }

  /* Un token vencido o mal escrito no da error HTTP: contesta 200 con una
     queja adentro. Sin esto, se guardaría un «sin datos» como si fuera una
     respuesta buena. */
  if (/token|suscri|no autoriz|invalid/i.test(xml) && !/<NUM_VALOR>/i.test(xml)) {
    return { ok: false, motivo: 'El BCCR rechazó la suscripción: revisá BCCR_TOKEN y BCCR_CORREO.' };
  }

  /* Varios días vienen en el mismo documento: interesa el ÚLTIMO, que es el
     más reciente que el BCCR haya publicado. */
  const trozos = xml.split(/<\/?INGC011_CAT_INDICADORECONOMIC>/i).filter((x) => /<NUM_VALOR>/i.test(x));
  const ultimo = trozos.length ? trozos[trozos.length - 1] : xml;

  const valor = leerNumero(ultimo);
  if (valor === null) {
    return { ok: false, motivo: 'El BCCR no devolvió un tipo de cambio que se pueda leer.' };
  }
  return { ok: true, valor, fecha: leerFecha(ultimo) ?? new Date().toISOString().slice(0, 10) };
}
