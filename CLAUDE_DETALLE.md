# CLAUDE_DETALLE — índice del detalle técnico

Aquí vive el **porqué** de cada decisión grande (las rondas de ajuste, los incidentes, las reglas que salieron de errores). **Ninguno de estos archivos se carga solo**: consúltalos con una búsqueda puntual (`Grep`/`Read` acotado), nunca completos por costumbre. El archivo `CLAUDE.md` (que sí se carga cada vez) solo trae las reglas y el estado; el rumbo y los pendientes viven en `ROADMAP.md`.

Hasta 2026-10-13 todo esto era un solo archivo de ~590 KB. Se partió por tema **sin cambiar el texto** (verificado línea por línea). Muchos comentarios del código dicen "ver CLAUDE_DETALLE.md → <sección>": usa la tabla de abajo para encontrar esa sección.

## Vigente (consultar al trabajar en ese tema)

| Archivo | Qué contiene | Secciones que antes se llamaban… |
|---|---|---|
| `docs/marca-y-sitio-publico.md` | Identidad v2, kit de marca, íconos de herramienta, formato final del diploma, rebrand del sitio, firma de correo, menú "Conóceme", estrategia de LinkedIn | "Identidad v2", "Kit de marca", "Rebrand del sitio", "Firma de correo", "LinkedIn", "Nav: Conóceme" |
| `docs/diplomas-calificaciones.md` | Diplomas (módulo y verificación pública), Calificaciones, Intermediarios (logo y Socio Comercial), foto final del grupo | "Diplomas", "Calificaciones", "Intermediarios", "Foto final del grupo" |
| `docs/comercial.md` | Formulario público con cola, Propuesta web (v1 a v3), Tracking de Solicitudes y de Cotizaciones (3 tandas), Crear/Modificar Solicitud, ventanas de cambio de fase, cotización vía Intermediario, número de grupos, Prospecto | "Propuesta web", "Tracking de Solicitudes", "Tablero de Cotizaciones", "Cotizaciones — cierre de huecos", "Número de grupos" |
| `docs/cobranza.md` | Cobranza (Tracking): libreta de cobros, las 4 preguntas, IVA, plazo desde el contra-recibo, semáforo, tarjetas vivas vs acumuladas, Excel de Viri | "Cobranza", "Libreta de cobros", "IVA y plazo" |
| `docs/productos-materiales.md` | Vocabulario de Productos, Viaje Excel, panel Programas, materiales fuera del repo, presentaciones en el admin | "Vocabulario de Productos", "Panel Programas", "Materiales de curso", "Presentaciones en el admin" |
| `docs/diagnostico-encuestas.md` | Encuestas fases 2 y 3, contador en vivo del Diagnóstico, **cola de envíos (Diagnóstico y Encuesta) y "solo por link"** | "Encuestas — Fase 2/3", "Diagnóstico: cola de envíos" |
| `docs/notificaciones-config.md` | Avisos por correo, notificaciones ampliadas, alertas vs notificaciones, página de Alertas, cierre de Configuración, métricas "contar desde", Estado del sistema | "Avisos por correo", "Notificaciones por correo ampliadas", "Alertas vs. Notificaciones", "Cierre de Configuración" |
| `docs/dashboard.md` | Dashboard → Resumen: las 25 tarjetas de los 5 Trackings (valor, línea de 12 meses, comparación contra el mes anterior), filtros, qué se reconstruye y qué es "estado de hoy", foto diaria | "Dashboard", "Resumen", "foto diaria" |
| `docs/admin-patrones.md` | Patrón de fases, acceso a páginas privadas, navegación Tracking/Consulta, Pendientes (corkboard, zoom, topbar), diálogo `confirmarAccion`, botones Info, estándar de Trackings | "Patrón de trabajo", "Patrón de acceso", "Patrón de navegación del admin", "Pendientes", "Diálogo de confirmación", "Estándar de Trackings" |
| `docs/infra-azure-costos.md` | Incidente de vCore-segundos (2026-09-17), factura vencida (2026-09-25), costos, limpieza de Azure, DemoVentas, **ícono de estado de la base y cuota gratis** | "Incidente", "Revisión de costos", "Limpieza de Azure", "Ícono de estado de la base" |
| `docs/seguridad-auditoria.md` | Auditoría de límites de Static Web Apps, higiene de rutas, `npm audit`, lote de la auditoría 01 | "Auditoría de límites", "Sesión de higiene", "Solo por link + lote chico" |
| `docs/confianza-dominio-correo.md` | Filtros corporativos y reclasificaciones, DNS del apex, SPF/DKIM/DMARC, plan de correo y suite (Google → Microsoft 365) | "Confianza de Sitio", "Correo y suite" |
| `docs/dc3-stps.md` | Investigación del módulo DC-3 y el registro STPS | "DC-3" |
| `docs/modelo-negocio.md` | Los 3 pilares (Comercial / Producto / Operación) | "Modelo del negocio" |

## Archivo (historia; no es fuente de verdad)

| Archivo | Qué es |
|---|---|
| `docs/archivo/estado-del-proyecto.md` | Narrativa módulo por módulo de lo construido de sept a oct 2026 (Grupos, Clientes, Tracking Operación, Dashboard, etc.). Útil para saber **por qué** algo quedó así; para saber **cómo está hoy**, el código manda. |
| `docs/archivo/pendientes-acumulados.md` | El checklist viejo de "confirmar en producción". Casi todo ya se resolvió. |
| `docs/archivo/planes-anteriores.md` | Las fases y bloques de sept-2026, superados por `ROADMAP.md`. |
| `docs/archivo/cabecera-y-reglas-originales.md` | El principio del `CLAUDE.md` original. |
| `docs/archivo/HISTORIAL.md` | Sesiones narradas una por una. |

## Otros documentos del proyecto

- `ROADMAP.md` — misión, visión, rumbo, orden de trabajo y **todos los pendientes** (única lista vigente).
- `VIGENCIAS.md` — qué vence y cuándo: dominios, facturas, secretos, suscripciones y certificaciones.
- `RUNBOOK.md` — reconstruir toda la infraestructura desde cero.
- `MANUAL_IDENTIDAD.md` — especificación de la marca (fuente de verdad de logos, colores, tipografía).
