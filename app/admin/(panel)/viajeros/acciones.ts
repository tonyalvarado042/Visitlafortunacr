'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };

export async function editarViajero(datos: FormData) {
  const { db } = await contextoPanel('viajeros');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const whatsapp = texto(datos, 'whatsapp').replace(/[\s\-().]/g, '');
  const cambios = {
    nombre: texto(datos, 'nombre') || null,
    apellidos: texto(datos, 'apellidos') || null,
    email: texto(datos, 'email').toLowerCase() || null,
    whatsapp: whatsapp ? (whatsapp.startsWith('+') ? whatsapp : `+${whatsapp}`) : null,
    pais_iso: texto(datos, 'pais_iso').toUpperCase().slice(0, 2) || null,
    idioma: texto(datos, 'idioma') || null,
    llega_el: texto(datos, 'llega_el') || null,
    sale_el: texto(datos, 'sale_el') || null,
    personas: numero(datos, 'personas'),
    ninos: numero(datos, 'ninos'),
    tipo_viajero: texto(datos, 'tipo_viajero') || null,
    presupuesto: texto(datos, 'presupuesto') || null,
    presupuesto_usd: numero(datos, 'presupuesto_usd'),
    intereses: texto(datos, 'intereses').split(',').map((i) => i.trim().toLowerCase()).filter(Boolean),
    notas: texto(datos, 'notas') || null,
    no_molestar: texto(datos, 'no_molestar') === '1',
    acepta_marketing: texto(datos, 'acepta_marketing') === '1',
  };
  await db.from('dst_viajero').update(cambios).eq('id', id);
  revalidatePath(`/admin/viajeros/${id}`);
  revalidatePath('/admin/viajeros');
  revalidatePath('/admin/leads');
}
