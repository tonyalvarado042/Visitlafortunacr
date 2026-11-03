import { env } from 'cloudflare:workers';

/*
 * `sharp` para cuando el sitio corre en Cloudflare Workers.
 *
 * sharp es un binario nativo y en Workers no existe. vite.config.ts cambia el
 * import de 'sharp' por este archivo, así que las tres rutas que convierten
 * fotos a WebP (subir foto, traer foto por URL, imagen de marca) no se tocan:
 * en Vercel siguen usando sharp de verdad, y aquí la misma cadena
 * —rotate → resize → webp → toBuffer— la hace la binding de Cloudflare Images.
 *
 * Solo implementa lo que el código usa. Si alguien agrega otra llamada de sharp
 * (crop, blur, avif...), hay que sumarla aquí o en Workers falla.
 *
 * Ojo: Images lee HEIC, que es la razón de ser de /api/foto/webp. Que respete
 * la orientación EXIF sin pedírselo NO está comprobado: hay que subir una foto
 * vertical de teléfono en el primer despliegue y mirar que no salga acostada.
 */

type Imagenes = {
  input(flujo: ReadableStream<Uint8Array>): {
    transform(t: Record<string, unknown>): ReturnType<Imagenes['input']>;
    output(o: { format: string; quality?: number }): Promise<{ response(): Response }>;
  };
};

class Tubo {
  private ancho?: number;
  private ajuste: 'scale-down' | 'contain' = 'contain';
  private calidad = 80;

  constructor(private readonly entrada: ArrayBuffer | Uint8Array) {}

  rotate() { return this; }

  resize(o: { width?: number; withoutEnlargement?: boolean }) {
    this.ancho = o.width;
    this.ajuste = o.withoutEnlargement ? 'scale-down' : 'contain';
    return this;
  }

  webp(o: { quality?: number } = {}) {
    this.calidad = o.quality ?? 80;
    return this;
  }

  async toBuffer(): Promise<Buffer> {
    const imagenes = (env as unknown as { IMAGES?: Imagenes }).IMAGES;
    if (!imagenes) throw new Error('Falta la binding IMAGES (cloudflare.config.ts).');

    let tubo = imagenes.input(new Response(this.entrada).body!);
    if (this.ancho) tubo = tubo.transform({ width: this.ancho, fit: this.ajuste });
    const salida = await tubo.output({ format: 'image/webp', quality: this.calidad });
    return Buffer.from(await salida.response().arrayBuffer());
  }
}

export default function sharp(entrada: ArrayBuffer | Uint8Array) {
  return new Tubo(entrada);
}
