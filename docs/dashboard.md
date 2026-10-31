# Dashboard → Resumen (dinero)

Pestaña **Resumen** del panel Dashboard (`/admin` → vista Dashboard, arriba a la izquierda). Pestañas: **Resumen · Cobranza · Ventas · Operaciones** (las tres últimas son solo una explicación, "pronto"; Alfredo las diseñará después y afinará qué entra en Operaciones) **· Productos** (se conserva como estaba).

Muestra **solo dinero, SIN IVA**, en tres vistas de una sola pantalla (se elige una a la vez con tres secciones: la primera a la izquierda, la del medio al centro, la última a la derecha):

| Vista | Filas | Clase |
|---|---|---|
| **Flujo de Venta y Cobranza** | Cotizado → Ganado → Facturado → Cobrado | flujo del mes |
| **Por vender y por cobrar** | Por vender (pipeline) · Por facturar · Por cobrar, que se abre en Facturado en plazo y Facturado vencido | foto al corte |
| **Oportunidades no cerradas** | Cerradas sin venta (perdido) + sus motivos | flujo del mes |

Cada fila: monto + **barra** (azul si está en su meta o por encima, azul claro si no, con la marca blanca de la meta y el texto «sobre/bajo su meta») + **línea de 12 meses** (punteada = meta; puntos con tooltip de mes y monto) + **variación** (porcentaje y monto) contra **Mes ant. · 3 meses · Año ant.** Debajo, **3 lecturas** (frases con reglas fijas, sin IA, que se recalculan con los filtros; ordenadas de lo más urgente a lo mejor; cada una lleva al Tracking donde se atiende). El botón **?** explica barras, línea y colores. La meta general de Alfredo es **aumentar Cotizado** (la fila lo trae marcado).

Mockup aprobado (contrato visual, datos de ejemplo): `docs/mockups/dashboard-resumen-v4.html` / `.png`. Cambios pedidos después del mockup: las tres vistas como secciones (una a la vez, sin scroll), título «Por vender y por cobrar» y la fila de Pipeline llamada «Por vender».

## Por qué está hecho así

- **El cálculo vive en el servidor, en JS** (`api/src/dashboard-dinero.js`, puro y probado). Las cuentas por cobrar se reconstruyen a cualquier fecha con `filasEn` de `dashboard-resumen.js` y se pasan por la **misma `cobranza.resumir` del Tracking**; así Por cobrar, Vencido y Cobrado cuadran con Cobranza. `dashboard-resumen-db.js` carga solo cuentas, pagos y cotizaciones (3 consultas ligeras; Solicitudes, Grupos y Clientes se omiten).
- **Todo sin IVA.** La cotización ya es subtotal (`precio_final`). Las cuentas se pasan a base subtotal: el total pasa a ser el `subtotal` y **cada pago se escala por subtotal / total** (el cobrado, el saldo y el vencido quedan sin IVA ni retenciones).
- **Flujo, no cohorte:** lo que ocurrió en el mes (una cotización enviada en octubre cuenta en octubre aunque se gane en diciembre). Cobrado puede superar a Facturado: se cobra cartera de meses anteriores.
- **Mismo corte:** el mes en curso (hasta hoy, día 28 por ejemplo) se compara con el mes anterior **hasta el mismo día**, y la serie de 12 meses y la meta usan también ese corte, para que el promedio sea justo. Un mes pasado se ve completo contra mes completo.
- **Meta = promedio de los puntos de la serie de 12 meses** (por ahora; Alfredo la definirá después). Con menos de 3 meses de historia no hay meta: la fila dice «sin meta aún» y la barra va azul.
- **Selector de mes independiente de «contar desde»** de Configuración. «Todo el historial» = acumulado hasta hoy, sin serie, sin meta ni comparación («acumulado»).
- **Comparación contra:** mes anterior (al mismo corte) · promedio de los 3 meses anteriores al mismo corte (solo los que tengan datos) · mismo periodo del año pasado (sin datos hasta que exista historia: «sin datos», nunca un número inventado; con 2027 se llena solo).
- **Deuteranomalía:** la variación siempre lleva ícono (↑ ↓ —) + texto + posición; la barra dice «sobre/bajo su meta» con ícono; las lecturas llevan ícono + palabra (ATENCIÓN · REVISAR · DATO · VA BIEN). Colores: verde-azulado = va bien, ámbar = va mal, rojo solo para el Vencido que crece (con la palabra «atención»), azul = neutral/igual.

## Definiciones (cada cifra)

| Fila | Qué cuenta | Reconstrucción |
|---|---|---|
| **Cotizado** | Cotizaciones **enviadas** en el mes (`fecha_envio`, o `fecha_creacion` si no se marcó). Una por grupo de alternativas, la de monto más alto. Sin Borrador ni Reemplazada. Incluye las que luego se ganaron, perdieron, descartaron o expiraron | por fecha de envío |
| **Ganado** | Cerradas como Ganada con `fecha_cierre` (o `fecha_estatus`) en el mes | por fecha de cierre |
| **Facturado** | Cuentas con `fecha_emision` en el mes (facturada sin fecha: desde su creación). No cuenta Canceladas ni facturas de terceros | por fecha de emisión |
| **Cobrado** | Pagos vigentes con fecha de pago en el mes | por fecha de pago |
| **Por vender** (pipeline) | Cotizaciones que **ya habían salido y aún no se cerraban** al corte (Enviada/En negociación, y las cerradas después del corte). Una por grupo de alternativas | por fechas de envío y cierre |
| **Por facturar** | Cuentas en estatus «Por facturar» (ganado sin factura) al corte | por fecha de creación y emisión |
| **Por cobrar** | Saldo de las cuentas facturadas al corte = **Facturado en plazo + Facturado vencido** | `resumir` sobre cuentas reconstruidas |
| **Facturado vencido** | La parte de Por cobrar cuyo vencimiento ya pasó | ídem |
| **Cerradas sin venta** | Cerradas como **Perdida** en el mes (las alternativas descartadas no son pérdida), con motivos de `motivo_perdida` (top 4, con % y monto) | por fecha de cierre |

### Qué filtro aplica a qué

- **Estrategia** existe solo en Cobranza (`CuentaPorCobrar.estrategia`): Facturado, Cobrado, Por facturar, Por cobrar y Vencido se filtran; **Cotizado, Ganado, Por vender y Cerradas sin venta no** y llevan la etiqueta **SIN FILTRAR** (ícono + texto) mientras haya una estrategia elegida. Cuando existan los Cursos Abiertos y se registre en las cotizaciones, se activa ahí.
- **Herramienta:** las cuentas la toman de su cotización o de su grupo; una cuenta manual sin cotización ni grupo no tiene herramienta y queda fuera cuando hay una elegida (la pantalla lo avisa).
- **Tipo de cliente** = `Cliente.tipo_cliente` actual del cliente de cada registro.

## Lo que no se puede reconstruir exacto (y por qué)

- **Pipeline de meses pasados:** no hay historial de estatus; se reconstruye con envío y cierre. Una cotización reabierta o cuyo cierre se editó se ve con su fecha actual. Una Ganada/Perdida sin fecha de cierre ni de estatus se toma como ya cerrada.
- **Cuentas canceladas:** no se sabe cuándo se cancelaron: quedan fuera de toda la historia.
- **Cuentas importadas del histórico (Excel de Viri):** su `fecha_creacion` es la del import; «Por facturar» de meses pasados solo es confiable para cuentas creadas en el sitio.
- **Vencimiento** se toma como está hoy; si se cambió después, el pasado se ve con el vencimiento nuevo.
- **Primer mes con datos:** antes del primer dato de cuentas o cotizaciones no hay línea ni promedio; el promedio de 3 meses usa solo los meses que sí tienen datos.

## Las 4 preguntas del módulo

- **¿Desde cuántos lugares se crea/edita/borra?** Es solo lectura (ya no guarda nada; la «foto diaria» del Resumen anterior dejó de usarse).
- **¿Estados?** Mes en curso (con corte) · mes pasado · «Todo el historial»; fila con meta / sin meta; comparación con datos / «sin datos» / «acumulado»; fila normal / SIN FILTRAR.
- **¿Si falla a la mitad?** Error de la Function → aviso con «Reintentar» sin borrar lo ya pintado. Cambiar de vista o de comparación no pide nada: el servidor manda las tres referencias de una vez.
- **¿Límite o costo?** Una apertura = 3 consultas ligeras (despierta la base; es admin). Cada cambio de **filtro** repite eso; cambiar de vista o de «comparar con» no.

## Archivos

`api/src/dashboard-dinero.js` (cálculo puro) · `api/src/dashboard-resumen.js` (reconstrucción de cuentas y fechas, compartida) · `api/src/dashboard-resumen-db.js` (carga) · `api/getDashboardResumenAdmin/` (Function admin, cerrada por el comodín `/api/*`) · `admin/index.html` (clases `rs-*`, IIFE «DASHBOARD → RESUMEN», pestañas `#dashTabs`) · pruebas: `api/test-dashboard-dinero.js` y `api/test-dashboard-resumen.js` (en `npm test`) y `tools/prueba-dashboard-resumen.js` (jsdom, `JSDOM_DIR`).

**Código heredado:** `dashboard-resumen.js` conserva el cálculo de las 25 tarjetas (`calcular`, `fotoDelDia`) y `dashboard-foto.js` la foto diaria; **ya no se usan** desde la Function. Se dejan por si los dashboards de detalle por Tracking (Ventas, Operaciones, Cobranza) reutilizan esas métricas; si no, se pueden borrar.
