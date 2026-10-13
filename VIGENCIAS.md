# VIGENCIAS — qué vence, cuándo y qué pasa si se descuida

Un solo lugar para ver todo lo que se renueva (cada mes, cada año o cada X tiempo): dominios, suscripciones, facturas, certificados, secretos y certificaciones. Se actualiza cada vez que se compra, renueva o cambia algo. **Las filas "por llenar" las completa Alfredo con la fecha real** (Claude no puede ver esas cuentas); un renglón sin fecha es un vencimiento que nadie está mirando.

> Repositorio público: aquí van fechas y nombres de servicios, **nunca** números de tarjeta, contraseñas ni secretos.

## Cada mes

| Qué | Cuándo | Si se descuida | Dónde | Estado |
|---|---|---|---|---|
| **Factura de Azure** | Al cierre de cada ciclo de facturación (el periodo exacto está en cada factura) | Una factura vencida **deshabilitó la suscripción y tumbó el sitio, la API, SQL y las tablas** (2026-09-25) | Portal de Azure → Facturación; método de pago con saldo y un **segundo contacto de facturación** | Documentado; revisar mensualmente |
| **Presupuesto y alerta de costos de Azure** | Se reinicia cada mes natural (corte por lo general en **UTC**: ver nota abajo) | Un cargo inesperado pasa sin aviso | Portal → Administración de costos → Presupuestos (hoy: $30/mes con alerta) | Alfredo decide a fin de octubre si lo baja |
| **Cuota gratis de la base de datos** (100 000 vCore-s) | Se renueva el día 1 de cada mes | Al agotarse la base **sigue y cobra** (≈ $0.31 por hora despierta) | Se ve en Configuración → Estado del sistema | Vigilado por el sitio |
| **Respaldo semanal de Table Storage** | Cada semana (cron de GitHub Actions) | Si falla, el sitio no avisa solo; Estado del sistema lo marca "Revisar" pasados 8 días | Configuración → Respaldos / Estado del sistema | Vigilado por el sitio |
| **Seguridad en Search Console y Bing** | Revisar una vez al mes | Una alerta de seguridad pasa desapercibida | Search Console y Bing Webmaster | Costumbre pendiente |

## Cada año o a plazo fijo

| Qué | Vence | Si se descuida | Dónde se renueva | Estado |
|---|---|---|---|---|
| **Dominio `alfredopina.ai`** | Comprado en **septiembre de 2026 por 2 años** → ≈ **sept-2028** (confirmar la fecha exacta) | El sitio, el correo y todos los links/QR dejan de existir | GoDaddy (activar renovación automática) | Fecha exacta por llenar |
| **Secreto de la app de Entra `apcweb-estado-bd`** | **≈ 2027-10-13** (12 meses desde que se creó) | El ícono de estado y la cuota de la base quedan en "no se sabe"; **nada más se rompe** | Entra ID → Registros de aplicaciones → apcweb-estado-bd → Certificados y secretos; luego cambiar `ESTADO_BD_CLIENT_SECRET` en la Static Web App | Poner recordatorio ~2027-09-13 |
| **Certificado HTTPS del sitio** | Se renueva solo (administrado por Azure) | — | — | Sin acción |
| **Restauración de la base SQL** | Azure guarda **~7 días** de respaldos automáticos (punto más antiguo visto el 2026-10-06) | Un problema descubierto después de 7 días no se puede deshacer | Portal → la base → Restaurar | Ver "Respaldos" en `ROADMAP.md` |

## Por llenar (Alfredo)

| Qué | Vence | Notas |
|---|---|---|
| Dominio `lifezen.com.mx` | por llenar | Su DNS está en un hosting viejo (privatesystems.net); el correo de Google Workspace depende de él |
| Dominios `data-master.mx`, `quieroaprenderexcel.com`, `pixeco.com.mx` | por llenar | Revisar SPF/DKIM/DMARC |
| Licencia de **Microsoft 365** | por llenar | Alberga el login de `/admin` (`alfredo.pina@lifezen.com.mx`) |
| **Google Workspace** (5 buzones) | por llenar | Se cancela después de migrar a Exchange Online y auditar |
| **Dropbox** y **OneDrive** | por llenar | El repo del sitio vive en una carpeta de Dropbox |
| **Certificaciones Microsoft Associate** (4) | por llenar, una por una | Las de rol vencen al año; se renuevan gratis con una evaluación en línea hasta ~6 meses antes |
| **Registro STPS** de persona física | por llenar | Condiciona el módulo DC-3 |
| **Microsoft Certified Trainer (MCT)** | por llenar | Si se decide ese camino |
| Registro de marca (IMPI) | aún no existe | Cuando se registre, anotar su vigencia |
| **Azure Communication Services** (correo) | por llenar | Verificar si el dominio de envío necesita renovación |

## Notas que conviene recordar

- **El corte de cada mes:** Azure Cost Management trabaja en **UTC**, y México (sin horario de verano desde 2022) está en UTC-6. El mes de costos y de la cuota gratis cierra, por lo general, a las **18:00 hora de Monterrey del último día del mes**, no a medianoche local. Además, los costos tardan entre 8 y 24 horas en aparecer, así que una alerta de presupuesto no es en tiempo real.
- **Los crons de GitHub Actions se apagan solos** si el repositorio pasa **60 días sin actividad**. Los avisos programados, el resumen de los lunes y el respaldo semanal dependen de eso: ante un periodo largo sin tocar el proyecto, revisar que sigan activos (pestaña Actions).
- **El login de `/admin` y la suscripción de Azure** viven en la cuenta `alfredo.pina@lifezen.com.mx`. Por decisión de Alfredo (2026-10-13) `lifezen.com.mx` sigue siendo su identidad principal y `alfredopina.ai` es la marca; por eso el **dominio y la licencia de `lifezen.com.mx` son críticos** y tienen que tener fecha en la tabla de arriba.
