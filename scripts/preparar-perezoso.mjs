/*
 * Prepara el hero interactivo: el perezoso que sigue al puntero con la cabeza.
 *
 *   node scripts/preparar-perezoso.mjs --hoja      (hoja de contacto para etiquetar)
 *   node scripts/preparar-perezoso.mjs             (dice qué haría)
 *   node scripts/preparar-perezoso.mjs --aplicar   (video de fondo + hoja de sprites)
 *
 * De dónde sale que esto funcione: en el clip la CÁMARA NO SE MUEVE (alineación
 * del primer cuadro contra el último: 0 px) y el único movimiento grande es la
 * cabeza del perezoso, que ya gira sola a izquierda, derecha, arriba y abajo.
 * Entonces un recorte de la cabeza de CUALQUIER cuadro calza pixel a pixel
 * sobre cualquier otro, y la costura no se ve. Por eso no hay que recortar al
 * animal, ni rotoscopia, ni video con canal alfa: el sitio pinta el video
 * corriendo (cascada, mariposa, tucán) y encima una elipse con la pose que el
 * mouse pidió.
 *
 * El mouse no inventa el giro: ELIGE entre las poses que el clip ya tiene.
 *
 * Las etiquetas de dirección de cada pose se escriben A MANO en
 * `datos/hero/perezoso.json` mirando la hoja de contacto. Se intentó deducirlas
 * (centroide de las marcas oscuras de la cara) y quedó demasiado ruidoso para
 * confiarle hacia dónde mira la cabeza.
 *
 * ffmpeg: se busca en $FFMPEG, en el PATH y, de último, en el que trae el
 * paquete de Python `imageio-ffmpeg` (que es como está en la máquina de
 * Sebastián, donde no hay ffmpeg de sistema).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import sharp from 'sharp';

const APLICAR = process.argv.includes('--aplicar');
const HOJA = process.argv.includes('--hoja');
const MANIFIESTO = 'datos/hero/perezoso.json';
const TALLER = '.perezoso';

const kb = (p) => `${Math.round(statSync(p).size / 1024)} KB`;

function buscarFfmpeg() {
  const candidatos = [
    process.env.FFMPEG,
    'ffmpeg',
    `${homedir()}/AppData/Roaming/Python/Python314/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe`,
  ].filter(Boolean);
  for (const c of candidatos) {
    try {
      execFileSync(c, ['-version'], { stdio: 'ignore' });
      return c;
    } catch {}
  }
  console.error('No hay ffmpeg. Poné la ruta en $FFMPEG, o instalalo:');
  console.error('  python -m pip install imageio-ffmpeg');
  process.exit(1);
}

const FFMPEG = buscarFfmpeg();
const correr = (args) => execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

/** Tamaño del cuadro del video, que es contra lo que se normaliza la caja. */
function medirVideo(origen) {
  const salida = execFileSync(FFMPEG, ['-hide_banner', '-i', origen], { stdio: ['ignore', 'ignore', 'pipe'] , encoding: 'utf8' })
    .toString();
  return salida;
}

/**
 * Saca de un tirón los cuadros pedidos, ya recortados a la cabeza.
 * Una sola pasada de ffmpeg: `select` deja pasar solo esos números de cuadro y
 * `fps_mode passthrough` evita que los duplique para rellenar una tasa fija.
 */
function sacarCuadros(origen, caja, cuadros, destino, ancho) {
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  const par = (v) => Math.round(v / 2) * 2;
  const crop = `crop=iw*${caja.an}:ih*${caja.al}:iw*${caja.x}:ih*${caja.y}`;
  const select = cuadros.map((n) => `eq(n\\,${n})`).join('+');
  correr([
    '-i', origen,
    '-vf', `${crop},select='${select}',scale=${par(ancho)}:-2`,
    '-fps_mode', 'passthrough',
    `${destino}/%03d.png`,
  ]);
  const salieron = readdirSync(destino).filter((f) => f.endsWith('.png')).sort();
  if (salieron.length !== cuadros.length) {
    console.error(`ffmpeg devolvió ${salieron.length} cuadros y se pidieron ${cuadros.length}. No se escribe nada.`);
    process.exit(1);
  }
  return salieron.map((f) => `${destino}/${f}`);
}

/** Pega los recortes en una rejilla, en el mismo orden en que vinieron. */
async function armarHoja(archivos, columnas, salida, { numerar = false, calidad = 80 } = {}) {
  const { width, height } = await sharp(archivos[0]).metadata();
  const filas = Math.ceil(archivos.length / columnas);
  const capas = [];
  for (const [i, archivo] of archivos.entries()) {
    const left = (i % columnas) * width;
    const top = Math.floor(i / columnas) * height;
    capas.push({ input: await sharp(archivo).toBuffer(), left, top });
    if (numerar) {
      const etiqueta = Buffer.from(
        `<svg width="${width}" height="60"><rect width="120" height="56" fill="#000" opacity=".72"/>` +
        `<text x="14" y="42" font-family="sans-serif" font-size="40" font-weight="bold" fill="#FF6A00">${i}</text></svg>`,
      );
      capas.push({ input: etiqueta, left, top });
    }
  }
  await sharp({ create: { width: width * columnas, height: height * filas, channels: 3, background: '#000' } })
    .composite(capas)
    .webp({ quality: calidad, effort: 6 })
    .toFile(salida);
  return { width, height, filas, columnas };
}

const manifiesto = JSON.parse(readFileSync(MANIFIESTO, 'utf8'));

/* --------------------------------------------------------------------------
 * Modo hoja de contacto: para elegir y etiquetar las poses mirándolas.
 * -------------------------------------------------------------------------- */
if (HOJA) {
  for (const [url, d] of Object.entries(manifiesto)) {
    const cuantos = 36;
    const cuadros = Array.from({ length: cuantos }, (_, i) => Math.round((i * (d.cuadros_totales - 1)) / (cuantos - 1)));
    console.log(`${url}\n  ${cuantos} cuadros de ${d.origen}`);
    const archivos = sacarCuadros(d.origen, d.caja, cuadros, `${TALLER}/contacto`, 300);
    const salida = `${TALLER}/hoja-contacto.webp`;
    await armarHoja(archivos, 6, salida, { numerar: true });
    console.log(`  → ${salida} (${kb(salida)})`);
    console.log(`  Los números son el índice de la celda; el cuadro real es: ${cuadros.join(', ')}`);
  }
  process.exit(0);
}

/* --------------------------------------------------------------------------
 * Modo producción: video de fondo + hoja de sprites + manifiesto verificado.
 * -------------------------------------------------------------------------- */
for (const [url, d] of Object.entries(manifiesto)) {
  const destinoVideo = `public${url}`;
  const cuadros = d.poses.map((p) => p.cuadro);

  console.log(`${url}`);
  console.log(`  origen      ${d.origen} (${kb(d.origen)})`);
  console.log(`  video       → ${destinoVideo}  ${d.ancho_video}p, sin audio`);
  console.log(`  poses       ${cuadros.length} → public${d.hoja.archivo}`);
  console.log(`  caja        x ${d.caja.x} y ${d.caja.y} an ${d.caja.an} al ${d.caja.al}`);

  if (!existsSync(d.origen)) {
    console.error(`\nNo existe ${d.origen}. No se escribe nada.`);
    process.exit(1);
  }
  const repetidos = cuadros.filter((c, i) => cuadros.indexOf(c) !== i);
  if (repetidos.length) {
    console.error(`\nHay cuadros repetidos en las poses: ${repetidos.join(', ')}. No se escribe nada.`);
    process.exit(1);
  }

  if (!APLICAR) continue;

  /* El video de fondo. El original vive FUERA de `public/` a propósito: ahí
     dentro Vercel lo publicaría y lo subiría en cada despliegue, 6,7 MB que
     nadie pide. Pierde el audio también a propósito: el hero va en silencio y
     son ~130 KB que nadie va a oír. `faststart` deja el índice al principio,
     que es lo que permite que empiece a verse antes de bajar entero. */
  correr([
    '-i', d.origen,
    '-an',
    '-vf', `scale=-2:${d.ancho_video}`,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow',
    '-b:v', d.bitrate, '-maxrate', d.bitrate, '-bufsize', '4M',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    destinoVideo,
  ]);
  console.log(`  video       ${kb(destinoVideo)}`);

  const archivos = sacarCuadros(d.origen, d.caja, cuadros, `${TALLER}/poses`, d.hoja.ancho_celda);
  const salidaHoja = `public${d.hoja.archivo}`;
  const rejilla = await armarHoja(archivos, d.hoja.columnas, salidaHoja, { calidad: d.hoja.calidad });
  console.log(`  sprites     ${kb(salidaHoja)} · celda ${rejilla.width}×${rejilla.height} · ${rejilla.columnas}×${rejilla.filas}`);

  /* La rejilla real la manda sharp, no el JSON: si la celda salió de otro
     tamaño (ffmpeg redondea a par), el sitio tiene que saber el de verdad o
     la cara aparece corrida. */
  d.hoja.celda = { an: rejilla.width, al: rejilla.height };
  d.hoja.filas = rejilla.filas;
}

if (!APLICAR) {
  console.log('\nEn seco. Para escribir: --aplicar');
  process.exit(0);
}

writeFileSync(MANIFIESTO, `${JSON.stringify(manifiesto, null, 2)}\n`);
console.log(`\n${MANIFIESTO} actualizado con la rejilla real.`);
