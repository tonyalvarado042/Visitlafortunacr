import type { Rol } from '@/lib/supabase-sesion';

/*
 * Quién ve qué en el panel. El admin ve todo; los demás, lo suyo. La regla
 * fina (qué fila puede tocar cada quien) la ponen las políticas de la base:
 * esto solo decide qué aparece en el menú y qué páginas se abren.
 */
export type Seccion =
  | 'tablero' | 'leads' | 'conversaciones' | 'viajeros' | 'reservas' | 'tareas'
  | 'negocios' | 'tours' | 'guias' | 'ia' | 'reportes' | 'equipo' | 'ajustes';

export const MENU: { seccion: Seccion; ruta: string; nombre: string; grupo: string }[] = [
  { seccion: 'tablero',        ruta: '/admin',                nombre: 'Tablero',        grupo: '' },
  { seccion: 'leads',          ruta: '/admin/leads',          nombre: 'Leads',          grupo: 'Ventas' },
  { seccion: 'conversaciones', ruta: '/admin/conversaciones', nombre: 'Conversaciones', grupo: 'Ventas' },
  { seccion: 'viajeros',       ruta: '/admin/viajeros',       nombre: 'Viajeros',       grupo: 'Ventas' },
  { seccion: 'reservas',       ruta: '/admin/reservas',       nombre: 'Reservas',       grupo: 'Ventas' },
  { seccion: 'tareas',         ruta: '/admin/tareas',         nombre: 'Tareas',         grupo: 'Ventas' },
  { seccion: 'negocios',       ruta: '/admin/negocios',       nombre: 'Negocios',       grupo: 'Contenido' },
  { seccion: 'tours',          ruta: '/admin/tours',          nombre: 'Tours',          grupo: 'Contenido' },
  { seccion: 'guias',          ruta: '/admin/guias',          nombre: 'Guías',          grupo: 'Contenido' },
  { seccion: 'ia',             ruta: '/admin/ia',             nombre: 'Inteligencia',   grupo: 'IA' },
  { seccion: 'reportes',       ruta: '/admin/reportes',       nombre: 'Reportes',       grupo: 'Dirección' },
  { seccion: 'equipo',         ruta: '/admin/equipo',         nombre: 'Equipo',         grupo: 'Dirección' },
  { seccion: 'ajustes',        ruta: '/admin/ajustes',        nombre: 'Ajustes',        grupo: 'Dirección' },
];

const TODAS = MENU.map((m) => m.seccion);

export const PERMISOS: Record<Rol, Seccion[]> = {
  admin:     TODAS,
  vendedor:  ['tablero', 'leads', 'conversaciones', 'viajeros', 'reservas', 'tareas', 'ia', 'reportes'],
  editor:    ['tablero', 'negocios', 'tours', 'guias', 'ia'],
  moderador: ['tablero', 'conversaciones', 'negocios', 'ia'],
  socio:     ['tablero', 'reportes'],
};

export function puedeVer(rol: Rol, seccion: Seccion): boolean {
  return PERMISOS[rol]?.includes(seccion) ?? false;
}

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador', vendedor: 'Vendedor', editor: 'Editor', moderador: 'Moderador', socio: 'Socio',
};
