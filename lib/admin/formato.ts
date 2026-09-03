/* Cómo se muestran fechas, dinero y estados en el panel. */

export function fecha(iso: string | null | undefined, zona = 'America/Costa_Rica', conHora = true): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CR', {
    timeZone: zona, day: '2-digit', month: 'short', ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}

export function soloFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

export function relativo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const min = Math.round(ms / 60_000);
  if (Math.abs(min) < 1) return 'ahora';
  if (Math.abs(min) < 60) return min > 0 ? `hace ${min} min` : `en ${-min} min`;
  const h = Math.round(min / 60);
  if (Math.abs(h) < 48) return h > 0 ? `hace ${h} h` : `en ${-h} h`;
  const d = Math.round(h / 24);
  return d > 0 ? `hace ${d} d` : `en ${-d} d`;
}

export function dinero(valor: number | string | null | undefined, moneda = 'USD'): string {
  if (valor == null || valor === '') return '—';
  const n = Number(valor);
  if (Number.isNaN(n)) return String(valor);
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: moneda, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
}

export function numero(valor: number | string | null | undefined): string {
  if (valor == null) return '0';
  return new Intl.NumberFormat('es-CR').format(Number(valor));
}

export const ETAPAS: { valor: string; nombre: string; color: string }[] = [
  { valor: 'nuevo',             nombre: 'Nuevo',             color: '#3B82F6' },
  { valor: 'contactado',        nombre: 'Contactado',        color: '#8B5CF6' },
  { valor: 'propuesta_enviada', nombre: 'Propuesta enviada', color: '#F59E0B' },
  { valor: 'negociacion',       nombre: 'Negociación',       color: '#FF6A00' },
  { valor: 'reservado',         nombre: 'Reservado',         color: '#66BB2E' },
  { valor: 'perdido',           nombre: 'Perdido',           color: '#9CA3AF' },
];

export function etapa(valor: string | null | undefined) {
  return ETAPAS.find((e) => e.valor === valor) ?? { valor: valor ?? '', nombre: valor ?? '—', color: '#9CA3AF' };
}

export const TEMPERATURA: Record<string, { nombre: string; color: string }> = {
  caliente: { nombre: 'Caliente', color: '#FF6A00' },
  tibio:    { nombre: 'Tibio',    color: '#F59E0B' },
  frio:     { nombre: 'Frío',     color: '#60A5FA' },
};

export const TIPO_SOLICITUD: Record<string, string> = {
  itinerario: 'Itinerario', tour: 'Tour', hospedaje: 'Hospedaje', transporte: 'Transporte',
  consulta_general: 'Consulta', reclamo_ficha: 'Reclamo de ficha',
};

export const ESTADO_CONVERSACION: Record<string, { nombre: string; color: string }> = {
  abierta:           { nombre: 'Abierta',           color: '#3B82F6' },
  esperando_viajero: { nombre: 'Esperando viajero', color: '#9CA3AF' },
  esperando_equipo:  { nombre: 'Esperando equipo',  color: '#F59E0B' },
  escalada:          { nombre: 'Escalada',          color: '#EF4444' },
  cerrada:           { nombre: 'Cerrada',           color: '#6B7280' },
};

export function truncar(texto: string | null | undefined, largo = 90): string {
  if (!texto) return '';
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;
}

export function primeraLinea(texto: string | null | undefined): string {
  return (texto ?? '').split('\n')[0];
}

export const ESTADO_RESERVA: Record<string, { nombre: string; color: string }> = {
  solicitada: { nombre: 'Solicitada', color: '#3B82F6' },
  confirmada: { nombre: 'Confirmada', color: '#8B5CF6' },
  pagada:     { nombre: 'Pagada',     color: '#66BB2E' },
  completada: { nombre: 'Completada', color: '#0B0B0B' },
  cancelada:  { nombre: 'Cancelada',  color: '#9CA3AF' },
  no_show:    { nombre: 'No show',    color: '#EF4444' },
};

export const DISPARADOR: Record<string, string> = {
  solicitud_nueva: 'Entra una solicitud', sin_respuesta: 'El viajero no responde', antes_de_llegar: 'Antes de llegar',
  despues_de_salir: 'Después de irse', conversacion_inactiva: 'Conversación sin atender', etapa: 'Está en una etapa', puntaje: 'La IA lo puntúa',
};

export const ACCION: Record<string, string> = {
  enviar_plantilla: 'Enviar plantilla', mensaje_ia: 'Mensaje redactado por la IA', crear_tarea: 'Crear tarea',
  cambiar_etapa: 'Cambiar etapa', avisar_equipo: 'Avisar al equipo', puntuar: 'Puntuar el lead',
};
