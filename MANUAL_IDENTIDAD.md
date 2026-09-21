# Manual de identidad — alfredopina.ai (v2, 2026-09-21)

Especificación de la marca. Es la fuente de verdad para el sitio, documentos, redes y diplomas.
La versión visual vive en el artifact "Manual alfredopina.ai" (`https://claude.ai/artifact/Xk9VbmiCK45cBX1WRAR3hg`; es el mismo del enlace viejo `https://claude.ai/code/artifact/f8f8603f-4310-4b79-9b17-bf64cc32670f`, actualizado a v2).
Los SVG del logo se generan con `node tools/build-logos.js` y viven en `assets/img/brand/` — **nunca se editan a mano**.

> v1 (2026-09-09) tenía como logo la firma. v2 la reemplaza por la barra de fórmula y mueve la firma a submarca. El motivo `fx =FUNCIÓN()` ya era el insignia del sitio; ahora es también el logo.

---

## 1. Arquitectura de marca — cuatro piezas, cada una con su trabajo

| Pieza | Qué es | Para qué sirve | Dónde vive |
|---|---|---|---|
| **Nombre** | `alfredopina.ai` | Cómo te encuentran | Dominio, usuario de redes, nombre comercial |
| **Marca (logo)** | Barra de fórmula `fx =alfredopina.ai()` | Cómo te reconocen | Encabezado, portadas, avatar, diplomas |
| **Firma (submarca)** | La firma vectorizada (`assets/img/firma-ap.png`) | Cómo firmas | **Solo** el pie del sitio, con el texto "Created by" |
| **Frase** | Tagline + descriptor (van separados) | Qué prometes y qué haces | Titulares, banners, junto al logo |

**Por qué así:** el logo no tiene que cargar con todo. El nombre se lee normal (Space Grotesk); lo técnico (`=`, paréntesis, `fx`) es el marco. Salir de "LifeZenTraining" a `alfredopina.ai` da nombre propio y deja abierta la puerta a IA sin encasillar en Excel.

**Historia de la marca:** Excel, DAX y Power Fx son lenguajes de fórmulas (Power Fx lleva `fx` en el nombre). `.ai` en el dominio hace que `=ALFREDOPINA.AI()` diga "IA" sin explicarlo. La barra es una celda seleccionada de Excel, con su cuadro de autorrelleno en la esquina (el que se arrastra para continuar la serie: las posibilidades infinitas). Ese cuadrito es el detalle propio del logo.

---

## 2. Logo

Archivos en `assets/img/brand/` (todos con las letras convertidas a curvas):

| Versión | Archivos | Cuándo |
|---|---|---|
| **Principal** (nombre primero) | `logo-principal-claro.svg` / `-oscuro.svg` | Encabezado del sitio, portadas del manual, documentos. La versión por defecto. |
| **Literal** (mayúsculas mono) | `logo-literal-claro.svg` / `-oscuro.svg` | Materiales técnicos de Excel/DAX/Power Fx. Más "gritona": no es la principal. |
| **Con tooltip** | `logo-tooltip-claro.svg` / `-oscuro.svg` | Portadas grandes, redes, presentaciones. Los argumentos cambian por contexto. Solo en tamaños grandes. |
| **Compacto** (`fx \| nombre`, sin caja) | `logo-compacto-claro.svg` / `-oscuro.svg` | Pie de página, encabezado de documentos, firma de correo, cotización. |
| **Diploma** (compacto + "by LifeZenTraining") | `logo-diploma-claro.svg` | Diplomas. Es el compacto con "by LifeZenTraining" debajo del nombre (marca de transición). Solo en claro (el diploma es papel claro). |
| **Ícono** (la celda con `fx`) | `icono-claro.svg` / `-oscuro.svg`, `icono-app.svg`, `favicon.svg` | Avatar, favicon, sello. `icono-app` lleva fondo sólido para avatar. |
| **Por herramienta** | `herramientas/logo-{excel,powerbi,powerapps,powerautomate,ia,ofimatica}-{claro,oscuro}.svg` | Materiales y diplomas de cada curso. El borde y el cuadro de autorrelleno toman el color de la herramienta. |

**Cursor parpadeante:** los SVG son estáticos y **no llevan cursor**. En web se puede agregar con CSS (animación `steps(1)`, respetando `prefers-reduced-motion`); en impreso no va.

**Argumentos del tooltip** (rotables): por defecto son el descriptor: `(productividad; datos; automatización; IA)`. Para un curso de Excel: `(fórmulas; tablas_dinámicas; power_query)`. Para servicios: `(consultoría; capacitación; IA)`.

**Tamaño mínimo:** principal 140 px de ancho (≈ 35 mm impreso); compacto 100 px; ícono 16 px.
**Espacio libre:** un cuarto de la altura de la barra en todos los lados.

**No hacer:** estirar o deformar · cambiar los colores fuera de la paleta · poner la firma en el encabezado ni sustituyendo al logo · meter el tagline dentro del logo · usar el tooltip en tamaños chicos · poner la versión clara sobre fondo oscuro (o al revés) · usar el color puro de una herramienta como color de texto sobre papel.

---

## 3. Firma (submarca)

- Archivo: `assets/img/firma-ap.png` (raster; no se vectorizó).
- **Dónde:** pie del sitio, con el texto **"Created by"** (decidido 2026-09-21). Es sello de autoría.
- **Dónde no:** nunca en el encabezado ni sustituyendo al logo; **nunca en diplomas** (ahí firma solo el instructor).
- Sobre fondo claro se oscurece (`filter:brightness(.62) saturate(1.8)`); sobre oscuro va tal cual.

---

## 4. Frase de marca

Dos capas con nombres distintos:

| Capa | Qué es | Texto | Dónde |
|---|---|---|---|
| **Tagline** (lema) | La actitud o promesa; permanente | **Tu productividad tiene fórmula.** | Titular del hero, banners, portadas, cierre de documentos |
| **Descriptor** | Dice qué haces, literal | **Productividad con Datos · Automatización · IA** | Junto al logo (letra chica), bio de redes, metadescripción |
| *Slogan* | Casi lo mismo, pero de campaña (cambia) | — | Promociones puntuales |

**Regla:** el logo y el descriptor viajan juntos; el tagline va suelto (titular o cierre) y **nunca dentro del logo**. Sin la palabra "capacitación" en la frase: la consultoría también es negocio, y *productividad* abre las dos.

**Por qué "Tu productividad tiene fórmula.":** alude a la marca como fórmula y pone productividad al frente, dominante en jerarquía. Es la sucesora de "Todo problema tiene fórmula." y de la frase larga "Entre un problema y su solución hay una fórmula." (queda como respaldo/manifiesto).

**Alternativas descartadas o de respaldo:** ver el artifact del manual (sección Frase): "Si es repetitivo, tiene fórmula.", "Aprende la fórmula, o la armamos contigo.", "Un problema. Una fórmula. Un resultado."

---

## 5. Color

**Marca**

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| Azul de marca | `#3d7fff` | Monograma, detalles grandes, fondos | 3.6:1 sobre papel (no para texto chico) |
| Azul claro | `#6b9fff` | Texto y detalles sobre fondo oscuro | 7.4:1 sobre oscuro |
| **Azul sobre papel** (nuevo v2) | `#1f5fe0` | El azul de marca oscurecido, para texto azul sobre fondo claro | 5.4:1 sobre papel |

**Base**

| Token | Hex | Uso |
|---|---|---|
| Fondo oscuro | `#0a0d12` | Sitio y admin |
| Panel oscuro | `#10141b` | Tarjetas y barras sobre oscuro |
| Línea oscura | `#1d2530` | Bordes sobre oscuro |
| Tinta | `#0d1424` | Texto principal sobre claro (17.9:1) |
| Papel | `#fbfcff` | Fondo de diplomas y documentos |
| Gris sobre claro | `#586277` | Texto secundario en papel (6.0:1) |
| Gris sobre oscuro | `#a4acb9` | Texto secundario en el sitio (8.5:1) |

**Por herramienta** — el color puro decora (bandas, bordes, cuadro de autorrelleno); la **tinta** es para texto sobre papel:

| Herramienta | Puro | Tinta | Contraste de la tinta |
|---|---|---|---|
| Excel | `#22c55e` | `#15803d` | 4.9:1 |
| Power BI | `#f2c94c` | `#8a6a00` | 4.9:1 |
| Power Apps | `#c026d3` | `#a21caf` | 6.2:1 |
| Power Automate | `#06b6d4` | `#0e7490` | 5.2:1 |
| IA Aplicada | `#a78bfa` | `#6d3fd8` | 6.1:1 |
| Ofimática | `#f97316` | **`#b8500a`** | 4.9:1 |

> **Corrección v2:** la tinta de Ofimática era `#c2570c` (4.4:1, debajo del mínimo de 4.5:1 para texto chico). Se oscureció a `#b8500a`.

**Dos paletas separadas.** Los colores de estado del admin (rojo `#dc2626` urgente, ámbar `#dfb35a` seguimiento, verde-azulado `#14b8a6`/`#0d9488` bien) son solo del panel: significan una condición. No se usan en el logo, el sitio público ni los diplomas.

**Accesibilidad (deuteranomalía):** un color nunca es el único dato. Siempre acompaña ícono, texto o posición (el nombre de la herramienta va junto a su color).

---

## 6. Tipografía

Las tres son de licencia abierta (SIL OFL) y ya son las del sitio:

| Familia | Pesos | Rol |
|---|---|---|
| **Space Grotesk** | 500, 600 | Display: nombre de marca, titulares, nombre del alumno y del curso en el diploma |
| **Inter** | 400, 500, 600 | Cuerpo: párrafos, menús, botones, tablas |
| **JetBrains Mono** | 400–600, cursiva 600 para el `fx` | Fórmula y datos: `fx`, folios, etiquetas, descriptor en letra chica |

---

## 7. Aplicaciones — mapa de uso

| Dónde | Logo | Descriptor | Tagline | Firma |
|---|---|---|---|---|
| Encabezado del sitio | Principal | — | — | — |
| Hero del sitio | — | Bajo el titular | Titular | — |
| Pie del sitio | Compacto | Sí | — | "Created by" |
| Portada de redes | Con tooltip | Dentro, como argumentos | Sí | — |
| Bio de redes | — | Sí | Sí, en una línea | — |
| Portada del manual | Principal | — | Sí | — |
| **Diploma** | Compacto + by LifeZenTraining | — | — | Solo la del instructor |
| Cotización (PDF) | Compacto | Sí | — | Su firma |

**Diploma (decidido 2026-09-21):** logo **compacto** arriba, con **`by LifeZenTraining`** debajo del nombre (mono chico, marca de transición durante **un año**: retirarla hacia **septiembre 2027**); firma solo el instructor; **sin REG. STPS** (queda solo en los DC-3); pie limpio. Color por herramienta: banda con trama y detalles en el color puro; texto de color con la tinta.

---

## 8. Transición desde LifeZenTraining

Se reemplaza la marca por completo, con un puente de un año: `by LifeZenTraining` aparece solo en el logo del diploma, debajo del nombre. No va en el encabezado ni en el sitio nuevo. Al cumplirse el año se quita esa línea (función `logoDiploma` de `tools/build-logos.js`), se regenera y el diploma queda con el compacto solo.

## 9. Pendientes de la identidad

- [ ] **IMPI** (tarea de Alfredo): revisar registro de "Alfredo Piña" / "alfredopina" y disponibilidad de usuarios en redes, antes de imprimir.
- [ ] **Sitio** (otro chat, cuando se afinen sitio y productos): encabezado con el logo principal (sin la firma), pie con "Created by" + firma, favicon nuevo (`favicon.svg`), `og:image`, tagline en el hero.
- [ ] **Diplomas** (chat de Diplomas): rehacer el diploma con este sistema (ver mapa de uso), tinta nueva de Ofimática, sin REG. STPS, logo compacto con `by LifeZenTraining`.
- [ ] `fx` en cursiva real: hoy se genera inclinando el glifo recto ~12°. Si se agrega `api/assets/fonts/JetBrainsMono-MediumItalic.ttf` y se corre `node tools/build-logos.js`, se usa la cursiva verdadera.
- [ ] Correo de contacto `@alfredopina.ai`: aún no existe (arrastrado del manual v1).
