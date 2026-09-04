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

**En construcción — Fase 1 (frontend de prueba, sin backend):**
- `recursos.html` — biblioteca de descargas por herramienta/curso. Alcance de prueba: Excel y Power BI, 2 cursos cada uno (Básico-Intermedio / Intermedio-Avanzado). Navegación en 3 niveles (Herramientas → Curso con pestañas estilo hoja de Excel → Recursos) con breadcrumb (que en el nivel raíz se convierte en una línea descriptiva). Cada curso muestra: Manual, Casos Prácticos, Plantillas, Skills (prompts de IA) y Contenido Complementario (links de YouTube) — las primeras 4 usan un componente de tarjeta compartido (`renderResGrid` en el script) con ícono + título + subtítulo + botón de descarga. Enlazada desde el nav de `index.html` y `cursos.html` (visible, no oculta — el sitio aún no se comparte y vive en dominio de prueba).
  - **Todo el contenido y los códigos de acceso están hardcodeados en el `<script>` del archivo** (objeto `CURSOS`, ver comentario al inicio del script) — es contenido placeholder, no real, y el candado por curso valida en el cliente contra `curso.codigo` (visible en el código fuente, persiste en `sessionStorage` — se borra al cerrar la pestaña, decisión de Alfredo). El desbloqueo tiene una animación de "Validando…" + éxito antes de revelar los recursos, y el error de código incorrecto tiene un guiño sarcástico ("se autodestruirá en 3…2…1") con shake — hay un contador de intentos fallidos en memoria (`wrongAttempts`) sin persistir a ningún lado, listo por si se quiere escalar el chiste más adelante.
  - **Manual real de prueba:** el curso Excel Intermedio-Avanzado (`excel-ia`) descarga un PDF real (5.5MB) desde `assets/recursos/excel/intermedio-avanzado/manual.pdf` — se agregó directo al repo para probar la descarga end-to-end. **Ojo:** este archivo pesado no debería quedarse en git a largo plazo — en Fase 2 se mueve a Blob Storage junto con el resto de los recursos reales.
  - **Pendiente Fase 2** (no construida todavía): Azure Blob Storage + Table Storage para los recursos reales, Azure Functions (`getRecursos`, `uploadRecurso`, `updateOrden`, `crearCurso`, `gestionarCodigo`) que reemplacen los datos hardcodeados y validen el código server-side, y el panel de administrador (`/admin`) con login Entra ID — shell de menú lateral (Dashboard, Solicitudes, Cotizaciones, Diagnósticos, Recursos, Encuestas, Diplomas) pensado para que los módulos futuros solo agreguen una sección. Ver `prompt-code-recursos-y-backoffice.md` (fuera del repo, en Downloads de Alfredo) para el alcance completo original de estas dos partes.
  - Link de YouTube en el footer (todas las páginas) es **placeholder** (`href="#"`, marcado con comentario `TODO`) — falta el link real del canal.

**En construcción — Backoffice, base de autenticación (arranque de Fase 2):**
- `staticwebapp.config.json` (nuevo, raíz del repo) — protege `/admin` y `/admin/*` exigiendo el rol `admin`. Si alguien sin ese rol entra, Azure lo manda a `/.auth/login/aad` (login de Microsoft) automáticamente.
- `admin/index.html` — shell del panel: menú lateral con los 7 módulos (Dashboard, Solicitudes, Cotizaciones, Diagnósticos, Recursos, Encuestas, Diplomas), todos "Próximamente" salvo Dashboard (mensaje de bienvenida). Muestra el correo de quien inició sesión (vía `/.auth/me`) y una liga para cerrar sesión. Visualmente más simple/utilitario que el sitio público, como marca este documento. Un módulo nuevo se agrega como una sección más del mismo shell, no rediseñando nada.
- **Cómo se le da el rol `admin` a Alfredo — IMPORTANTE, no repetir el error:** se intentó primero con una Azure Function (`api/GetRoles`, `rolesSource` en `staticwebapp.config.json`) que asignaba el rol automáticamente por correo. **Esa función requiere el plan Standard (de paga) de Azure Static Web Apps y tumbó todo el sitio en producción** al desplegarse en el plan Free que se usa aquí (error: `The 'auth' configuration in staticwebapp.config.json is only supported on the Standard SKU`). Se revirtió y se borró `api/GetRoles/`. La alternativa que sí funciona en Free es manual: Alfredo genera una **liga de invitación** desde el portal de Azure (recurso `Web-AlfredoPina` → "Role management" → "Invite"), eligiendo proveedor "Azure Active Directory" y rol `admin`, y la abre una vez iniciando sesión con su cuenta de M365 — eso asocia su cuenta con el rol de forma permanente, sin tocar código. Si en el futuro se necesitan más admins o roles dinámicos por correo, ahí sí se justificaría subir a Standard.
- **Importante — esto NO se puede probar completo en local:** el candado real (`staticwebapp.config.json` + login de Microsoft + rol asignado por invitación) solo lo aplica el runtime de Azure Static Web Apps una vez desplegado. Local solo sirve para revisar que el shell visual funcione; la prueba real es entrar a `/admin` ya en producción, y solo funciona después de que Alfredo haya aceptado la invitación de rol una vez.

**En construcción — Recursos, backend real (Fase 2 del módulo, camino de lectura primero):**
- Primer módulo del sitio que necesita una **Storage Account de Azure de verdad** — no existía ninguna (Agenda usa un link .ics, no Storage). Recurso nuevo: cuenta `apcwebrecursos` (o variante si el nombre está tomado) en el grupo `GR_AlfredoPina`, región Central US, redundancia LRS. Contenedor Blob `recursos` (acceso público a nivel Blob, no a nivel contenedor — así los archivos se descargan directo sin pasar por una Function). Dos tablas: `Cursos` (metadatos + código de cada curso) y `Recursos` (metadatos de cada recurso: herramienta, curso, tipo, título, texto, url/contenido, orden). La cadena de conexión vive en la Application Setting `RECURSOS_STORAGE_CONNECTION` del Static Web App — nunca en el repo, mismo patrón que `OUTLOOK_ICS_URL`.
- Decisiones tomadas con Alfredo para esta fase:
  - **Skills (prompts) son texto directo**, no archivo — se capturan como campo de texto en el admin y en `recursos.html` el botón es "Copiar" (al portapapeles), no "Descargar". El resto (Manual, Casos Prácticos, Plantillas) sí son archivos reales en Blob Storage.
  - **Códigos de curso los escribe Alfredo a mano** al crear/rotar un curso (no autogenerados) — se comparten de viva voz en clase, prefiere que sean memorables.
  - **Rotar un código de curso NO saca a nadie que ya desbloqueó ese curso en su navegador** — solo bloquea intentos nuevos con el código viejo. Es intencional (el propósito de rotar es cortar la propagación, no invalidar sesiones activas).
  - **TODO — sin confirmar:** el límite real de tamaño de archivo que aceptan las Functions "administradas" de Static Web Apps no está confirmado (la documentación de Azure es ambigua aquí). El archivo más pesado que Alfredo espera subir por ahora es ~15MB. Falta probarlo en vivo con un archivo real en cuanto exista el endpoint de subida — si falla, la alternativa es subir a Blob directo con un SAS token en vez de pasar el archivo por la Function.
- Orden de construcción acordado: primero `getRecursos` (lectura pública, reemplaza los datos hardcodeados de `recursos.html`) y confirmarlo funcionando en producción; después la parte de administración (subir archivos, crear curso, reordenar, rotar código) en `admin/index.html` → sección Recursos.

**Pendiente / roadmap (ver documentos `Memoria_...` en el Project de claude.ai para detalle completo de cada uno):**
- Módulo de Diagnóstico (con backend desde el inicio, código por empresa autogestionable, panel de reportes con login Entra ID)
- Backend + admin de Recursos (ver arriba)
- Backoffice unificado (cotizaciones, ver solicitudes de temario, reportes cruzados)
- Replicar el constructor de temario de Excel para Power BI, Power Apps, Power Automate, IA Aplicada, Ofimática (hoy son placeholders "Próximamente" en `cursos.html`)
- Separar CSS/JS que sigue inline en `cursos.html` hacia `/assets/`
- Falta una imagen social dedicada (1200x630) para `og:image` — hoy usa `firma-ap.png` como placeholder
- `og:url` / `og:image` en `index.html` y `cursos.html` apuntan a `alfredopina.ai` — actualizar si se sigue sirviendo desde el dominio viejo de LifeZen al momento de publicar

**Ya resueltos** (no reabrir salvo pedido explícito):
- Favicon (ícono "fx" en 16x16/32x32/apple-touch-icon), meta tags Open Graph básicas y `.gitignore` — listos
- Símbolo SVG fantasma de piña (`pineappleMark`, nunca usado) — eliminado de `index.html` y `cursos.html`
- Bug de scroll: los links del menú aterrizaban con el título tapado por las barras sticky (nav + barra "Conóceme") — corregido con `scroll-margin-top` por breakpoint en `style.css`

## Historial de sesiones

Formato de cada entrada: `Fecha Módulo: Acciones` — un título corto por sesión de trabajo, con el detalle en bullets debajo. Agregar una entrada nueva (más reciente arriba) al cerrar cada sesión.

### 2026-09-04 alfredo.pina: Recursos — backend real, camino de lectura
- Creada la Function `api/getRecursos` (v3 clásico, pública): recibe herramienta + curso + código, valida el código contra la tabla `Cursos` de Azure Table Storage y, si coincide, regresa los recursos de la tabla `Recursos` agrupados por tipo (manuales, casos, plantillas, skills, extra)
- Creado `api/src/recursos-tables.js` — cliente compartido de Table Storage (reutilizable por las Functions de administración que faltan)
- `recursos.html` reescrito para pedir los datos a `/api/getRecursos` en vez de usar el objeto `CURSOS` hardcodeado — ya no expone el código ni el contenido en el código fuente. Los datos ya desbloqueados se cachean en `sessionStorage` por curso (para no repetir la llamada al cambiar de pestaña)
- Skills ahora usa botón "Copiar" (al portapapeles) en vez de "Descargar", según lo acordado con Alfredo
- Agregado `RECURSOS_STORAGE_CONNECTION` a `api/local.settings.json.example`
- Requiere que Alfredo termine de crear el Storage Account + tablas + la Application Setting en el portal de Azure (ver sección de arriba) — sin eso, el candado de `recursos.html` va a mostrar "no se pudo validar el código" en vez de funcionar de verdad. Todavía no probado en producción por eso.
- Pendiente para la siguiente sesión: la parte de administración (subir archivos, crear curso, reordenar, rotar código) en `admin/index.html` → sección Recursos, más las Functions `uploadRecurso`, `crearCurso`, `updateOrden`, `gestionarCodigo`

### 2026-09-04 alfredo.pina: Backoffice — base de login con Entra ID (arranque Fase 2)
- Creado `staticwebapp.config.json` protegiendo `/admin` y `/admin/*` con el rol `admin` (redirige a login de Microsoft si no hay sesión)
- Creada la Function `api/GetRoles` (v3 clásico) que le da el rol `admin` solo a los correos en `ADMIN_EMAILS` — hoy solo `alfredo.pina@lifezen.com.mx`, fácil de ampliar después
- Construido el shell de `admin/index.html`: menú lateral con los 7 módulos del backoffice (Dashboard funcional con bienvenida, el resto "Próximamente"), correo de sesión + cerrar sesión en la barra superior
- Corregido un bug de overlap en el topbar del admin en pantallas angostas (le faltaba `flex-wrap` y truncar el texto largo de depuración de `/.auth/me`)
- **Incidente:** ese primer push (commit `91b4fd2`) tumbó todo el sitio en producción — el bloque `auth.rolesSource` de `staticwebapp.config.json` requiere el plan Standard y este sitio está en Free, así que Azure rechazó el deploy completo (no solo `/admin`). Diagnosticado vía GitHub Actions (el log de "Build And Deploy" tiene el error exacto) y corregido en el commit `fc3fc80`: se quitó el bloque `auth` y se borró `api/GetRoles/`. La asignación del rol `admin` se mueve a invitación manual desde el portal de Azure (ver arriba) — pendiente que Alfredo la genere y la acepte una vez para poder entrar a `/admin`.

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
