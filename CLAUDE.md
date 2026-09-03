# CLAUDE.md — alfredopina.ai

## Sobre este proyecto

Sitio de marca personal de Alfredo Piña (Ingeniero Industrial, instructor/consultor de Excel, Power BI, Power Platform e IA, 15 años de experiencia, cientos de empresas, miles de profesionistas capacitados). El sitio centraliza y automatiza su negocio de capacitación: landing, catálogo de cursos con temario personalizable, calendario de disponibilidad, y a futuro diagnósticos de nivel, cotizador, recursos descargables y un backoffice/CRM.

Al responder o construir, prioriza legibilidad y mantenibilidad sobre cleverness. Pregunta antes de tomar decisiones de arquitectura grandes que no estén ya cubiertas aquí.

## Stack técnico

- **Front-end:** HTML/CSS/JS puro (sin frameworks, sin build step). No usar Power Pages ni Power Platform de bajo nivel para el front — decisión intencional de no depender solo del ecosistema Microsoft para el sitio.
- **Hosting:** Azure Static Web Apps (tier **Free**), recurso `Web-AlfredoPina`, grupo de recursos `GR_AlfredoPina`, región Central US.
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

**Pendiente / roadmap (ver documentos `Memoria_...` en el Project de claude.ai para detalle completo de cada uno):**
- Módulo de Diagnóstico (con backend desde el inicio, código por empresa autogestionable, panel de reportes con login Entra ID)
- Módulo de Recursos/Descargas (Azure Blob Storage, link + código corto)
- Backoffice unificado (cotizaciones, ver solicitudes de temario, reportes cruzados)
- Replicar el constructor de temario de Excel para Power BI, Power Apps, Power Automate, IA Aplicada, Ofimática (hoy son placeholders "Próximamente" en `cursos.html`)
- Separar CSS/JS que sigue inline en `cursos.html` hacia `/assets/`
- Falta una imagen social dedicada (1200x630) para `og:image` — hoy usa `firma-ap.png` como placeholder
- `og:url` / `og:image` en `index.html` y `cursos.html` apuntan a `alfredopina.ai` — actualizar si se sigue sirviendo desde el dominio viejo de LifeZen al momento de publicar

**Ya resueltos** (no reabrir salvo pedido explícito):
- Favicon (ícono "fx" en 16x16/32x32/apple-touch-icon), meta tags Open Graph básicas y `.gitignore` — listos
- Símbolo SVG fantasma de piña (`pineappleMark`, nunca usado) — eliminado de `index.html` y `cursos.html`
- Bug de scroll: los links del menú aterrizaban con el título tapado por las barras sticky (nav + barra "Conóceme") — corregido con `scroll-margin-top` por breakpoint en `style.css`

## Reglas de trabajo con Alfredo

- Está aprendiendo Azure/GitHub/Claude Code activamente — explica brevemente el "por qué" de decisiones técnicas no triviales, no solo el "qué".
- Prefiere que se le proponga con 2-3 opciones y trade-offs antes de que se ejecute algo con impacto de diseño o arquitectura grande.
- No asumas requerimientos nuevos — si algo no está en este documento ni fue pedido explícitamente en la sesión, pregunta antes de construir.
- El Project de claude.ai (chat separado) tiene documentos `Memoria_...md` con el detalle completo de decisiones, historia y razones — este archivo es el resumen operativo, no el reemplazo de esos documentos.
