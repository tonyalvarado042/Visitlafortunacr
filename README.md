# visitlafortunacr

Directorio de La Fortuna de San Carlos, Costa Rica: hoteles, restaurantes,
tours, parques, atracciones, transporte y comercio, con resenas de visitantes.

**Estado: fase de diseno.** Todavia no hay sitio web. Lo que existe es el
diseno, el modelo de datos y la base poblada con negocios reales.

## Que hay aca

```
docs/diseno/
  01-nomenclatura.md      Como se nombra todo en este proyecto
  02-arquitectura.md      Stack, rutas, resenas, ingesta, SEO y monetizacion
  03-modelo-datos.md      Las 14 tablas y el porque de cada decision

datos/investigacion/
  negocios-verificados.md 29 negocios de La Fortuna, con su fuente y su
                          estado de verificacion

supabase/
  migraciones/            El esquema directorio, en orden de aplicacion
  semillas/               Categorias, etiquetas y los 29 negocios

diseno/
  *.dc.html               Los seis artboards del canvas de diseno
  canvas.json             Como se colocan en el lienzo
```

## La base de datos

Aplicada y poblada en el esquema `directorio` del proyecto Supabase
`mlhhhwbgymobcxiklnoz`, aislada del esquema `public` donde vive el CRM.
Ver `supabase/migraciones/README.md` para el porque y para recrearla.

| | |
|---|---|
| Tablas | 14 |
| Categorias | 7 principales + 18 subcategorias |
| Etiquetas | 22 |
| Negocios | 29 publicados, 9 con datos verificados en fuente oficial |

## Las tres decisiones que hay que entender antes de tocar nada

1. **Las resenas propias y las ajenas viven en tablas distintas.** Las de
   Google y Tripadvisor son cache con vencimiento y atribucion obligatoria;
   no entran nunca en el promedio propio ni en el marcado JSON-LD.
2. **Una sola tabla `negocio` para las siete categorias.** Lo especifico de
   cada una vive en `atributos` (jsonb) hasta que se use para filtrar, y
   entonces se asciende a columna.
3. **El estado de verificacion es honesto por ficha.** Nada se publica como
   verificado si no se confirmo en fuente oficial. La siembra inicial tiene
   9 de 29.

## Lo siguiente

Antes de escribir la primera linea del sitio:

1. Exponer el esquema `directorio` en la API de Supabase
   (Settings > API > Exposed schemas).
2. Conectar Google Places API para coordenadas, horarios y agregados.
3. Elegir entre las dos direcciones visuales del canvas de diseno.
