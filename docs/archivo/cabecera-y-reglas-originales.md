# ARCHIVO — Cabecera y reglas originales

> Sobre el proyecto, stack, comandos y reglas de trabajo del CLAUDE.md original (hoy en el CLAUDE.md nuevo). Partido de `CLAUDE_DETALLE.md` el 2026-10-13 sin cambiar el texto (los encabezados `##` de abajo son los originales). Índice de todos los temas: `CLAUDE_DETALLE.md`.

---

# CLAUDE.md — alfredopina.ai

## Sobre este proyecto

Sitio de marca personal de Alfredo Piña (Ingeniero Industrial, instructor/consultor de Excel, Power BI, Power Platform e IA, 15 años de experiencia, cientos de empresas, miles de profesionistas capacitados). El sitio centraliza y automatiza su negocio de capacitación: landing, catálogo de cursos con temario personalizable, calendario de disponibilidad, y a futuro diagnósticos de nivel, cotizador, recursos descargables y un backoffice/CRM.

Al responder o construir, prioriza legibilidad y mantenibilidad sobre cleverness. Pregunta antes de tomar decisiones de arquitectura grandes que no estén ya cubiertas aquí.

Si algún día hay que reconstruir la infraestructura desde cero (o algo se borró por accidente), ver **`RUNBOOK.md`** — checklist accionable de pasos de portal en orden, no la narrativa de decisiones que vive aquí.

## Stack técnico

- **Front-end:** HTML/CSS/JS puro (sin frameworks, sin build step). No usar Power Pages ni Power Platform de bajo nivel para el front — decisión intencional de no depender solo del ecosistema Microsoft para el sitio.
- **Hosting:** Azure Static Web Apps (tier **Free**), recurso `Web-AlfredoPina`, grupo de recursos `GR_AlfredoPina`, región Central US. **URL real de producción:** `https://icy-smoke-071e3ec10.7.azurestaticapps.net/` (ojo con el `.7.` antes de `azurestaticapps.net` — el nombre del workflow de GitHub Actions no lo incluye, es fácil adivinar mal la URL a partir de él, ya pasó una vez).
- **Deploy:** GitHub → GitHub Actions → Azure Static Web Apps, automático al hacer push a `main`. No tocar el workflow YAML autogenerado salvo que se sepa exactamente qué se está cambiando.
- **Backend:** Azure Functions (carpeta `api/`), modelo **v3 clásico** (carpeta + `function.json`), NO modelo v4 (`app.http(...)`) — el v4 falla en Static Web Apps managed functions por una feature flag no configurable en ese hosting. Ya hubo que corregir esto una vez, no repetir el error.
- **Base de datos:** Azure Table Storage para módulos aislados (ej. Calendario). Para el futuro backoffice (que cruza Diagnóstico + Cotizaciones + Recursos), evaluar Azure SQL Database (tier serverless barato) en vez de Table Storage, porque los reportes van a necesitar cruzar datos entre módulos.
- **Repo:** `github.com/alfredopina/AlfredoPina-AI` (público).
- **Dominio:** `alfredopina.ai` **conectado y en producción desde 2026-09-10** — DNS + dominio personalizado dados de alta en el Static Web App (`Web-AlfredoPina` → Custom domains), certificado válido. El correo `@alfredopina.ai` todavía NO existe (solo el sitio) — mientras tanto, `alfredo.pina@lifezen.com.mx` sigue siendo el correo real de contacto (login de `/admin` y `COTIZACION_CONTACT_EMAIL`, ver Fase 3 Cotizaciones en Pendientes).

## Comandos

- **Instalar dependencias del backend:** `cd api && npm install` (el front-end no tiene `package.json` — es HTML/CSS/JS puro, sin build step).
- **Correr las pruebas:** `cd api && npm test` — corre en secuencia `test-availability.js`, `test-backup.js`, `test-rate-limit.js` y `test-cliente-actividad.js`. No hay test runner (Jest/Mocha/etc.) — cada `test-*.js` es un script standalone con sus propios `assert` y sin red (mockean Table Storage/SQL en memoria).
- **Correr una sola prueba:** `cd api && node test-cliente-actividad.js` (o el archivo que corresponda).
- **Servir el sitio localmente:** usar el Browser pane (`preview_start` con el nombre `static-site`, definido en `.claude/launch.json` como `npx http-server -p 8080 -c-1 .`) — nunca levantarlo a mano por Bash.
- **Azure Functions localmente:** `cd api && npm start` (alias de `func start`, requiere Azure Functions Core Tools) — necesita un `api/local.settings.json` real con las Application Settings de conexión (SQL/Table Storage/Graph), nunca commiteado (ver `.gitignore`; hay `api/local.settings.json.example` como plantilla).
- Sin linter ni formateador configurado en el repo.


## Historial de sesiones

Movido a HISTORIAL.md (2026-09-12) para no cargarlo completo en cada turno de Claude Code — CLAUDE.md se reinyecta entero en cada mensaje, este archivo aparte no. Consultarlo solo cuando se pida explícitamente ver el historial o haga falta el detalle de una decisión vieja que no quedó ya resumida en "Estado del proyecto"/"Ya resueltos" de este documento.

## Reglas de trabajo con Alfredo

- Está aprendiendo Azure/GitHub/Claude Code activamente — explica brevemente el "por qué" de decisiones técnicas no triviales, no solo el "qué".
- Prefiere que se le proponga con 2-3 opciones y trade-offs antes de que se ejecute algo con impacto de diseño o arquitectura grande.
- No asumas requerimientos nuevos — si algo no está en este documento ni fue pedido explícitamente en la sesión, pregunta antes de construir.
- El Project de claude.ai (chat separado) tiene documentos `Memoria_...md` con el detalle completo de decisiones, historia y razones — este archivo es el resumen operativo, no el reemplazo de esos documentos.

