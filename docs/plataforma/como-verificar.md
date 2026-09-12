# Cómo verificar un cambio sin poder abrir el sitio

Leé primero `CLAUDE.md`. Esto es el detalle de una sola frase suya: que el
sitio sí se puede ver en local aunque el proxy tape el despliegue.

El proxy de egress deniega `*.supabase.co` y `*.vercel.app`. Eso no significa
entregar diseño a ciegas: significa que hay que montar la pantalla con datos
inventados y medirla. Tres cosas funcionan y ninguna es obvia.

## 1. Hay Edge en la máquina, y se maneja sin descargar navegadores

`playwright-core` habla con el Edge que ya está instalado. No hace falta
`playwright` entero ni `playwright install`, que se traería cientos de megas.

```bash
npm --prefix <scratchpad> install playwright-core
```

```js
const { chromium } = require('playwright-core');
const nav = await chromium.launch({ channel: 'msedge' });
```

Con eso se puede medir la retícula a varios anchos, detectar desbordes,
capturar pantallas y hasta sacar fotogramas de un video.

**Para desbordes, no sirve mirar la barra de scroll**: `body` lleva
`overflow-x: hidden`. Se comparan los rectángulos contra el ancho del
documento:

```js
[...document.querySelectorAll('body *')]
  .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
```

Y **cuidado con la búsqueda binaria** para encontrar "el ancho mínimo que
funciona": el layout no es monótono. Al pasar de 1240 px reaparecen las
pastillas de idioma y algo que entraba deja de entrar. Barrido lineal.

## 2. Las rutas con punto se saltan el middleware

El matcher de `middleware.ts` excluye `.*\..*`, así que una página en
`app/prueba.loquesea/page.tsx` se abre con `npm run dev` **sin pasar por la
resolución de destino y sin tocar Supabase**. Se le pasan datos inventados al
componente que se quiere ver y se mide de verdad.

Es un andamio, no código: **se borra al terminar**. Que no quede ninguna en el
commit.

## 3. Node ejecuta TypeScript directo

Node 24 corre `.ts` sin compilar, así que la lógica pura se prueba sola:

```bash
node prueba-buscar.ts   # importando, por ejemplo, lib/buscar.ts
```

Por eso conviene que la lógica que se pueda probar viva aparte de React y de
la base: `lib/buscar.ts` es el ejemplo.

**Escribí los casos y creéles.** En la prueba del buscador fallaron tres, y en
los tres el equivocado era yo, no el código: "esquí" normaliza a `esqui`, que
de verdad está dentro de "Esquina del parque"; y "Tabacón **Thermal**" no
contiene "terma", porque es inglés.

## Dos tropiezos que cuestan tiempo

- **El servidor de desarrollo pierde las rutas con punto** al editar archivos:
  empiezan a dar 404 aunque el archivo esté. Se arregla reiniciándolo y
  borrando `.next`.
- **Si el build falla con "Cannot find module for page" de páginas que sí
  existen**, es `.next` en mal estado, no el cambio. `rm -rf .next` y de nuevo.

## Lo que esto no cubre

Mide geometría y estado, no criterio. Si un bucle de video corta bien, si una
animación se siente brusca o si la hamburguesa se toca cómodo con el pulgar en
un iPad de verdad, eso hay que mirarlo en el dispositivo. Conviene decirlo
cuando se entrega, en vez de dar por verificado lo que no se vio.
