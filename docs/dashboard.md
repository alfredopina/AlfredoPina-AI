# Dashboard → Resumen

Pestaña **Resumen** del panel Dashboard (`/admin` → SITIO → Dashboard; es la primera y abre por defecto; "Productos" se conserva). Muestra en una pantalla las **mismas 25 tarjetas** que ya tiene cada Tracking (5 × 5), con valor del periodo, línea de 12 meses y comparación contra el mes anterior, más un panel de filtros fijo arriba. El detalle se ve en el Tracking ("Ver detalle →"). **No hay meta todavía**: todo se compara contra el mes anterior (Alfredo definirá su meta con estos datos). Sin franja de alertas (esas se ven en Tracking View).

Mockup aprobado (contrato visual, datos de ejemplo): `docs/mockups/dashboard-resumen.html` / `.png`.

## Por qué está hecho así

- **El cálculo vive en el servidor, en JS, no en SQL** (`api/src/dashboard-resumen.js`, puro y probado). Los Trackings usan reglas que ya existen en código (`cobranza.resumir`, `cotizacion-alternativas.representantes`, `cliente-actividad`); calcular en JS permite **reutilizarlas tal cual** en vez de escribir una segunda fórmula que pudiera diferir de la del Tracking. Las tablas son chicas (cientos de filas) y nada viaja al navegador. `dashboard-resumen-db.js` solo carga filas ligeras con 6 consultas.
- **Cobranza usa la misma `resumir()`** del Tracking: para un mes pasado se reconstruye el estado de cada cuenta a ese instante (`filasEn`) y se le pasa a `resumir`; para el mes en curso y "Todo el historial" se pasan las filas de hoy (`filasAhora`), así la cifra es idéntica a la del Tracking sin "contar desde".
- **El selector de mes es independiente de Configuración → Métricas "contar desde"** (esa solo afecta a los Trackings). Para validar contra los Trackings, usa **"Todo el historial"** (acumulado, sin comparación).
- **Estrategia / Tipo de cliente / Herramienta** son filtros del servidor; donde un filtro no existe en el dato, la sección se marca "SIN FILTRAR" (borde punteado + etiqueta con ícono de embudo tachado) solo mientras haya un filtro activo que no puede aplicar. Nunca se inventa una cifra.
- **Deuteranomalía:** la comparación siempre va con ícono (↑ ↓ — reloj) + texto + posición; el color solo refuerza (verde-azulado = va bien, ámbar = va mal, azul = neutral/igual, rojo solo para Vencido en aumento con la palabra "atención").

## Comparación contra el mes anterior

- Mes en curso (hoy día 28) contra **el mismo corte** del mes anterior (hasta el día 28). Mes pasado: mes completo contra mes completo.
- "Igual" cuando el cambio relativo es menor a 3 %.
- Texto: dinero → "+18 % vs sep" ("desde cero vs sep" si antes era 0) · tasas → "+11 pts vs sep" · días → "−3 días vs sep" · horas → "−3 h vs sep" · conteos → "+1 vs sep".
- **Qué es "bien":** sube = bien en Cobrado, Ganado, Tasa de conversión, Solicitudes del sitio, % atendidas, Prospectos generados, Grupos Cerrados · baja = bien en Días promedio de cobro, Perdido, Tiempo promedio de cierre, Horas promedio de atención, Días promedio de cierre · sube = **mal** en Vencido (rojo + "atención") y Por facturar (ámbar) · neutral (sin juicio, azul) en todas las demás.

## Las 25 tarjetas: de dónde sale cada una

Clase: **flujo** = lo ocurrido dentro del mes · **stock** = cómo estaba todo al final del mes (reconstruido por fechas) · **foto** = estado de hoy, sin historia en la base.

| Sección | Tarjeta | Clase | Origen | Filtros que aplica |
|---|---|---|---|---|
| Cobranza | Por cobrar · Vencido · Por facturar | stock | `resumir` sobre cuentas reconstruidas a fin de mes (emisión, pagos con fecha, creación) | estrategia (columna real), tipo de cliente, herramienta |
| Cobranza | Cobrado · Días promedio de cobro | flujo | pagos vigentes por fecha de pago; días = emisión → último pago de cuentas Pagadas | ídem |
| Cotizaciones | Pipeline activo | foto | Enviada + En negociación, una por grupo de alternativas (monto más alto) | tipo, herramienta |
| Cotizaciones | Ganado · Perdido · Tasa de conversión · Tiempo promedio de cierre | flujo | `COALESCE(fecha_cierre, fecha_estatus)` dentro del mes; tiempo = `fecha_creacion → fecha_cierre` | tipo, herramienta |
| Solicitudes | manuales · del sitio · % atendidas · horas promedio · prospectos | flujo | `fecha_creacion` dentro del mes; horas = hasta la primera cotización | tipo, herramienta |
| Grupos | Grupos Cerrados · Días promedio de cierre | flujo | `fecha_cierre` dentro del mes; días = `fecha_fin → fecha_cierre` | tipo, herramienta |
| Grupos | Total | stock | grupos que ya existían a fin de mes (la más antigua de sus fechas: creación, inicio, fin, cierre) | tipo, herramienta |
| Grupos | Grupos Activos · Grupos de Clientes Directos | foto | estado de hoy (activo = cierre distinto de Cerrado; directos = cliente Directo) | tipo, herramienta |
| Clientes | Clientes · Clientes Directos (%) | stock | clientes con `fecha_creacion` ≤ fin de mes (sin fecha = ya estaba antes de la serie); no cuenta Prospecto ni Tercero | tipo |
| Clientes | Completos · Contactos · Clientes Activos | foto | `cliente-actividad.js` hoy (completo; semáforo verde = activo) | tipo |

### Qué filtro aplica a qué

- **Estrategia** existe solo en Cobranza (`CuentaPorCobrar.estrategia`; las facturas de terceros no tienen). Cotizaciones, Solicitudes, Grupos y Clientes **no la registran** → con una estrategia elegida quedan "SIN FILTRAR". Cuando existan los Cursos Abiertos y su dato se registre en esas tablas, se activa el filtro ahí.
- **Herramienta**: Cobranza la toma de su cotización (`Cotizacion.herramienta`) o de su grupo (`Grupo.herramientas`); una cuenta manual sin cotización ni grupo **no tiene herramienta y queda fuera** cuando hay una herramienta elegida (la sección lo avisa). Clientes: no aplica (SIN FILTRAR). Grupo con varias herramientas aparece en cada una.
- **Tipo de cliente** = `Cliente.tipo_cliente` actual del cliente de cada registro (Directo · Intermediario · Indirecto · Prospecto). En Clientes, Prospecto da 0 porque el Tracking no los cuenta.

## Lo que NO se puede reconstruir (y por qué)

- **Pipeline activo, Grupos Activos, Grupos de Clientes Directos, Completos, Contactos, Clientes Activos**: cambian de estatus sin guardar la fecha del cambio (no hay historial de "En negociación", de los pasos de Cliente, ni de quién era contacto cuándo). Se muestran como "estado de hoy" hasta tener fotos (abajo).
- **Cuentas canceladas**: no se sabe cuándo se cancelaron, así que quedan fuera de toda la historia.
- **Cuentas importadas del histórico** (Excel de Viri): su `fecha_creacion` es la del import; por eso "Por facturar" de meses pasados solo es confiable para las cuentas creadas en el sitio. Las facturadas sin `fecha_emision` cuentan desde su creación; un pago sin fecha cuenta en el mes de su alta.
- **Estatus de Solicitudes** ("% atendidas") es el estatus de hoy de las solicitudes de ese mes (no hay historial de estatus).
- **Vencimiento** se toma tal cual está hoy; si se cambió después, el pasado se ve con el vencimiento nuevo.

## Foto diaria (para las tarjetas "estado de hoy")

- Al abrir el Resumen, si **hoy** no hay foto, `getDashboardResumenAdmin` guarda una en **Table Storage** (tabla `DashboardFotos`, se crea sola; solo admin; **no es SQL y nada público la toca**). Una por día (`RowKey = YYYY-MM-DD` hora de Monterrey); la primera apertura del día fija la foto (idempotente: `createEntity` + 409 ignorado).
- Guarda **todas las combinaciones tipo de cliente × herramienta** (5 × 7 = 35 claves × 6 valores, ~3 KB): así cualquier filtro tiene historia. Estrategia no aplica a estas tarjetas.
- A prueba de fallos: si guardar o leer falla, el Resumen sigue (devuelve vacío). Las tarjetas pasan de "estado de hoy" a línea + comparación cuando existe una foto del mes anterior dentro del corte; la línea de 12 meses usa la última foto de cada mes.
- Por eso las primeras semanas esas 6 tarjetas dirán "estado de hoy"; la comparación aparece cuando exista una foto del mes anterior (la primera foto es del día de la primera apertura).

## Las 4 preguntas del módulo

- **¿Desde cuántos lugares se crea/edita/borra?** Es solo lectura; lo único que escribe es la foto diaria (una por día, solo desde esta Function).
- **¿Estados?** Mes en curso (con corte) · mes pasado · "Todo el historial"; tarjeta normal · estado de hoy · SIN FILTRAR.
- **¿Si falla a la mitad?** Error de la Function → aviso con "Reintentar" sin borrar lo que ya estaba pintado; la foto es independiente y silenciosa.
- **¿Límite o costo?** Una apertura = 6 consultas ligeras (despierta la base; es admin) + 2 lecturas de Table Storage. Cada cambio de filtro repite eso.

## Archivos

`api/src/dashboard-resumen.js` (cálculo puro) · `api/src/dashboard-resumen-db.js` (carga) · `api/src/dashboard-foto.js` (foto diaria) · `api/getDashboardResumenAdmin/` (Function admin, cerrada por el comodín `/api/*`) · `admin/index.html` (clases `rs-*`, IIFE "DASHBOARD → RESUMEN") · pruebas: `api/test-dashboard-resumen.js` (en `npm test`) y `tools/prueba-dashboard-resumen.js` (jsdom, `JSDOM_DIR`).
