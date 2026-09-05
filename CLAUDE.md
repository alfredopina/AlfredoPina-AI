# CLAUDE.md — alfredopina.ai

## Sobre este proyecto

Sitio de marca personal de Alfredo Piña (Ingeniero Industrial, instructor/consultor de Excel, Power BI, Power Platform e IA, 15 años de experiencia, cientos de empresas, miles de profesionistas capacitados). El sitio centraliza y automatiza su negocio de capacitación: landing, catálogo de cursos con temario personalizable, calendario de disponibilidad, y a futuro diagnósticos de nivel, cotizador, recursos descargables y un backoffice/CRM.

Al responder o construir, prioriza legibilidad y mantenibilidad sobre cleverness. Pregunta antes de tomar decisiones de arquitectura grandes que no estén ya cubiertas aquí.

## Stack técnico

- **Front-end:** HTML/CSS/JS puro (sin frameworks, sin build step). No usar Power Pages ni Power Platform de bajo nivel para el front — decisión intencional de no depender solo del ecosistema Microsoft para el sitio.
- **Hosting:** Azure Static Web Apps (tier **Free**), recurso `Web-AlfredoPina`, grupo de recursos `GR_AlfredoPina`, región Central US. **URL real de producción:** `https://icy-smoke-071e3ec10.7.azurestaticapps.net/` (ojo con el `.7.` antes de `azurestaticapps.net` — el nombre del workflow de GitHub Actions no lo incluye, es fácil adivinar mal la URL a partir de él, ya pasó una vez).
- **Deploy:** GitHub → GitHub Actions → Azure Static Web Apps, automático al hacer push a `main`. No tocar el workflow YAML autogenerado salvo que se sepa exactamente qué se está cambiando.
- **Backend:** Azure Functions (carpeta `api/`), modelo **v3 clásico** (carpeta + `function.json`), NO modelo v4 (`app.http(...)`) — el v4 falla en Static Web Apps managed functions por una feature flag no configurable en ese hosting. Ya hubo que corregir esto una vez, no repetir el error.
- **Base de datos:** Azure Table Storage para módulos aislados (ej. Calendario). Para el futuro backoffice (que cruza Diagnóstico + Cotizaciones + Recursos), evaluar Azure SQL Database (tier serverless barato) en vez de Table Storage, porque los reportes van a necesitar cruzar datos entre módulos.
- **Repo:** `github.com/alfredopina/AlfredoPina-AI` (público).
- **Dominio:** `alfredopina.ai` decidido, aún no conectado (se prueba con un dominio viejo de LifeZen mientras se termina contenido).

## Identidad de marca — YA CERRADA, no reabrir sin que Alfredo lo pida explícitamente

- **Logo:** firma vectorizada de Alfredo (NO un ícono de piña, aunque alguna variable interna del código se llame parecido a "pineapple" — verificar código real antes de asumir, puede ser solo un nombre de variable mal puesto). Color único: gris carbón `#3a3a3a`.
- **Motivo visual insignia:** barra de fórmula estilo Excel (`fx =FUNCIÓN()`) — ya usado en Hero, "Hablemos"/Contacto, y el constructor de temario de Cursos. Reutilizar cuando tenga sentido narrativo en módulos nuevos (ej. Diagnóstico).
- **Paleta por herramienta/curso:** Excel `#22c55e` · Power BI `#f2c94c` · Power Apps `#c026d3` · Power Automate `#06b6d4` · IA Aplicada `#a78bfa` · Ofimática `#f97316`. Azul de marca general `#3d7fff` / `#6b9fff`.
- **Variables de diseño base:** `--bg: #0a0d12`, `--panel: #10141b`. Tipografías: `Space Grotesk` (display/títulos), `Inter` (body), `JetBrains Mono` (elementos tipo código/fórmula).
- **Alfredo tiene deuteranomalía** (daltonismo parcial rojo-verde) — NUNCA codificar información solo por color; siempre acompañar con ícono, texto o posición.
- **Sin emojis en el diseño del sitio** — iconografía SVG de línea (stroke, no relleno).
- **Sin subtítulos largos bajo títulos de sección** — patrón: eyebrow corto + título con gancho, directo al contenido.
- Estilo general: dark/tech, dinámico y moderno, dashboards animados. Tono de marca (copy): directo, práctico, con humor/sarcasmo ligero, sin caer en genérico motivacional.

## Patrón de trabajo establecido: fases

Para módulos que lo permiten (no todos), construir en 2 fases:
1. **Fase 1 — visual/funcional sin backend**, iterar rápido en el navegador
2. **Fase 2 — backend real** (Azure Function + storage), una vez que la UX ya convenció

Excepción: el módulo de Diagnóstico y el futuro backoffice SÍ necesitan backend desde el día uno (no se puede separar), porque el valor central depende de persistir datos ligados a identidad desde el principio.

## Patrón de acceso a páginas privadas/semi-privadas

- **Público pero oculto** (ej. `agenda.html`): sin login, sin liga en el menú de navegación, con meta `noindex`, accesible solo por quien tiene el link directo.
- **Link + código corto** (ej. futuro módulo de Recursos y Diagnóstico): además del link, un código corto que Alfredo comparte manualmente (en clase, por WhatsApp) — no es cuenta de usuario, no se guarda contraseña. Los códigos deben ser autogestionables por Alfredo desde un panel simple, sin que requiera tocar código cada vez que necesita uno nuevo.
- **Login real** (zona de reportes/backoffice, datos personales de terceros): usar la autenticación integrada de Azure Static Web Apps con Microsoft Entra ID, aprovechando la cuenta de M365 que Alfredo ya tiene. No construir sistema de usuarios/contraseñas desde cero.

## Estado del proyecto (puede desactualizarse — confirmar contra el repo real)

**Publicado y en producción:**
- `index.html` — landing con Hero, Stats, Experiencia, Certificaciones, Clientes, Herramientas (6 tarjetas enlazando a cursos.html), Metodología
- `cursos.html` — constructor de temario interactivo por categoría, con la barra de fórmula animada, código de color por herramienta
- `agenda.html` + `api/getAvailability/` — calendario de disponibilidad conectado a Outlook real vía Microsoft Graph, funcionando en producción

**En construcción — Backoffice, base de autenticación (arranque de Fase 2):**
- `staticwebapp.config.json` (nuevo, raíz del repo) — protege `/admin` y `/admin/*` exigiendo el rol `admin`. Si alguien sin ese rol entra, Azure lo manda a `/.auth/login/aad` (login de Microsoft) automáticamente.
- `admin/index.html` — shell del panel: menú lateral con los 7 módulos (Dashboard, Solicitudes, Cotizaciones, Diagnósticos, Recursos, Encuestas, Diplomas), todos "Próximamente" salvo Dashboard (mensaje de bienvenida). Muestra el correo de quien inició sesión (vía `/.auth/me`) y una liga para cerrar sesión. Visualmente más simple/utilitario que el sitio público, como marca este documento. Un módulo nuevo se agrega como una sección más del mismo shell, no rediseñando nada.
- **Cómo se le da el rol `admin` a Alfredo — IMPORTANTE, no repetir el error:** se intentó primero con una Azure Function (`api/GetRoles`, `rolesSource` en `staticwebapp.config.json`) que asignaba el rol automáticamente por correo. **Esa función requiere el plan Standard (de paga) de Azure Static Web Apps y tumbó todo el sitio en producción** al desplegarse en el plan Free que se usa aquí (error: `The 'auth' configuration in staticwebapp.config.json is only supported on the Standard SKU`). Se revirtió y se borró `api/GetRoles/`. La alternativa que sí funciona en Free es manual: Alfredo genera una **liga de invitación** desde el portal de Azure (recurso `Web-AlfredoPina` → "Role management" → "Invite"), eligiendo proveedor "Azure Active Directory" y rol `admin`, y la abre una vez iniciando sesión con su cuenta de M365 — eso asocia su cuenta con el rol de forma permanente, sin tocar código. Si en el futuro se necesitan más admins o roles dinámicos por correo, ahí sí se justificaría subir a Standard.
- **Confirmado funcionando en producción** (2026-09-04): Alfredo generó su invitación de rol desde el portal (Role management → Invite → Azure Active Directory → rol `admin`), la aceptó iniciando sesión con `alfredo.pina@lifezen.com.mx`, y entrar a `/admin` ya lo reconoce y lo deja pasar. El candado real solo se puede probar así, desplegado — local solo sirve para revisar el shell visual.

**Publicado y en producción — Recursos, backend real completo (lectura + escritura):**
- Primer módulo del sitio con una **Storage Account de Azure de verdad** — no existía ninguna antes (Agenda usa un link .ics, no Storage). Cuenta creada: **`apcwebrecursos`**, grupo `GR_AlfredoPina`, región Central US, Standard/LRS, tipo StorageV2. Contenedor Blob `recursos` (nivel de acceso "Blob" — acceso anónimo de solo lectura por archivo, no se puede listar el contenedor completo; requirió habilitar "Permitir el acceso anónimo en contenedores individuales" a nivel cuenta, que no viene activado por default). Dos tablas: `Cursos` (PartitionKey=herramienta, RowKey=curso id, propiedades `nombre`/`codigo`/`estado`/`orden`) y `Recursos` (PartitionKey=`<herramienta>_<cursoId>`, propiedades `tipo`/`titulo`/`texto`/`url`/`blobPath`/`orden`). La cadena de conexión vive en la Application Setting `RECURSOS_STORAGE_CONNECTION` del Static Web App (en el portal nuevo esto vive bajo **"Variables de entorno"**, ya no bajo "Configuración") — nunca en el repo, mismo patrón que `OUTLOOK_ICS_URL`. La misma connection string sirve tanto para Table como para Blob Storage (`api/src/recursos-tables.js` expone `getCursosTable`, `getRecursosTable` y `getRecursosContainer`).
- **Lectura (pública):** `api/getRecursos` recibe herramienta+curso+código por query string, valida contra `Cursos` (código Y `estado === "publicado"`) y si coincide regresa los recursos de `Recursos` agrupados por tipo. `api/getCatalogoRecursos` regresa, para las 6 herramientas, la lista de cursos publicados (solo id+nombre) — `recursos.html` ya no hardcodea qué herramientas/cursos existen, arma el nivel 1 (grid) y el nivel 2 (pestañas) dinámicamente con esta llamada al cargar, y solo muestra "Próximamente" en las herramientas sin ningún curso publicado.
- **Escritura (protegida, rol `admin`):** `api/crearCurso` (upsert de un curso — también sirve para "rotar código", es guardar el mismo curso con un código distinto, no hay Function aparte), `api/eliminarCurso`, `api/uploadRecurso` (sube archivo a Blob + fila en `Recursos`), `api/editarRecurso` (upsert de Skills/Contenido Complementario, que no llevan archivo, y edición de título/texto de los que sí sin tocar el archivo), `api/eliminarRecurso`, `api/updateOrden` (genérico — reordena `Cursos` o `Recursos` según qué tabla se le mande, para el drag & drop de pestañas y de recursos), `api/listCursosAdmin` (lista todos los cursos de una herramienta sin importar estado, con código visible) y `api/getRecursosAdmin` (recursos de un curso sin agrupar y con `rowKey`, sin exigir código ni que esté publicado).
- `admin/index.html` → sección Recursos: espejo del sitio público en 3 niveles (Herramientas → pestañas de curso con indicador de estado, ícono+texto nunca solo color por la deuteranomalía de Alfredo, con drag & drop de orden → 5 secciones de recursos con alta/edición inline/borrado/reordenar). SortableJS (CDN) para el drag & drop. Incluye switch de tema claro/oscuro (recordado en `localStorage`, default oscuro) — se agregó porque el contraste original de las etiquetas (`--text-faint`) no se leía bien.
- **Nuevo campo `estado`** (`borrador`/`publicado`) en `Cursos` — un curso nace en borrador y no es alcanzable desde el sitio público hasta que Alfredo lo publica desde el admin (el switch **no** exige que ya tenga recursos cargados — si lo publicas vacío, cualquiera con el código ve las 5 secciones en blanco). Se agregó también `orden` (curso, para el orden de pestañas) junto al `orden` (recurso) que ya existía.
- **Confirmado funcionando de punta a punta en producción** (2026-09-04/05): Alfredo subió el manual real (~15MB) del curso `excel-bi` desde el admin sin problema — con esto queda cerrada la duda de si las Functions "administradas" de Static Web Apps aceptan archivos de ese tamaño (sí, mandados como base64 dentro de JSON, ver bug de abajo).
- **TODO — cosmético:** el nombre de prueba quedó como "Basico-Intermedio" sin acento en el curso `excel`/`excel-bi` (código `EXCEL2026`) — corregirlo desde el admin junto con publicarlo cuando Alfredo termine de cargarle contenido real.
- **Nombre de archivo al descargar:** `uploadRecurso` manda `blobContentDisposition` al subir (`attachment; filename="..."`, con variante `filename*=UTF-8''...` para acentos/ñ). **Esto solo no bastó** — Azure Blob Storage solo regresa `Content-Disposition` en la respuesta si la petición trae un `x-ms-version` moderno; las peticiones anónimas normales (como la de cualquier navegador al hacer clic en "Descargar") no mandan ese header y Azure las atiende con una versión de API de **2009**, de antes de que existiera esa propiedad, así que la omitía por completo — se veía como si el fix no sirviera, aunque el blob sí tenía el nombre bien guardado. Se corrigió configurando `DefaultServiceVersion: 2021-08-06` en la Storage Account `apcwebrecursos` (`az storage account blob-service-properties update --account-name apcwebrecursos --resource-group GR_AlfredoPina --default-service-version 2021-08-06`, corrido por Alfredo desde Azure Cloud Shell) — con eso, las peticiones sin versión especificada usan ese default en vez de 2009, y `Content-Disposition` ya se ve en cualquier descarga normal, **incluyendo archivos ya subidos antes del fix** (es una propiedad de la cuenta, no algo que haya que rehacer por archivo).
- **`sessionStorage` de `recursos.html` puede mostrar datos viejos:** una vez que alguien desbloquea un curso en una pestaña, esa pestaña guarda la respuesta de `getRecursos` y no la vuelve a pedir (para no repetir el código al cambiar de tab). Si Alfredo agrega/edita recursos desde el admin mientras esa misma pestaña sigue abierta y ya desbloqueada, no va a ver los cambios hasta cerrar y reabrir la pestaña (o borrar datos del sitio) — no es un bug, es el trade-off de esa decisión de diseño.

**Pendiente / roadmap (ver documentos `Memoria_...` en el Project de claude.ai para detalle completo de cada uno):**
- Módulo de Diagnóstico (con backend desde el inicio, código por empresa autogestionable, panel de reportes con login Entra ID)
- Backoffice unificado (cotizaciones, ver solicitudes de temario, reportes cruzados)
- Replicar el constructor de temario de Excel para Power BI, Power Apps, Power Automate, IA Aplicada, Ofimática (hoy son placeholders "Próximamente" en `cursos.html`)
- Separar CSS/JS que sigue inline en `cursos.html` hacia `/assets/`
- Falta una imagen social dedicada (1200x630) para `og:image` — hoy usa `firma-ap.png` como placeholder
- `og:url` / `og:image` en `index.html` y `cursos.html` apuntan a `alfredopina.ai` — actualizar si se sigue sirviendo desde el dominio viejo de LifeZen al momento de publicar
- Link de YouTube en el footer (todas las páginas) es **placeholder** (`href="#"`, marcado con comentario `TODO`) — falta el link real del canal

**Ya resueltos** (no reabrir salvo pedido explícito):
- **CSS — un `<button>` no hereda color/fuente del sitio a menos que se le diga explícitamente:** en el admin, `.radm-tool-card` (las tarjetas de herramienta) no traía `color`/`font` propios, así que el navegador usaba su gris de sistema para el texto en vez del blanco del sitio — se veía casi ilegible. Cualquier componente nuevo del admin hecho con `<button>` necesita `color`/`font` explícitos (o `font:inherit;color:inherit;`) si no va a fijar su propio color — no asumir que hereda solo porque un `<div>` sí lo haría.
- **Bug de plataforma — no volver a nombrar una Function `admin<Algo>`:** las Functions `adminListCursos` y `adminGetRecursos` regresaban 404 real (no un error nuestro) SOLO cuando se llamaban ya autenticado como admin — sin sesión, la regla de seguridad redirigía normal (302) a login, lo cual despistó bastante porque parecía que la Function sí existía. Con sesión, en cambio, Azure nunca lograba encontrar la Function de verdad. La causa más probable: el nombre de la ruta empezaba con la palabra "admin", la misma que usa la regla `/admin/*` de `staticwebapp.config.json` para proteger el panel — aunque técnicamente viven en `/api/`, no en `/admin/`, algo en el motor de rutas de Azure las confundía. Se resolvió renombrando las rutas a `listCursosAdmin` y `getRecursosAdmin` (la palabra "Admin" al final, no al inicio) — nunca más nombrar una ruta de API empezando con "admin".
- **Bug de plataforma — el cuerpo binario crudo no llega como `Buffer` en managed functions:** `uploadRecurso` se diseñó al inicio para recibir el archivo como cuerpo binario crudo (`"dataType": "binary"` en `function.json`, `fetch(url, {body: file})`) para no pagar el costo de convertirlo a base64. En el runtime de las "managed functions" de Static Web Apps, `req.body` llegaba como `string`, no como `Buffer`, y tronaba al subirlo a Blob Storage. Se corrigió mandando el archivo como base64 dentro de un JSON normal (mismo patrón que ya usan todas las demás Functions) — `Buffer.from(fileBase64, "base64")` del lado del servidor. ~33% más pesado el payload, pero confiable; así se subió sin problema el manual real de ~15MB.
- Recursos Fase 1 (frontend de prueba con contenido y códigos hardcodeados en `recursos.html`) — completamente superada por el backend real (lectura + escritura, ver arriba); ya no queda código de esa fase en el repo
- Favicon (ícono "fx" en 16x16/32x32/apple-touch-icon), meta tags Open Graph básicas y `.gitignore` — listos
- Símbolo SVG fantasma de piña (`pineappleMark`, nunca usado) — eliminado de `index.html` y `cursos.html`
- Bug de scroll: los links del menú aterrizaban con el título tapado por las barras sticky (nav + barra "Conóceme") — corregido con `scroll-margin-top` por breakpoint en `style.css`

## Historial de sesiones

Formato de cada entrada: `Fecha Módulo: Acciones` — un título corto por sesión de trabajo, con el detalle en bullets debajo. Agregar una entrada nueva (más reciente arriba) al cerrar cada sesión.

### 2026-09-04 alfredo.pina: Recursos — backend real, camino de escritura (admin) + 2 bugs de plataforma
- Iterado en texto el diseño del panel antes de construir: qué se configura (cursos por herramienta, materiales, códigos, textos, orden, estado), 3 decisiones de arquitectura confirmadas con Alfredo — subida de archivo por la Function (no SAS, más simple aunque terminó necesitando un ajuste, ver abajo), estado borrador/publicado por curso, y layout del admin espejo del sitio público
- Agregado el campo `estado` (`borrador`/`publicado`) y `orden` a la tabla `Cursos` — `api/getRecursos` ahora exige `estado === "publicado"` además del código, para que un curso a medio armar no sea alcanzable desde el sitio público
- Creadas 9 Functions nuevas (v3 clásico, mismo patrón `body`+`headers` que ya usaba `getRecursos`): `getCatalogoRecursos` (pública) y 8 protegidas con `allowedRoles:["admin"]` — `crearCurso`, `eliminarCurso`, `uploadRecurso`, `editarRecurso`, `eliminarRecurso`, `updateOrden`, `listCursosAdmin`, `getRecursosAdmin`
- `recursos.html` reescrito para pedir `/api/getCatalogoRecursos` al cargar en vez de usar los objetos `TOOLS`/`CURSOS` hardcodeados
- Construido el panel completo en `admin/index.html` → sección Recursos: 3 niveles con SortableJS para drag & drop, formularios inline en vez de modales, más un switch de tema claro/oscuro y mejor contraste de texto (Alfredo no distinguía bien las etiquetas apagadas)
- **Desplegado y depurado en vivo — 2 bugs de plataforma encontrados y corregidos** (detalle completo en "Ya resueltos" arriba):
  1. `adminListCursos`/`adminGetRecursos` regresaban 404 real solo estando autenticado — el nombre empezaba con "admin" y chocaba con la regla `/admin/*`. Se renombraron a `listCursosAdmin`/`getRecursosAdmin`. En el camino también se agregó `Cache-Control: no-store` a todas las respuestas (no era la causa raíz, pero es buena práctica y no sobra)
  2. `uploadRecurso` fallaba al subir cualquier archivo porque el cuerpo binario crudo llegaba como `string`, no `Buffer`, en el runtime de managed functions — se cambió a mandar el archivo en base64 dentro de un JSON normal
  - Ambos se diagnosticaron pidiéndole a Alfredo que revisara la consola del navegador (F12) y probara URLs/`fetch()` puntuales — sin acceso directo a los logs de Azure, esa fue la única forma de ver el error real
- **Confirmado funcionando de punta a punta en producción**: Alfredo subió el manual real (~15MB) al curso `excel-bi` sin problema — cierra también la duda pendiente del límite de tamaño de archivo
- Ronda final de ajustes tras revisión visual de Alfredo en `recursos.html`: contraste de `--text-dim`/`--text-faint` subido **en todo el sitio público** (`assets/css/style.css`, no solo el admin — override explícito de Alfredo a la paleta "cerrada"), corregido el espaciado pegado del título "MANUAL" (tenía `margin-top:0` a propósito para no duplicar el espacio de las pestañas, pero quedaba demasiado pegado), y agregado `Content-Disposition` al subir un archivo para que la descarga conserve el nombre real en vez del nombre interno del blob
- **Pendiente para la siguiente sesión:** publicar el curso `excel-bi` desde el admin (corrigiendo de paso el nombre "Basico-Intermedio" sin acento) para que aparezca en `recursos.html`, volver a subir los manuales de prueba para que les aplique el nombre de descarga correcto, y probar el resto de tipos de recurso (Casos, Plantillas, Contenido Complementario) y el reordenamiento por drag & drop

### 2026-09-04 alfredo.pina: Recursos — backend real, camino de lectura
- Creada la Function `api/getRecursos` (v3 clásico, pública): recibe herramienta + curso + código, valida el código contra la tabla `Cursos` de Azure Table Storage y, si coincide, regresa los recursos de la tabla `Recursos` agrupados por tipo (manuales, casos, plantillas, skills, extra)
- Creado `api/src/recursos-tables.js` — cliente compartido de Table Storage (reutilizable por las Functions de administración que faltan)
- `recursos.html` reescrito para pedir los datos a `/api/getRecursos` en vez de usar el objeto `CURSOS` hardcodeado — ya no expone el código ni el contenido en el código fuente. Los datos ya desbloqueados se cachean en `sessionStorage` por curso (para no repetir la llamada al cambiar de pestaña)
- Skills ahora usa botón "Copiar" (al portapapeles) en vez de "Descargar", según lo acordado con Alfredo
- Agregado `RECURSOS_STORAGE_CONNECTION` a `api/local.settings.json.example`
- Alfredo creó el Storage Account (`apcwebrecursos`), el contenedor `recursos` y las tablas `Cursos`/`Recursos` desde el portal, guiado paso a paso (primera vez que usa ese tipo de recurso) — ver el checklist completo en la sección de arriba
- Bug encontrado y corregido en el camino: `context.res.jsonBody` no se serializaba en este runtime (regresaba 200 con cuerpo vacío) — se corrigió a `body` + `headers` explícitos, igual que `getAvailability`
- **Confirmado funcionando de punta a punta en producción**: se creó una entidad de prueba en `Cursos` a mano desde el portal y se desbloqueó un curso real en `recursos.html` contra el Storage real (recursos vacíos porque la tabla `Recursos` todavía no tiene contenido — esperado)
- Pendiente para la siguiente sesión: la parte de administración (subir archivos, crear curso, reordenar, rotar código) en `admin/index.html` → sección Recursos, más las Functions `uploadRecurso`, `crearCurso`, `updateOrden`, `gestionarCodigo`

### 2026-09-04 alfredo.pina: Backoffice — base de login con Entra ID (arranque Fase 2)
- Creado `staticwebapp.config.json` protegiendo `/admin` y `/admin/*` con el rol `admin` (redirige a login de Microsoft si no hay sesión)
- Creada la Function `api/GetRoles` (v3 clásico) que le da el rol `admin` solo a los correos en `ADMIN_EMAILS` — hoy solo `alfredo.pina@lifezen.com.mx`, fácil de ampliar después
- Construido el shell de `admin/index.html`: menú lateral con los 7 módulos del backoffice (Dashboard funcional con bienvenida, el resto "Próximamente"), correo de sesión + cerrar sesión en la barra superior
- Corregido un bug de overlap en el topbar del admin en pantallas angostas (le faltaba `flex-wrap` y truncar el texto largo de depuración de `/.auth/me`)
- **Incidente:** ese primer push (commit `91b4fd2`) tumbó todo el sitio en producción — el bloque `auth.rolesSource` de `staticwebapp.config.json` requiere el plan Standard y este sitio está en Free, así que Azure rechazó el deploy completo (no solo `/admin`). Diagnosticado vía GitHub Actions (el log de "Build And Deploy" tiene el error exacto) y corregido en el commit `fc3fc80`: se quitó el bloque `auth` y se borró `api/GetRoles/`. La asignación del rol `admin` se mueve a invitación manual desde el portal de Azure (ver arriba).
- Alfredo generó y aceptó su invitación de rol `admin` — **`/admin` confirmado funcionando en producción**, protegido y accesible con su cuenta de M365

### 2026-09-04 alfredo.pina: Recursos — ajustes de UX tras primera revisión
- Quitado el eyebrow "RECURSOS" del título (alineado con `agenda.html`/`cursos.html`, que van directo al `h2`), título cambiado a "Descarga los recursos habilitados para tu próximo curso.", y el breadcrumb ahora muestra una línea descriptiva en el nivel raíz y se vuelve funcional al entrar a una herramienta
- Candado: ícono en línea con el texto (antes apilado), animación real al desbloquear (botón "Validando…" con spinner → "Acceso concedido" → transición con fade/slide a los recursos) y mensaje de error con guiño sarcástico + shake + cuenta regresiva animada "3…2…1"
- Reestructurados los recursos por curso: Manual (ahora arreglo, por si algún día hay más de uno), Casos Prácticos (ícono en vez de pill numerado, con botón de descarga), y dos secciones nuevas — Plantillas y Skills (prompts de IA) — todas comparten un mismo componente de tarjeta (`renderResGrid`) para no duplicar código
- Contenido Complementario (antes "Recursos Extra") ahora aparece junto con el footer real del sitio en vez de un botón aislado de YouTube — se agregó el link de YouTube (placeholder) al `contact-meta` del footer en las 4 páginas que lo tienen (`index.html`, `cursos.html`, `agenda.html`, `recursos.html`)
- Agregado un manual real de prueba (PDF de Excel Intermedio-Avanzado, proporcionado por Alfredo) en `assets/recursos/excel/intermedio-avanzado/manual.pdf`, conectado al botón de descarga de ese curso — verificado que descarga correctamente (200, tamaño exacto)
- `sessionStorage` para el desbloqueo se dejó igual (Alfredo confirmó que el comportamiento actual le parece bien)
- Corregido bug de espaciado: el breadcrumb quedaba pegado al título (`h2.section-title` sin margen + `.breadcrumb` sin `margin-top`) en las 3 vistas de `recursos.html` — agregado `margin-top:16px` al breadcrumb, mismo valor que usa `.section-sub` en el resto del sitio

### 2026-09-04 alfredo.pina: Recursos — frontend de prueba (Fase 1)
- Creado `recursos.html`: biblioteca de descargas con navegación en 3 niveles (Herramientas → Curso → Recursos), reutilizando el componente `.course-card`/`.courses-grid` de `index.html` para el nivel 1, y una nueva pestaña estilo "hoja de Excel" (`.excel-tabs`) para elegir entre los 2 cursos de cada herramienta
- Alcance de prueba: solo Excel y Power BI funcionales; Power Apps, Power Automate, IA Aplicada y Ofimática muestran el mismo patrón "PRÓXIMAMENTE" que ya existe en `cursos.html`
- Candado de acceso por curso con la barra `fx =DESBLOQUEAR("código")` (mismo lenguaje visual que `agenda.html`) — código hardcodeado en el JS de la página, sin backend todavía (decisión explícita para esta fase, ver nota en Estado del proyecto)
- Agregada la liga "Recursos" al `nav-links` de `index.html` y `cursos.html` (visible, sin ocultar — decisión de Alfredo: el sitio todavía no se comparte y corre en dominio de prueba)
- Backend (Blob/Table Storage, Azure Functions) y panel `/admin` quedaron fuera de esta sesión a propósito — ver `prompt-code-recursos-y-backoffice.md` para el alcance completo cuando se retome
- Probado el flujo completo en navegador (desbloqueo correcto, código incorrecto, cambio de pestaña, tarjetas bloqueadas) sirviendo el repo con un servidor estático local temporal (no se agregó al proyecto)

### 2026-09-03 alfredo.pina: Limpieza, favicon y bug
- Clonado el repo por primera vez en el equipo de Alfredo y agregado este `CLAUDE.md` al repo
- Eliminado el símbolo SVG fantasma `pineappleMark` (definido pero nunca usado) de `index.html` y `cursos.html`
- Agregado favicon (ícono "fx", mismo motivo visual del sitio) en 16x16, 32x32 y apple-touch-icon, enlazado en `index.html`, `cursos.html` y `agenda.html`
- Agregadas meta tags Open Graph básicas (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`) en `index.html` y `cursos.html`
- Creado `.gitignore` (protege sobre todo `api/local.settings.json`, que puede tener secretos)
- Corregido bug de scroll: los links del menú aterrizaban con el título de la sección tapado por las barras sticky (nav + barra "Conóceme" debajo) — ajustado `scroll-margin-top` con un valor distinto por breakpoint en `style.css`

## Reglas de trabajo con Alfredo

- Está aprendiendo Azure/GitHub/Claude Code activamente — explica brevemente el "por qué" de decisiones técnicas no triviales, no solo el "qué".
- Prefiere que se le proponga con 2-3 opciones y trade-offs antes de que se ejecute algo con impacto de diseño o arquitectura grande.
- No asumas requerimientos nuevos — si algo no está en este documento ni fue pedido explícitamente en la sesión, pregunta antes de construir.
- El Project de claude.ai (chat separado) tiene documentos `Memoria_...md` con el detalle completo de decisiones, historia y razones — este archivo es el resumen operativo, no el reemplazo de esos documentos.
