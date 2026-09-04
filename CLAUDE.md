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

**Publicado y en producción — Recursos, backend real (camino de lectura):**
- Primer módulo del sitio con una **Storage Account de Azure de verdad** — no existía ninguna antes (Agenda usa un link .ics, no Storage). Cuenta creada: **`apcwebrecursos`**, grupo `GR_AlfredoPina`, región Central US, Standard/LRS, tipo StorageV2. Contenedor Blob `recursos` (nivel de acceso "Blob" — acceso anónimo de solo lectura por archivo, no se puede listar el contenedor completo; requirió habilitar "Permitir el acceso anónimo en contenedores individuales" a nivel cuenta, que no viene activado por default). Dos tablas: `Cursos` (PartitionKey=herramienta, RowKey=curso id, propiedades `nombre`/`codigo`/`estado`/`orden`) y `Recursos` (PartitionKey=`<herramienta>_<cursoId>`, propiedades `tipo`/`titulo`/`texto`/`url`/`blobPath`/`orden`). La cadena de conexión vive en la Application Setting `RECURSOS_STORAGE_CONNECTION` del Static Web App (en el portal nuevo esto vive bajo **"Variables de entorno"**, ya no bajo "Configuración") — nunca en el repo, mismo patrón que `OUTLOOK_ICS_URL`. La misma connection string sirve tanto para Table como para Blob Storage (`api/src/recursos-tables.js` expone `getCursosTable`, `getRecursosTable` y `getRecursosContainer`).
- `api/getRecursos` (Function pública v3 clásico): recibe herramienta+curso+código por query string, valida contra `Cursos` (código Y `estado === "publicado"`) y si coincide regresa los recursos de `Recursos` agrupados por tipo. **Bug ya corregido:** la primera versión usaba `context.res.jsonBody`, que en el runtime de las "managed functions" de Static Web Apps no se serializa (regresaba status 200 con cuerpo vacío) — se corrigió usando `body` + `headers: {"Content-Type":"application/json"}` explícitos, igual que ya hacía `getAvailability`. Todas las Functions nuevas de Recursos siguen ese mismo patrón.
- `api/getCatalogoRecursos` (Function pública v3 clásico, nueva): regresa, para las 6 herramientas, la lista de cursos publicados (solo id+nombre). `recursos.html` ya no hardcodea qué herramientas/cursos existen (los objetos `TOOLS`/`CURSOS` de antes) — los arma dinámicamente al cargar la página con esta llamada, y el nivel 1 (grid de herramientas) calcula solo "Próximamente" para las que no tienen ningún curso publicado.
- **TODO — sin confirmar:** el límite real de tamaño de archivo que aceptan las Functions "administradas" de Static Web Apps sigue sin probarse con un archivo real (`uploadRecurso` ya existe pero no se ha ejercitado en producción). El archivo más pesado que Alfredo espera subir por ahora es ~15MB. Probarlo en cuanto se despliegue esta sesión — si falla, la alternativa es subir a Blob directo con un SAS token en vez de pasar el archivo por la Function.
- **TODO — cosmético:** el nombre de prueba quedó como "Basico-Intermedio" sin acento en la tabla `Cursos` (curso `excel`/`excel-bi`, código `EXCEL2026`) — esa entidad, al no tener `estado`, ahora aparece como no publicada en `getRecursos`; se corrige (nombre + publicarlo) desde el admin en cuanto se pruebe.

**En construcción — Recursos, backend real (camino de escritura), pendiente desplegar y probar:**
- 7 Functions de administración nuevas (`api/crearCurso`, `eliminarCurso`, `uploadRecurso`, `editarRecurso`, `eliminarRecurso`, `updateOrden`, `adminListCursos`) más una de lectura admin (`api/adminGetRecursos`, regresa los recursos de un curso sin agrupar y con `rowKey`, sin exigir código ni que esté publicado) — todas protegidas con `allowedRoles:["admin"]` en `staticwebapp.config.json`, mismo patrón que ya protege `/admin/*`.
- **"Rotar código" no es una Function aparte** — se decidió que sea el mismo `crearCurso` (upsert por herramienta+curso): guardar el curso con un código distinto ya es "rotarlo". Evita duplicar lógica entre crear/editar/rotar.
- **Nuevo campo `estado`** (`borrador`/`publicado`) en `Cursos` — un curso nace en borrador y no es alcanzable desde el sitio público (`getRecursos` ahora lo exige) hasta que Alfredo lo publica desde el admin. Se agregó también `orden` (curso) para el orden de las pestañas y ya existía `orden` (recurso) para el orden dentro de cada sección — `api/updateOrden` es genérico y sirve para reordenar cualquiera de las dos tablas via drag & drop.
- `admin/index.html` → sección Recursos: espejo del sitio público en 3 niveles (Herramientas → pestañas de curso con indicador de estado (ícono+texto, nunca solo color, por la deuteranomalía de Alfredo) → 5 secciones de recursos con alta/edición/borrado/reordenar). SortableJS (CDN) para el drag & drop. Subida de archivo va **por la Function** (no SAS token) — decisión de Alfredo, más simple de construir; justo por eso el TODO del límite de tamaño de arriba sigue abierto y hay que probarlo pronto.
- `uploadRecurso` recibe el archivo como cuerpo binario crudo (`dataType: "binary"` en `function.json`, no multipart) — el navegador lo manda con `fetch(url, {body: file})` y los metadatos (herramienta/curso/tipo/título/nombre de archivo) van en query string. Al reemplazar un archivo existente, borra el blob viejo después de subir el nuevo.
- **Sin probar en producción todavía** — falta: hacer `git push`, confirmar que el deploy no rompe nada (ver el incidente de `GetRoles` arriba, mismo tipo de riesgo con Functions nuevas), publicar el curso de prueba (`excel-bi`) desde el admin para que vuelva a ser visible en `recursos.html`, y probar la subida con un archivo real de ~15MB.

**Pendiente / roadmap (ver documentos `Memoria_...` en el Project de claude.ai para detalle completo de cada uno):**
- Módulo de Diagnóstico (con backend desde el inicio, código por empresa autogestionable, panel de reportes con login Entra ID)
- Backoffice unificado (cotizaciones, ver solicitudes de temario, reportes cruzados)
- Replicar el constructor de temario de Excel para Power BI, Power Apps, Power Automate, IA Aplicada, Ofimática (hoy son placeholders "Próximamente" en `cursos.html`)
- Separar CSS/JS que sigue inline en `cursos.html` hacia `/assets/`
- Falta una imagen social dedicada (1200x630) para `og:image` — hoy usa `firma-ap.png` como placeholder
- `og:url` / `og:image` en `index.html` y `cursos.html` apuntan a `alfredopina.ai` — actualizar si se sigue sirviendo desde el dominio viejo de LifeZen al momento de publicar
- Link de YouTube en el footer (todas las páginas) es **placeholder** (`href="#"`, marcado con comentario `TODO`) — falta el link real del canal

**Ya resueltos** (no reabrir salvo pedido explícito):
- Recursos Fase 1 (frontend de prueba con contenido y códigos hardcodeados en `recursos.html`) — completamente superada por el backend real (lectura + escritura, ver arriba); ya no queda código de esa fase en el repo
- Favicon (ícono "fx" en 16x16/32x32/apple-touch-icon), meta tags Open Graph básicas y `.gitignore` — listos
- Símbolo SVG fantasma de piña (`pineappleMark`, nunca usado) — eliminado de `index.html` y `cursos.html`
- Bug de scroll: los links del menú aterrizaban con el título tapado por las barras sticky (nav + barra "Conóceme") — corregido con `scroll-margin-top` por breakpoint en `style.css`

## Historial de sesiones

Formato de cada entrada: `Fecha Módulo: Acciones` — un título corto por sesión de trabajo, con el detalle en bullets debajo. Agregar una entrada nueva (más reciente arriba) al cerrar cada sesión.

### 2026-09-04 alfredo.pina: Recursos — backend real, camino de escritura (admin)
- Iterado en texto el diseño del panel antes de construir: qué se configura (cursos por herramienta, materiales, códigos, textos, orden, estado), 3 decisiones de arquitectura confirmadas con Alfredo — subida de archivo por la Function (no SAS, más simple aunque deja pendiente probar el límite de tamaño), estado borrador/publicado por curso, y layout del admin espejo del sitio público
- Agregado el campo `estado` (`borrador`/`publicado`) y `orden` a la tabla `Cursos` — `api/getRecursos` ahora exige `estado === "publicado"` además del código, para que un curso a medio armar no sea alcanzable desde el sitio público
- Creadas 9 Functions nuevas (v3 clásico, mismo patrón `body`+`headers` que ya usaba `getRecursos`): `getCatalogoRecursos` (pública, arma el catálogo de herramientas/cursos publicados) y 8 protegidas con `allowedRoles:["admin"]` — `adminListCursos`, `adminGetRecursos`, `crearCurso` (upsert, también sirve para rotar código), `eliminarCurso`, `uploadRecurso`, `editarRecurso`, `eliminarRecurso`, `updateOrden` (genérico, reordena tabs de curso o recursos dentro de un tipo)
- `recursos.html` reescrito para pedir `/api/getCatalogoRecursos` al cargar en vez de usar los objetos `TOOLS`/`CURSOS` hardcodeados — el nivel 1 (grid de herramientas) ahora calcula solo "Próximamente" para las que no tengan ningún curso publicado
- Construido el panel completo en `admin/index.html` → sección Recursos: 3 niveles (Herramientas → pestañas de curso con estado + drag & drop de orden → 5 secciones de recursos con alta/edición inline/borrado/reordenar), usando SortableJS (CDN) para el drag & drop y un patrón de tarjeta+formulario inline en vez de modales
- Agregado `@azure/storage-blob` a `api/package.json` y `getRecursosContainer()` a `api/src/recursos-tables.js` (misma connection string que las tablas)
- Probado localmente sirviendo los HTML como archivo — confirma que no hay errores de sintaxis JS y que el manejo de errores de red es correcto; la funcionalidad real (login, Table/Blob Storage) solo se puede probar una vez desplegado, mismo patrón que ya aplicaba al resto del admin
- **Pendiente para la siguiente sesión:** hacer push y confirmar que el deploy no rompe nada, publicar el curso de prueba `excel-bi` desde el admin (quedó en borrador porque no tenía el campo `estado`), y probar la subida de archivo con uno real de ~15MB para cerrar el TODO del límite de tamaño

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
