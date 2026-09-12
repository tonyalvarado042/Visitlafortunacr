# Dónde dejar las fotos

Arrastrá las imágenes a esta carpeta. **Git la ignora**, así que nada de lo
que pongas acá se va a publicar por accidente.

## La forma fácil (recomendada)

Una carpeta por negocio, con el nombre exacto de la babosa de la lista de
abajo, y las fotos adentro numeradas:

    fotos-entrada/
      baldi-hot-springs/
        1.jpg      <- esta es la portada, la que sale en la tarjeta
        2.jpg
        3.jpg
      tabacon-thermal-resort-spa/
        1.jpg

La **1** es la portada. El resto es la galería de la ficha, en ese orden.

## La forma suelta (también sirve)

Si te da pereza armar carpetas, tirá los archivos sueltos acá con un nombre
que se parezca al negocio:

    fotos-entrada/
      Baldi Hot Springs.jpg
      tabacon 2.jpg
      catarata rio fortuna.png

Yo armo la correspondencia archivo -> negocio y **te la paso a revisar antes
de subir nada**. Lo que no logre emparejar con seguridad te lo listo aparte
en vez de adivinar.

## Formatos y tamaño

- Sirven `.jpg`, `.jpeg`, `.png`, `.webp` y `.avif`.
- Mandá la mejor calidad que tengas y no te preocupes por el peso: el script
  redimensiona y convierte a `webp` antes de subir.
- Lo ideal es horizontal (apaisada). La tarjeta recorta a lo ancho.

## De dónde puede salir una foto (regla 11 del CLAUDE.md)

**El crédito no es una licencia.** Poner "foto de Fulano" debajo no da derecho
a publicarla: la atribución es una *condición* de algunas licencias, no un
sustituto de tenerlas.

**Sí:**

- Tuyas o de Tony.
- Cedidas por el negocio. Decímelo y va con su `credito`.
- De Wikimedia Commons, Unsplash o Pexels con licencia comercial.
- De la API de Google Places, cuando esté la clave.

**No:**

- Capturas de Tripadvisor, Booking o Google Maps.
- Blogs de viaje, Pinterest, búsquedas de Google Imágenes.
- Cualquier licencia `NC` ("non commercial"): esto es un sitio comercial.

Si son todas tuyas, no hace falta hacer nada. Si no, pasame de dónde salió
cada una y yo lleno `credito`, `licencia` y `fuente_url`.

## `_commons/` no se toca

Esa subcarpeta la llena `scripts/buscar-fotos-commons.mjs` con imágenes de
categoría de Wikimedia. Se regenera sola y git la ignora. Tus fotos van en
carpetas con nombre de babosa, al lado.

---

# Los 91 negocios de La Fortuna

La babosa es el nombre de la carpeta. **Ojo: varias no son las que uno
supondría del nombre** — Baldi es `baldi-hot-springs`, el Observatory es
`arenal-observatory-lodge`, Kenko es `kenko-bar-restaurante`.


## Qué hacer (30)

| Negocio | Carpeta (babosa) | Categoría |
|---|---|---|
| Arenal 1968 Volcano View & Trails | `arenal-1968` | Volcán |
| Arenal Mundo Aventura | `arenal-mundo-aventura` | Canopy |
| Baldi Hot Springs Hotel Resort & Spa | `baldi-hot-springs` | Aguas termales |
| Bogarin Trail | `bogarin-trail` | Vida silvestre |
| Catarata Río Fortuna | `catarata-rio-fortuna` | Cataratas |
| Don Juan Coffee & Chocolate Tour | `don-juan-coffee-chocolate-tour` | Café y chocolate |
| Don Olivo Chocolate Tour | `don-olivo-chocolate-tour` | Café y chocolate |
| Ecocentro Danaus | `ecocentro-danaus` | Vida silvestre |
| Ecoglide Arenal Park | `ecoglide-arenal-park` | Canopy |
| Ecotermales Fortuna | `ecotermales-fortuna` | Aguas termales |
| El Chollin | `el-chollin` | Aguas termales |
| El Salto | `el-salto` | Cataratas |
| Kalambu Hot Springs | `kalambu-hot-springs` | Aguas termales |
| Kuru Natural Springs | `kuru-natural-springs` | Aguas termales |
| La Roca Canyoning | `la-roca-canyoning` | Canyoning |
| Los Lagos Hot Springs | `los-lagos-hot-springs` | Aguas termales |
| Mirador El Silencio | `mirador-el-silencio` | Volcán |
| Mistico Arenal Hanging Bridges Park | `mistico-arenal-hanging-bridges-park` | Puentes colgantes |
| Monkey Park La Fortuna | `monkey-park-la-fortuna` | Vida silvestre |
| North Fields Cafe | `north-fields-cafe` | Café y chocolate |
| Paradise Hot Springs | `paradise-hot-springs` | Aguas termales |
| Parque Eco Natura Costa Rica | `parque-eco-natura` | Vida silvestre |
| Parque Nacional Volcán Arenal | `parque-nacional-volcan-arenal` | Parques nacionales |
| Proyecto Asis | `proyecto-asis` | Vida silvestre |
| Pure Trek Canyoning | `pure-trek-canyoning` | Canyoning |
| Sky Adventures Arenal Park | `sky-adventures-arenal-park` | Canopy |
| Tabacón Thermal Resort & Spa | `tabacon-thermal-resort-spa` | Aguas termales |
| Termales Los Laureles | `termales-los-laureles` | Aguas termales |
| The Springs Resort & Spa | `the-springs-resort-spa` | Aguas termales |
| Wave Expeditions | `wave-expeditions` | Rafting |

## Dónde dormir (29)

| Negocio | Carpeta (babosa) | Categoría |
|---|---|---|
| Amor Arenal | `amor-arenal` | Lujo |
| Arenal Backpackers Resort | `arenal-backpackers-resort` | Hostales |
| Arenal Kioro Suites & Spa | `arenal-kioro-suites-spa` | Resorts |
| Arenal Manoa Hot Spring Resort | `arenal-manoa` | Resorts |
| Arenal Montechiari Hotel | `arenal-montechiari` | Hoteles |
| Arenal Oasis Eco Lodge & Wildlife Refuge | `arenal-oasis` | Lodges |
| Arenal Observatory Lodge & Trails | `arenal-observatory-lodge` | Lodges |
| Arenal Springs Resort & Spa | `arenal-springs-resort-spa` | Resorts |
| Casa del Rio | `casa-del-rio` | Hoteles |
| Casa Luna Hotel & Spa | `casa-luna` | Hoteles |
| Hotel El Silencio del Campo | `el-silencio-del-campo` | Hoteles |
| Hotel La Pradera del Arenal | `hotel-la-pradera-del-arenal` | Hoteles |
| Hotel Lavas Tacotal | `lavas-tacotal` | Hoteles |
| Hotel Lomas del Volcan | `lomas-del-volcan` | Hoteles |
| Hotel Magic Mountain | `magic-mountain` | Hoteles |
| Hotel Montana de Fuego | `montana-de-fuego` | Hoteles |
| Hotel Roca Negra del Arenal | `roca-negra-del-arenal` | Hoteles |
| Hotel Secreto La Fortuna | `hotel-secreto-la-fortuna` | Hoteles |
| La Fortuna Lodge | `la-fortuna-lodge` | Lodges |
| Los Lagos Hotel Spa & Resort | `los-lagos-hotel-spa-resort` | Resorts |
| Nayara Gardens | `nayara-gardens` | Resorts |
| Nayara Springs | `nayara-springs` | Lujo |
| Nayara Tented Camp | `nayara-tented-camp` | Lujo |
| Noahs Forest Hotel | `noahs-forest` | Lodges |
| Sangregado Lodge | `sangregado-lodge` | Lodges |
| Selina La Fortuna | `selina-la-fortuna` | Hostales |
| The Royal Corin Thermal Water Spa & Resort | `royal-corin` | Resorts |
| Tifakara Boutique Lodge | `tifakara-lodge` | Lodges |
| Volcano Lodge, Hotel & Thermal Experience | `volcano-lodge` | Hoteles |

## Comer y beber (26)

| Negocio | Carpeta (babosa) | Categoría |
|---|---|---|
| Acacia Restaurant | `acacia-restaurant` | Cocina internacional |
| Bosque Restaurant | `bosque-restaurant` | Cocina internacional |
| Chante Verde | `chante-verde` | Saludable |
| Chifa La Familia Feliz | `chifa-la-familia-feliz` | Cocina internacional |
| Cuenca Restaurante | `cuenca-restaurante` | Cocina internacional |
| Dmi Tierra Comida Tipica | `dmi-tierra` | Comida típica |
| Don Rufino | `don-rufino` | Cocina internacional |
| Jalapas Restaurant | `jalapas-restaurant` | Cocina internacional |
| Kappa Sushi Fortuna | `kappa-sushi-fortuna` | Cocina internacional |
| Kenko Bar & Restaurant | `kenko-bar-restaurante` | Cocina internacional |
| La Choza de Laurel | `la-choza-de-laurel` | Comida típica |
| Maria Bonita Steak House | `maria-bonita-steak-house` | Cocina internacional |
| Mirador Steak House | `mirador-steak-house` | Cocina internacional |
| Pollo Fortuneño | `pollo-fortuneno` | Comida típica |
| Que Rico Arenal | `que-rico-arenal` | Cocina internacional |
| Restaurante Café Mediterráneo | `restaurante-cafe-mediterraneo` | Cocina internacional |
| Restaurante Fortuneno | `restaurante-fortuneno` | Comida típica |
| Restaurante Marisqueria Rojo Coral | `rojo-coral` | Cocina internacional |
| Restaurante Tiquicia La Fortuna | `restaurante-tiquicia` | Comida típica |
| Restaurante Travesia | `restaurante-travesia` | Cocina internacional |
| Selva Negra Cocktail & Wine Bar | `selva-negra-bar` | Bares |
| Soda El Turnito | `soda-el-turnito` | Comida típica |
| Soda Viquez | `soda-viquez` | Comida típica |
| Soda y Restaurante Rodriguez | `soda-rodriguez` | Comida típica |
| Tica Grill | `tica-grill` | Comida típica |
| Tierra Mía Restaurante | `tierra-mia-restaurante` | Comida típica |

## Tours (2)

| Negocio | Carpeta (babosa) | Categoría |
|---|---|---|
| Arenal Jungle Tours | `arenal-jungle-tours` | Aventura |
| Desafío Adventure Company | `desafio-adventure-company` | Aventura |

## Explorar (2)

| Negocio | Carpeta (babosa) | Categoría |
|---|---|---|
| Cavernas de Venado | `cavernas-de-venado` | Atracciones |
| Lago Arenal | `lago-arenal` | Atracciones |

## Transporte (2)

| Negocio | Carpeta (babosa) | Categoría |
|---|---|---|
| Adobe Rent a Car La Fortuna | `adobe-rent-a-car-la-fortuna` | Alquiler de autos |
| Interbus | `interbus-la-fortuna` | Shuttles |
