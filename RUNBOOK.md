# RUNBOOK — Reconstruir alfredopina.ai desde cero

Para el peor caso: recrear la infraestructura en una suscripción de Azure nueva (o la actual, si algo se borró por accidente). **No es** la lista de tareas normales: esa vive en `ROADMAP.md`. Sigue el orden; cada fase depende de la anterior. Verificado contra el código el 2026-10-13.

Fechas de vencimiento (dominio, secretos, facturas): `VIGENCIAS.md`. No incluye ningún valor real de secreto o contraseña: solo dónde vive cada uno y cómo se genera. Puede vivir público en el repo: describe la arquitectura, no expone ningún valor secreto.

## 1. Repo + hosting (Static Web App)

1. El repo es `github.com/alfredopina/AlfredoPina-AI` (público; no hay nada sensible en el código).
2. Crear el recurso **Static Web App**, tier **Free**, región Central US, en el grupo `GR_AlfredoPina`, conectado a este repo, rama `main`. Al conectarlo, Azure genera solo el workflow de despliegue y su secreto (`AZURE_STATIC_WEB_APPS_API_TOKEN_...`).
3. Si el recurso existe y solo hay que regenerar el token: portal → el Static Web App → "Administrar token de implementación" → copiar → GitHub → Settings → Secrets and variables → Actions → actualizar `AZURE_STATIC_WEB_APPS_API_TOKEN_ICY_SMOKE_071E3EC10`.
4. **Nunca `timerTrigger`** (solo `httpTrigger`) ni el modelo de Functions v4: fallan en este hosting. Las tareas programadas van por cron de GitHub Actions llamando a una Function HTTP con secreto.
5. **Límites del plan Free:** `staticwebapp.config.json` ≤ 20 KB, peticiones ≤ 45 s, sin identidad administrada.

## 2. Rol `admin` del panel

1. Portal → el Static Web App → "Role management" → "Invite". Proveedor **Azure Active Directory**, rol `admin`.
2. Abrir la liga generada e iniciar sesión con la cuenta de M365 que administrará (hoy `alfredo.pina@lifezen.com.mx`). Repetir por cada administrador nuevo (Viridiana).
3. **No automatizarlo con `rolesSource`:** requiere el plan Standard y tumba el deploy completo en Free.

## 3. Storage Account (`apcwebrecursos`)

1. Crear cuenta **Standard/LRS, StorageV2**, Central US, en `GR_AlfredoPina`.
2. Activar a nivel cuenta "Permitir el acceso anónimo en contenedores individuales" (no viene activado y sin esto no se pueden crear contenedores de lectura pública).
3. Fijar la versión de servicio (para que las descargas conserven el nombre real del archivo):
   ```bash
   az storage account blob-service-properties update --account-name apcwebrecursos --resource-group GR_AlfredoPina --default-service-version 2021-08-06
   ```
4. **Tablas y contenedores se autocrean por código** la primera vez que algo les escribe: no hay que crear nada a mano. Contenedores que usa el sitio: `recursos`, `proyectos` y `diagnostico` (**lectura pública por archivo**, creados con `access: "blob"` en el código), y `plantillas`, `cotizaciones`, `presentaciones`, `intermediarios`, `grupo-fotos` y `respaldos` (**privados**).
5. Las colas de envíos públicos (`SolicitudesPendientes`, `DiagnosticoPendientes`, `EncuestaPendientes`) y las huellas del Diagnóstico viven en Table Storage; el respaldo semanal **no** las incluye (los pendientes duran pocos días).

## 4. Azure SQL (`apcweb-backoffice`)

1. Crear el servidor **`apcweb-sql-server`** y la base **`apcweb-backoffice`** en `GR_AlfredoPina`, **serverless con la oferta gratuita** (100 000 vCore-s + 32 GB por mes, Central US). Configuración actual: núcleos mínimo 0.5 y máximo 1, pausa automática tras 60 min sin uso, y "Continue using database for additional charges" (**irreversible**: al agotar la cuota la base sigue y cobra; no se puede volver a "pausar hasta el mes siguiente"). Las bases gratuitas adicionales deben crearse en la región de la primera.
2. El usuario admin del servidor **no puede llamarse `admin`**.
3. Firewall del servidor: activar "Allow Azure services and resources to access this server" y agregar tu IP para el Query Editor del portal.
4. Correr **todos los scripts de `sql/` en orden numérico** (hoy `001` a `037`) desde el Query Editor. Son idempotentes (`IF NOT EXISTS`).
5. La primera consulta tras una pausa tarda hasta 60 s: ya está contemplado en `api/src/backoffice-db.js` y en los reintentos del admin.

## 5. Application Settings (Static Web App → Variables de entorno)

| Nombre | De dónde sale | Usado por |
|---|---|---|
| `RECURSOS_STORAGE_CONNECTION` | Cadena de conexión de `apcwebrecursos` (portal → Claves de acceso) | Todo lo que usa Table Storage o blobs |
| `BACKOFFICE_SQL_CONNECTION` | `Server=apcweb-sql-server.database.windows.net;Database=apcweb-backoffice;User Id=...;Password=...;Encrypt=true` | Todo el bloque relacional del admin |
| `OUTLOOK_ICS_URL` | Link secreto del calendario publicado en Outlook | Agenda |
| `BACKUP_CRON_SECRET` | Generado a mano (un GUID); **mismo valor** en GitHub | `respaldoAutomatico`, `enviarResumenSemanal`, `notificarSolicitudesAtoradas` |
| `ACS_EMAIL_CONNECTION` | Azure Communication Services (cadena de conexión del recurso de correo) | Todos los correos de aviso |
| `NOTIFICACIONES_REMITENTE` | Remitente verificado en ACS | Correos de aviso |
| `NOTIFICACIONES_DESTINO` | Correo(s) que reciben los avisos (Alfredo; Viridiana en copia si se desea) | Correos de aviso |
| `ESTADO_BD_TENANT_ID`, `ESTADO_BD_CLIENT_ID`, `ESTADO_BD_CLIENT_SECRET`, `ESTADO_BD_RESOURCE_ID` | App de Entra **`apcweb-estado-bd`** (registro de aplicación de un solo inquilino) con rol **Lector** sobre el servidor `apcweb-sql-server`; el secreto se crea en la propia app y **caduca (se creó a 12 meses, ~oct-2027)**; el resource id es el de la base | Ícono de estado de la base y cuota gratis (`getEstadoBase`, `getEstadoSistema`). Si faltan o caducan, el ícono queda en "no se sabe" y nada más se rompe |

## 6. GitHub Actions (repo → Settings → Secrets and variables → Actions)

| Secreto | Origen |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_ICY_SMOKE_071E3EC10` | Se crea al conectar el repo (paso 1) |
| `BACKUP_CRON_SECRET` | **Mismo valor exacto** que el Application Setting |

Workflows en `.github/workflows/`: `azure-static-web-apps-icy-smoke-071e3ec10.yml` (deploy autogenerado, no tocar), `respaldo-semanal.yml` (respaldo de Table Storage), `notificaciones-programadas.yml` (solicitudes atoradas varias veces al día y resumen de los lunes) y `resumen-ahora.yml` (botón manual de prueba del resumen).

## 7. Contenido que no vive en el código

Hay que volver a subirlo o capturarlo:
- **Plantilla de diploma** (`plantillas/fondo.png`, PNG 1437×1078 px exacto) y **firmas de instructores**: se suben desde admin → Diplomas → Plantilla. `instructores.json` se autocrea y se edita en el mismo panel.
- **Catálogo (Programas, Temas, Materiales, Proyectos)**: si se perdiera, la fuente más reciente es el respaldo semanal en `respaldos/`. No hay una Function de "restaurar" (solo de generar el respaldo): restaurar es releer el JSON y volver a escribir las entidades, a mano o con ayuda de Claude.
- **Presentaciones, manuales y videos** viven fuera del repo, en Dropbox (carpeta de Materiales).
- **Datos de SQL** (clientes, cotizaciones, grupos…): no tienen respaldo propio del sitio; dependen de la retención de Azure SQL. Pendiente en `ROADMAP.md`: revisar los días de retención y probar una restauración.

## 8. Dominio (`alfredopina.ai`) — conectado desde 2026-09-10

Portal → Static Web App → "Custom domains" → `www.alfredopina.ai` con certificado administrado. **Usar siempre `www`** en links y QR: el apex (`alfredopina.ai` sin `www`) solo redirige la portada (reenvío de GoDaddy); conectarlo directo a Azure no fue posible en el plan Free y se decidió dejarlo así. DNS en GoDaddy. El correo de `lifezen.com.mx` y su migración a Microsoft 365 están en `docs/confianza-dominio-correo.md`.
