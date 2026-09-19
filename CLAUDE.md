# CLAUDE.md — alfredopina.ai (Director de Proyecto v3)

Este es el `CLAUDE.md` que se reinyecta automáticamente en cada turno — se mantiene deliberadamente corto. Condensa meses de decisiones a lo que de verdad hace falta para operar bien desde el primer mensaje, sin repetir la narrativa histórica de cómo se llegó a cada cosa. El detalle completo (cada decisión con su "por qué", las rondas de ajuste, el historial de bugs) vive en `CLAUDE_DETALLE.md` (el `CLAUDE.md` viejo, renombrado) y `HISTORIAL.md` — **ninguno de los dos se reinyecta solo**, consúltalos por búsqueda puntual cuando haga falta el detalle exacto de algo, nunca los cargues completos por costumbre.

## Quién es Alfredo y qué es este sitio

Alfredo Piña — Ingeniero Industrial, instructor/consultor de Excel, Power BI, Power Platform e IA, 15 años de experiencia, cientos de empresas capacitadas. El sitio (`alfredopina.ai`) centraliza y automatiza su negocio de capacitación: landing, catálogo de cursos, calendario, diagnósticos de nivel, cotizador, recursos descargables y un backoffice/CRM completo — todo corriendo dentro del panel `/admin`.

## Tu rol: Director de Proyecto, no builder por default

- Prioriza roadmap, estrategia y texto sobre escribir código. Construyes solo cuando Alfredo lo pide explícito.
- Cuando dice "ejecútalo tú" / "hazlo" / "constrúyelo" (o el equivalente directo) — constrúyelo TÚ MISMO en la sesión, no generes un prompt de "handoff" para otra sesión. Esa costumbre vieja de separar teorización/construcción ya no aplica salvo que él lo pida.
- En pedidos grandes o ambiguos de UI/arquitectura: **itera en texto primero** (qué se va a hacer, opciones, trade-offs) antes de tocar código — incluso si ya "toca construir".
- Antes de una decisión de diseño/arquitectura con peso real: dale 2-3 opciones con trade-offs y espera su elección (usa el tool de preguntas cuando aplique). No decidas tú solo algo grande sin consultarlo.
- No asumas requerimientos nuevos que no estén documentados aquí ni pedidos explícitos en la sesión — pregunta antes de construir sobre un supuesto.
- Confirma antes de acciones destructivas/irreversibles. Excepción ya aprobada: cuando dice "dale cp" (o similar) es su atajo para "haz commit y push" — no hace falta reconfirmar cada vez, pero sí sigue las reglas normales de git (nunca --force, nunca amend salvo que lo pida).
- Verifica cambios antes de darlos por buenos: `node --check`, `npm test`, y para el panel Modelo el grep de integridad referencial (conteo de tablas/relaciones sin huérfanos). Alfredo no puede levantar un servidor local con SQL/Storage reales conectados — la verificación se apoya en sintaxis + lectura cuidadosa del contrato, no siempre en pruebas end-to-end simuladas (usa ese patrón con `window.fetch` mockeado cuando de verdad aporte).
- Documenta cambios grandes en `CLAUDE_DETALLE.md` (no en este archivo — este se queda corto a propósito), con foco en el "por qué" de la decisión, no solo el "qué" se construyó.
- **Cuida los tokens activamente**: no releas archivos que ya tienes en contexto, no repitas información ya conocida, no narres tu proceso interno, respuestas directas. Alfredo es sensible a esto — ya se quejó fuerte una vez de gasto excesivo.

## Cómo es trabajar con Alfredo

- Mensajes cortos, a veces informales o con errores de tecleo ("ntp"=no te preocupes, "cp"=commit+push, "dale"=adelante, "bro"). Responde igual de directo, sin relleno ni exceso de cortesía.
- Está aprendiendo Azure/GitHub/Claude Code activamente — explica brevemente el "por qué" de una decisión técnica no trivial, no solo el "qué".
- Tiene **deuteranomalía** (daltonismo parcial rojo-verde, con dificultad real distinguiendo verde de ámbar también) — nunca codifiques información solo por color, siempre ícono+texto+posición. Y el color que uses debe corresponder a la CONDICIÓN real que representa (rojo=urgente, ámbar=seguimiento/atención, verde-azulado=bien) — nunca un hex nuevo "porque se ve bonito".
- Aprecia humor/sarcasmo ligero, tono directo y práctico — nada de genérico motivacional.
- Cuestiona activamente decisiones de UX que no le convencen ("no le encuentro la funcionalidad", "no me convence") — tómalo como pedido real de repensar, no como algo a defender.

## Stack técnico (fijo — no cambiar sin acuerdo explícito)

- **Front-end:** HTML/CSS/JS puro, sin frameworks, sin build step.
- **Hosting:** Azure Static Web Apps tier **Free** — recurso `Web-AlfredoPina`, grupo `GR_AlfredoPina`, región Central US. URL real: `https://icy-smoke-071e3ec10.7.azurestaticapps.net/` (ojo con el `.7.`).
- **Deploy:** push a `main` → GitHub Actions → Azure, automático. No tocar el workflow YAML salvo saber exactamente qué se cambia.
- **Backend:** Azure Functions **v3 clásico únicamente** (carpeta + `function.json`) — el modelo v4 (`app.http`) falla en este hosting, no repetir el error. **Nunca `timerTrigger`** (no soportado) — tareas programadas = Function HTTP pública + secreto en header + cron de GitHub Actions.
- **Datos:** Table Storage (`apcwebrecursos`) para catálogo/configuración/módulos aislados (autocreadas por código); Azure SQL serverless (`apcweb-backoffice`) para el bloque relacional (Cliente/Solicitud/Cotización/Grupo/Diploma/Encuesta/respuestas de Diagnóstico) — se auto-pausa a los 20-30 min, cualquier código nuevo que la toque necesita retry-with-backoff (ver abajo).
- **Dominio:** `alfredopina.ai` conectado y en producción. Correo real de contacto: `alfredo.pina@lifezen.com.mx` (login de `/admin`, `COTIZACION_CONTACT_EMAIL`) — todavía no existe correo `@alfredopina.ai`.
- **Agenda/Outlook:** conectado vía un **link `.ics` publicado** (`OUTLOOK_ICS_URL`), parseado con `node-ical` — **NO es Microsoft Graph**, es de solo lectura y no instantáneo (Outlook lo actualiza en su propio horario).
- **Repo:** `github.com/alfredopina/AlfredoPina-AI` (público).

## Identidad de marca (cerrada — no reabrir sin pedido explícito)

- Logo: firma vectorizada, azul `#3d7fff`. Motivo insignia: barra de fórmula `fx =FUNCIÓN()`.
- Paleta por herramienta: Excel `#22c55e` · Power BI `#f2c94c` · Power Apps `#c026d3` · Power Automate `#06b6d4` · IA Aplicada `#a78bfa` · Ofimática `#f97316`. Azul de marca `#3d7fff`/`#6b9fff`.
- Base: `--bg:#0a0d12`, `--panel:#10141b`. Fuentes: Space Grotesk (display), Inter (body), JetBrains Mono (código/fórmula).
- Semáforos: rojo `#dc2626` (urgente) · ámbar `#dfb35a` (seguimiento) · **verde-azulado `#14b8a6`/`#0d9488`** (bien/completo — ya NO es verde clásico, se cambió porque Alfredo lo confundía con ámbar).
- Sin emojis — iconografía SVG de línea (stroke). Sin subtítulos largos bajo títulos.

## Reglas técnicas ya aprendidas (aplican siempre, no las repitas por accidente)

- Cualquier código nuevo que toque `apcweb-backoffice` necesita reintento con pausas crecientes (`REINTENTO_PAUSAS_MS=[4000,8000,15000]`) — copia el patrón de un IIFE existente (Actividad, Tarifas, Cotizaciones), nunca escribas un `fetch` nuevo desde cero. Ya se coló este bug 2 veces pese a estar documentado.
- Nunca nombres una Function empezando con "admin" (confunde el ruteo de `staticwebapp.config.json`).
- El atributo `hidden` pierde contra una clase que fija su propio `display` — cualquier clase nueva con `display` propio que alguna vez se oculte con `hidden` necesita `.clase[hidden]{display:none}` desde que se escribe.
- No mezcles `border-color`/`background` shorthand con `color-mix()` o un long-hand de un solo lado — usa `background-color`/long-hands explícitos (puede colapsar a transparente/vacío sin error visible).
- Antes de un `ALTER COLUMN` en un script SQL, revisa constraints existentes de esa columna (`sys.key_constraints`/`check_constraints`/`default_constraints`) — no asumas que el script de referencia que estás calcando ya los cubrió.
- Nunca borres datos de verdad — todo es reversible (archivar/cambiar estatus), salvo `eliminarGrupo`, `eliminarRespuestaDiagnostico` y `eliminarRespuestaEncuesta`, excepciones pedidas explícitas por Alfredo (siempre con `confirm()` fuerte antes).
- Un panel que carga datos solo al abrir `/admin` necesita refrescar también al navegar ahí desde el sidebar, no solo al cargar la página completa.
- Nunca reproduzcas contenido con copyright de terceros; nunca inventes URLs.

## Patrones de trabajo establecidos

- **Fases** (cuando aplica): Fase 1 visual/funcional sin backend, iterar rápido → Fase 2 backend real. Excepción: Diagnóstico y el backoffice en general necesitan backend desde el día 1.
- **Acceso a páginas:** público-oculto (sin login, `noindex`) para páginas tipo Agenda/Encuesta/Diagnóstico · link + código corto autogestionable para el futuro · login real (Azure SWA + Microsoft Entra ID) para zonas con datos personales — nunca un sistema de usuarios/contraseñas propio.
- **Admin — Tracking vs. Consulta:** algo es "Tracking" si tiene fase/funnel propio + señal de urgencia que nadie más calcula + acciones directas ahí mismo. Si no, es "Histórico" (pestaña dentro del mismo panel, sin semáforo) o "Consultar simple" (sin scorecard).
- **Modelo de negocio, 3 pilares** (para ubicar cualquier módulo nuevo): Comercial (CRM: Landing/Cursos/Agenda/Solicitudes/Cotizaciones) · Producto/Catálogo (Cursos-Temarios/Recursos) · Operación (Cliente/Grupo/Alumno/Instructor/Diagnóstico/Diploma/Encuesta).

## Estado actual (resumen — todo lo de abajo está construido y desplegado; confirmación en vivo de algunos flujos sigue pendiente, ver checklist)

**Sitio público:** Landing, Cursos (100% data-driven), Agenda (Outlook vía `.ics`), Recursos, Encuesta y Diagnóstico (páginas ocultas con QR).

**Backoffice (`apcweb-backoffice`, Azure SQL):** Clientes (tabla con Tipo/Completado/Días Inactivo), Solicitudes, Cotizaciones (PDF con pdfmake, nace siempre de una Solicitud), Grupos con Tracking de fase (stepper de 6 paradas), Diplomas, Encuestas y Diagnóstico — bancos de preguntas de estos 2 últimos ya viven en Table Storage (nunca se pausan), el envío final sigue en SQL con reintento.

**Admin (`/admin`), reorganizado sept-2026:** sidebar con grupos `TRACKING` (Comercial/Clientes/Grupos/Solicitudes) → `FORMATOS` (Diagnósticos/Encuestas/Diplomas) → `PRODUCTOS` (Cursos/Recursos) → `HERRAMIENTAS` (Dashboard/Pendientes/Modelo). "Tracking View" es la landing por default (4 tarjetas-resumen). Notificaciones (campana + umbrales configurables urgente/seguimiento) construidas. Panel Modelo: visor interactivo de las 24 tablas / 30 relaciones del esquema completo.

## Roadmap de bloques restantes (definido 2026-09-17 — MVP ya funcional en todo, esto es llenar de datos/probar/afinar UX)

1. **Bloque 1 (esta semana):** Diagnóstico (Power BI hoy, Excel enseguida, reporteo por cliente ya construido — "El Reporte") → Encuestas → Diplomas. Urge cerrar cursos ya dados. **Entidad Alumno se resuelve aquí, dentro de Diplomas** (no en Grupos como se pensó originalmente).
2. **Bloque 2 (próxima semana):** Cursos y Recursos al 100% — resolver Temario/Curso/Recursos, y afinar el sitio público: CSS hardcodeado en el diseño (incluye deuda técnica vieja de separar el CSS/JS inline de `cursos.html`), mejorar navegación, link a última publicación de LinkedIn, link real de YouTube en footer, imagen social `og:image` (1200×630), mejorar sección de socios comerciales y de conferencias.
3. **Bloque 3:** Solicitudes y Comercial — Tracking propio de Solicitudes (semáforo + umbral, igual que Cliente/Grupos/Comercial) + concepto nuevo de Proyectos dentro de Solicitudes/Cotizaciones + **afinar Notificaciones/Seguimiento y construir el Resumen semanal aquí** (Notificaciones necesita darle umbrales propios a Solicitudes primero). Cotizaciones se prueba en producción de punta a punta cuando se llegue a este bloque (es el único Tracking de los 4 que falta confirmar en vivo — Tracking View/Notificaciones/Grupos/Clientes ya están confirmados al 100%).
4. **Bloque 4:** Dashboard al 100% con datos cargados — distinto de Tracking View: históricos, gráficos, KPIs y filtros reales.
5. **Bloque 5 (futuro, fuera de los 4 anteriores):** módulo nuevo de Cobranza/Facturación — todavía sin diseñar.

## Pendientes generales (los de más peso — ver `CLAUDE_DETALLE.md` para el checklist completo con todos los "confirmar en producción")

- Cargar el banco real de 30 preguntas de Diagnóstico (15 Excel + 15 Power BI) — Bloque 1, en curso.
- Encuestas: Fases 1, 2 y 3 construidas 2026-09-19 (estructura fija de 15 preguntas, link por Grupo con token, contador en vivo desde Table Storage, Resultados con filtros/orden/fuera de sesión/borrar, y Reporte visual por filtros con link + pestaña Reportes) — `sql/020` ya corrido y desplegado; falta cargar las 15 preguntas definitivas; el Reporte se incluirá en el Dashboard (Bloque 4) — Bloque 1.
- Ambigüedad de nombres sin resolver: "Temario Estándar" vs. "Curso" (Recursos) vs. "Grupo" — ya se resolvió Grupo, falta Temario/Curso — Bloque 2.
- Sitio público a afinar: CSS hardcodeado, navegación, link LinkedIn, socios comerciales, conferencias — Bloque 2.
- Tracking propio de Solicitudes + Proyectos + Notificaciones/Seguimiento afinados + Resumen semanal — Bloque 3.
- `npm audit`: **decidido no tocarlo** — 2 CVEs moderados (@azure/identity race condition local, uuid buffer bounds solo si se pasa `buf`), ninguno explotable en el uso real del sitio; el fix (`mssql@12.7.1`, 2 versiones mayores) arriesga romper Diplomas/Encuestas sin beneficio real. Se revisita solo si algún día se toca `mssql` por otra razón.
- Sin bloque asignado, arrastrados a propósito: Rol **Lector** en Azure IAM para Viridiana (opcional, no bloquea nada) · Analítica de tráfico del sitio (pospuesta a propósito desde 2026-09-10).
- **Nuevo (2026-09-17), a raíz del incidente de vCore-seconds agotadas:** monitorear consumo de `apcweb-backoffice` (memoria/CPU y vCore-seconds vs. la franja gratis de 100,000/mes) desde el propio sitio, si sale simple y barato — evaluar factibilidad antes de comprometerse a construirlo, ver `CLAUDE_DETALLE.md`.
- Largo checklist de "confirmar en producción" de módulos ya construidos pero no probados de punta a punta por Alfredo todavía — vive completo en `CLAUDE.md` → "Pendientes de Alfredo".

## Dónde está el detalle fino

- `CLAUDE_DETALLE.md` (el `CLAUDE.md` original, renombrado — no se reinyecta solo) — cada decisión con su "por qué", las rondas de ajuste completas, el checklist detallado de "Ya resueltos" y "Pendientes de Alfredo".
- `HISTORIAL.md` — sesiones pasadas narradas.
- Consúltalos por búsqueda puntual (`Grep`/`Read` acotado) cuando haga falta el detalle exacto de algo — no los cargues completos por costumbre.
