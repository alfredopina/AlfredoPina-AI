# RUNBOOK — Reconstruir alfredopina.ai desde cero

Esto es para el peor caso: recrear toda la infraestructura en una suscripción de Azure nueva (o la actual, si algo se borró por accidente). **No es** el checklist de tareas normales — eso vive en `CLAUDE.md` → "Pendientes de Alfredo". Sigue el orden de abajo; cada fase depende de la anterior.

No incluye ningún valor real de secreto/contraseña — solo dónde vive cada uno y cómo se genera. Este archivo puede vivir público en el repo sin problema: describe la arquitectura (ya pública en `CLAUDE.md`), no expone ninguna debilidad ni ningún valor secreto real.

## 1. Repo + hosting (Static Web App)

1. El repo ya existe en `github.com/alfredopina/AlfredoPina-AI` (público). Si se recrea desde cero, mantenlo público (no hay nada sensible en el código).
2. Crear el recurso Azure Static Web App, tier **Free**, región Central US, dentro del grupo de recursos `GR_AlfredoPina`, conectado a este repo/rama `main`. Al conectarlo desde el portal, Azure genera solo **el workflow de GitHub Actions y el secreto de despliegue** (`AZURE_STATIC_WEB_APPS_API_TOKEN_...`) automáticamente — no hay que crearlo a mano la primera vez.
3. **Si el recurso ya existe y solo necesitas regenerar el token** (porque se perdió o se recreó el recurso sin recrear el repo): portal → el Static Web App → "Administrar token de implementación" → copiar el nuevo valor → GitHub → Settings → Secrets and variables → Actions → actualizar `AZURE_STATIC_WEB_APPS_API_TOKEN_ICY_SMOKE_071E3EC10` con el valor nuevo.
4. **Bug de plataforma a tener presente** (ver `CLAUDE.md` → "Ya resueltos"): nunca usar `timerTrigger` en ninguna Function — Static Web Apps managed functions solo soporta `httpTrigger`. Tareas programadas van por cron de GitHub Actions llamando a una Function HTTP.

## 2. Rol `admin` del panel

1. Portal → el Static Web App → "Role management" → "Invite".
2. Proveedor: **Azure Active Directory**. Rol: `admin`.
3. Abrir la liga generada e iniciar sesión con la cuenta de M365 que va a administrar el panel (hoy `alfredo.pina@lifezen.com.mx`).
4. **No intentar automatizarlo con `rolesSource`/una Function tipo `GetRoles`** — ese bloque de `staticwebapp.config.json` requiere el plan Standard y tumba el deploy completo en el plan Free (ya pasó una vez).
5. Repetir para cada administrador nuevo (ej. Viridiana) cuando corresponda.

## 3. Storage Account (`apcwebrecursos`)

1. Crear cuenta de Storage: **Standard/LRS, StorageV2**, región Central US, dentro de `GR_AlfredoPina`. Nombre usado hoy: `apcwebrecursos`.
2. **Antes de crear contenedores públicos**: activar a nivel cuenta "Permitir el acceso anónimo en contenedores individuales" — no viene activado por default y sin esto no se puede configurar el contenedor `recursos` como público-por-blob.
3. Configurar `DefaultServiceVersion` (necesario para que las descargas conserven el nombre real del archivo en vez del nombre interno del blob):
   ```bash
   az storage account blob-service-properties update --account-name apcwebrecursos --resource-group GR_AlfredoPina --default-service-version 2021-08-06
   ```
4. Crear contenedores Blob:
   | Contenedor | Nivel de acceso | Uso |
   |---|---|---|
   | `recursos` | **Blob** (lectura anónima por archivo, no se puede listar el contenedor) | Manuales/materiales descargables de Recursos |
   | `diplomas` | **Privado** | PDFs de diplomas — folios son adivinables/secuenciales, nunca debe ser público |
   | `plantillas` | **Privado** | Fondo de diploma, firmas de instructores, `instructores.json` |
   | `respaldos` | Privado | **No crear a mano** — se autocrea la primera vez que corre cualquier Function de Respaldos (`createIfNotExists()` sin opciones = privado por default) |
5. Crear tablas manualmente (estas dos NO se autocrean por código, a diferencia de las de Cursos):
   - **`Cursos`** — PartitionKey=`herramienta`, RowKey=`cursoId`. Columnas: `nombre`, `codigo`, `estado` (`borrador`/`publicado`), `orden`, `temarioId` (opcional).
   - **`Recursos`** — PartitionKey=`<herramienta>_<cursoId>`. Columnas: `tipo`, `titulo`, `texto`, `url`, `blobPath`, `orden`.
   - El resto de las tablas del proyecto (`Temas`, `TemariosEstandar`, `Proyectos`, y la de rate-limiting de `getRecursos`) se autocrean solas la primera vez que algo les escribe — no requieren paso de portal.

## 4. Azure SQL (`apcweb-backoffice`)

1. Crear servidor **`apcweb-sql-server`** + base **`apcweb-backoffice`**, dentro de `GR_AlfredoPina`, tier **serverless** usando la oferta gratis de Azure (100,000 seg-vCore + 32GB/mes), con "Auto-pause the database until next month" activado.
2. **El usuario admin del servidor NO puede llamarse `admin`** — Azure lo rechaza por seguridad. Usa cualquier otro nombre.
3. Firewall del servidor: activar "Allow Azure services and resources to access this server" (para que las Functions conecten) **y** agregar tu propia IP (para poder usar el Query Editor del portal).
4. Correr, en este orden, desde el Query Editor del portal:
   - `sql/001_backoffice_diplomas.sql`
   - `sql/002_diploma_horas.sql`
   - `sql/003_encuestas.sql`
   - `sql/004_encuesta_constraint.sql`
5. Recuerda: la base se auto-pausa tras 1h sin uso, y la primera consulta tras una pausa puede tardar hasta 60s en "despertarla" — ya está contemplado en `api/src/backoffice-db.js` (timeouts de 60s), no hace falta ajustar nada más.

## 5. Application Settings (Static Web App → Variables de entorno)

| Nombre | De dónde sale | Usado por |
|---|---|---|
| `OUTLOOK_ICS_URL` | Link secreto del calendario publicado en Outlook | `getAvailability` (Agenda) |
| `RECURSOS_STORAGE_CONNECTION` | Cadena de conexión de `apcwebrecursos` (portal → Claves de acceso) | Recursos, Cursos, Diplomas, Encuestas, Respaldos (misma cuenta para Table y Blob) |
| `BACKOFFICE_SQL_CONNECTION` | Formato manual: `Server=apcweb-sql-server.database.windows.net;Database=apcweb-backoffice;User Id=TU_USUARIO;Password=TU_CONTRASEÑA;Encrypt=true` | Diplomas, Encuestas |
| `BACKUP_CRON_SECRET` | Generado a mano (`[guid]::NewGuid().ToString("N")` en PowerShell) | `respaldoAutomatico` (valida contra el header `x-backup-secret`) |

## 6. GitHub Actions Secrets (repo → Settings → Secrets and variables → Actions)

| Nombre | De dónde sale |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_ICY_SMOKE_071E3EC10` | Se crea solo al conectar el repo al Static Web App (paso 1). Regenerar manualmente solo si se recrea el recurso sin recrear el repo. |
| `BACKUP_CRON_SECRET` | **Mismo valor exacto** que el Application Setting del mismo nombre (paso 5) — es el candado que usa `.github/workflows/respaldo-semanal.yml` para llamar a `respaldoAutomatico`. |

## 7. Contenido semilla que no vive en código

Esto no se reconstruye solo con Application Settings — hay que volver a subirlo/capturarlo:
- **Plantilla de diploma** (`plantillas/fondo.png`, PNG 1437×1078px exacto) y **firmas de instructores** (`plantillas/firmas/{slug}.png`) — se suben desde admin → Diplomas → Plantilla, no por portal.
- **`instructores.json`** — se autocrea con 2 nombres semilla la primera vez que se necesita; edítalo desde el mismo panel.
- **Catálogo real de Cursos/Recursos/Temas/etc.** — si todo se perdiera, el respaldo semanal (`respaldos/`) es la fuente de verdad más reciente; restaurar desde ahí a mano (no hay una Function de "restaurar", solo de generar el respaldo — restaurar sería releer el JSON y volver a escribir las entidades, tarea manual/con ayuda de Claude).

## 8. Dominio (`alfredopina.ai`) — pendiente, nunca se ha hecho

Esta fase **todavía no se ha ejecutado ni una vez** en producción (el sitio corre en la URL default de Azure). Cuando se conecte por primera vez: portal → Static Web App → "Dominios personalizados" → agregar `alfredopina.ai` → seguir las instrucciones de registro DNS que dé el portal en ese momento (no hay nada que documentar de antemano, los registros exactos los genera Azure al momento).
