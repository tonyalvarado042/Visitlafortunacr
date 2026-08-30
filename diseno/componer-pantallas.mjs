import { readFileSync, writeFileSync } from 'node:fs';

const pantallas = [
  { archivo: 'Main.dc.html', titulo: 'Portada', ancho: 1440, alto: 2110,
    nota: 'El titular hace el gancho y el buscador resuelve. Debajo, las siete categorias y las fichas que nadie se salta. Sin fotos de archivo: cada ficha usa un marcador con su inicial sobre el color de su categoria, que es lo que hara el sitio real hasta que cada negocio suba su logo.' },
  { archivo: 'Listado.dc.html', titulo: 'Listado con filtros', ancho: 1440, alto: 1180,
    nota: 'Filtros a la izquierda, resultados a la derecha. El destacado va rotulado DESTACADO PAGADO: se ve arriba porque paga, pero su nota es la que sea. La tercera ficha muestra el estado real de la mitad de la base — datos por confirmar, sin nota todavia — y convierte esa carencia en la invitacion a escribir la primera resena.' },
  { archivo: 'Ficha.dc.html', titulo: 'Ficha de negocio — el dia uno', ancho: 1440, alto: 1660,
    nota: 'Aca se ve la decision que ordena todo el proyecto. El bloque "Lo que dicen en otras plataformas" muestra la nota de Google y Tripadvisor con su fuente y su enlace, y declara en la misma linea que las resenas propias todavia no existen. Nada finge ser nuestro. El bloque vacio de abajo no es un error: es la invitacion.' },
  { archivo: 'Resena.dc.html', titulo: 'Escribir una resena', ancho: 1000, alto: 1290,
    nota: 'El formulario hace visibles las reglas que ya estan en la base: el minimo de 40 caracteres, la fecha de visita que no puede ser futura, el idioma de la resena, y el aviso de que pasa por moderacion antes de publicarse.' },
  { archivo: 'FichaEN.dc.html', titulo: 'La misma ficha, ya con resenas propias y en ingles', ancho: 1000, alto: 900,
    nota: 'El estado maduro del mismo modulo: promedio propio, desglose por estrellas, el agregado externo relegado a una columna lateral, y la respuesta del negocio debajo de la resena — nunca en lugar de ella. La resena de Maria muestra como se marca una traduccion, con enlace al original.' },
  { archivo: 'DireccionB.dc.html', titulo: 'Direccion B — boceto sin construir', ancho: 900, alto: 660, dir: 'b',
    nota: 'La alternativa, por si preferis este camino: mapa a pantalla completa, modo noche, datos en monoespaciada. Sirve al turista que YA esta en La Fortuna y decide en la calle. Se pierde el peso editorial que posiciona en Google, que es de donde vendra el trafico. Si te gusta esta, la construyo completa.' },
];

const partes = pantallas.map((p) => {
  const bruto = readFileSync(p.archivo, 'utf8');
  const cuerpo = bruto.split('</helmet>')[1].split('</x-dc>')[0].trim();
  const escala = Math.min(1, 1120 / p.ancho);
  return `
  <section class="pantalla">
    <div class="cabecera-pantalla">
      <h2>${p.titulo}</h2>
      <p>${p.nota}</p>
    </div>
    <div class="visor" style="height: ${Math.round(p.alto * escala)}px;">
      <div class="lienzo"${p.dir ? ' data-dir="b"' : ''} style="width: ${p.ancho}px; transform: scale(${escala});">
        ${cuerpo}
      </div>
    </div>
  </section>`;
}).join('\n');

const pagina = `<title>Pantallas de visitlafortunacr</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
  :root {
    --ground: #EDEAE3; --panel: #FFFFFF; --ink: #191713; --ink-2: #5E574D;
    --ink-3: #8C8377; --line: #D5CEC2; --acento: #0F5C56;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #14120F; --panel: #1D1A16; --ink: #EDE8E0; --ink-2: #A79E92;
      --ink-3: #7A7266; --line: #2E2A24; --acento: #5FC9B4;
    }
  }
  :root[data-theme="dark"] {
    --ground: #14120F; --panel: #1D1A16; --ink: #EDE8E0; --ink-2: #A79E92;
    --ink-3: #7A7266; --line: #2E2A24; --acento: #5FC9B4;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--ground); color: var(--ink);
    font-family: Archivo, 'Helvetica Neue', Arial, sans-serif;
    font-size: 16px; line-height: 1.6; -webkit-font-smoothing: antialiased;
  }
  .envoltura { max-width: 1184px; margin: 0 auto; padding: 0 32px 88px; }

  header.principal { padding: 60px 0 34px; }
  .rotulo {
    font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--acento);
  }
  h1 {
    font-family: 'Instrument Serif', Georgia, serif; font-weight: 400;
    font-size: clamp(40px, 6.5vw, 66px); line-height: 1.02; letter-spacing: -0.025em;
    margin: 14px 0 0; text-wrap: balance;
  }
  header.principal > p {
    font-size: 19px; line-height: 1.55; color: var(--ink-2);
    margin: 18px 0 0; max-width: 60ch; text-wrap: pretty;
  }

  .pantalla { margin-top: 56px; }
  .cabecera-pantalla { padding-bottom: 18px; border-bottom: 1px solid var(--line); margin-bottom: 20px; }
  .cabecera-pantalla h2 {
    font-family: 'Instrument Serif', Georgia, serif; font-weight: 400;
    font-size: 32px; letter-spacing: -0.015em; margin: 0; text-wrap: balance;
  }
  .cabecera-pantalla p {
    font-size: 15.5px; line-height: 1.6; color: var(--ink-2);
    margin: 10px 0 0; max-width: 78ch; text-wrap: pretty;
  }

  .visor {
    position: relative; overflow: hidden; background: var(--panel);
    border: 1px solid var(--line); border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .lienzo { transform-origin: top left; }
  .lienzo a { color: #1F5D45; text-decoration: none; }
  .lienzo a:hover { color: #C1440E; }
  .lienzo[data-dir="b"] a { color: #7FD4A8; }

  footer {
    margin-top: 64px; padding-top: 22px; border-top: 1px solid var(--line);
    font-family: 'JetBrains Mono', monospace; font-size: 12px;
    color: var(--ink-3); line-height: 1.9;
  }
  footer a { color: var(--acento); }

  @media (max-width: 820px) {
    .envoltura { padding: 0 16px 56px; }
    .cabecera-pantalla h2 { font-size: 26px; }
  }
</style>

<div class="envoltura">
  <header class="principal">
    <div class="rotulo">Direccion A &middot; seis pantallas</div>
    <h1>Pantallas de visitlafortunacr</h1>
    <p>Papel calido, verde selva y naranja de lava. Serif editorial para los titulares, grotesca para el resto. Todos los datos que se ven son reales: Don Rufino, Mistico Park, la Catarata Rio Fortuna y los demas salen de la base ya sembrada. Las notas de Google y Tripadvisor son de muestra hasta que se conecte la API.</p>
  </header>
${partes}
  <footer>
    visitlafortunacr &middot; La Fortuna de San Carlos, Alajuela, Costa Rica<br>
    Fuentes de cada pantalla en el repositorio: diseno/*.dc.html
  </footer>
</div>
`;

writeFileSync('../docs/pantallas.html', pagina);
console.log('OK ' + Math.round(pagina.length / 1024) + ' KB');
