# Cobranza (Tracking) — Fase 1: libreta de cobros

Construido el 2026-10-22. Alcance de la fase 1: **ver cuánto cobra Alfredo y qué tan rápido**, para medir sus dos estrategias (cursos a empresas y cursos abiertos). **Sin timbrar facturas, sin correos de cobranza ni al cliente** (no se construyen sin pedido), sin Alcance.

## Las 4 preguntas del módulo

1. **¿Desde cuántos lugares se crea, edita o borra?** Se crea desde 3: el hook al pasar una Cotización a **Ganada** (`actualizarEstatusCotizacion`), el hook de `crearGrupo` (que también cierra la cotización como Ganada) y el **alta manual** (cobros sin cotización, cursos abiertos). Se edita solo desde el detalle del panel. **No se borra nunca**: se cancela, y un pago mal capturado se *anula*.
2. **¿Qué estados tiene?** Por facturar → Facturada → Parcial → Pagada, y Cancelada. **Parcial/Pagada se derivan de los pagos** (se recalculan en la misma transacción al registrar o anular un pago); Cancelada es manual y reversible (reabrir).
3. **¿Qué pasa si falla a la mitad?** Todo va en **transacción** (`enTransaccion` en `api/src/cobranza-db.js`): cuenta + pago + recálculo de estatus quedan juntos o no queda nada. En el hook de Ganada, el cambio de estatus de la cotización y el nacimiento de su cuenta también van juntos (antes era un UPDATE suelto).
4. **¿Qué límite o costo tiene?** Ninguno nuevo: es solo admin, así que despierta la base como el resto del admin (no rompe la regla "lo público no toca SQL"). Las lecturas llevan el reintento de 4/8/15 s; las **escrituras se mandan una sola vez** a propósito (un reintento ciego podría duplicar un pago).

## Modelo de datos (`sql/040_cobranza.sql`)

- **`CuentaPorCobrar`**: una cuenta por **factura**. Una cotización ganada puede tener varias (anticipos/parcialidades): la cuenta se **divide**. `subtotal / iva / total` explícitos. `vencimiento` es columna calculada (`inicio_plazo + plazo_dias`).
- **`PagoCobranza`**: pagos como **filas**. El **saldo nunca es una columna**: se calcula (`total − pagos vigentes`). Un pago no puede exceder el saldo.
- **Un índice único filtrado** (`origen = 'Automática'` por `cotizacion_id`) garantiza que el hook sea **idempotente** aunque se marque Ganada dos veces o se regrese y vuelva. Si la cuenta ya existió (aunque se cancelara) **no se recrea**.
- Columnas listas para crecer sin migrar: `folio_factura`, `uuid_factura`, `rfc_receptor`, `uuid/folio_complemento` (hoy capturados a mano; Facturama después).

## Decisiones y por qué

- **IVA:** la cotización va **antes de impuestos** (la propia propuesta lo dice: "monto antes de impuestos, aplican IVA…"). Por eso `precio_final` = subtotal y la cuenta calcula IVA 16 % aparte. En el alta manual se puede capturar subtotal (se suma el 16 %) o el total ya con IVA (el subtotal sale al revés); el Excel de Viri trae el total con IVA.
- **Retenciones (sql/041):** Alfredo es persona física con actividad empresarial: los clientes pueden retenerle ISR y/o IVA y lo que cobra es **menos que subtotal + IVA**. `total = subtotal + IVA − retención ISR − retención IVA` (es el "Total" del CFDI y de su Excel; el saldo y los pagos se calculan contra él, si no la cuenta se quedaría en Parcial para siempre). La cotización es solo subtotal. La cuenta automática nace con retenciones en 0 y se capturan en el detalle al facturar: no se adivina qué cliente retiene (la tabla Cliente no lo guarda; si hace falta, a futuro una bandera por cliente). Patrones vistos en el Excel: Gobierno retiene solo 10 % de ISR (9,600 + 1,536 − 960 = 10,176); otros, ISR 10 % + 2/3 del IVA; otros, nada.
- **Inicio del plazo ≠ fecha de factura:** en gobierno el plazo cuenta desde el contra-recibo. Por eso son dos campos y el vencimiento solo existe cuando hay inicio de plazo. Sin él, el semáforo dice **"Sin plazo"** (neutro), no "al corriente".
- **Semáforo (deuteranomalía):** siempre **ícono + texto + posición**, y el color corresponde a la condición real: rojo = vencida, ámbar = por vencer (umbral editable, default 7 días), verde-azulado = al corriente, neutro = sin plazo / cerrada.
- **Orden por defecto = lo más urgente primero** (`compararUrgencia`): vencidas (la más atrasada arriba) → por vencer (la que vence antes) → sin plazo → al corriente → cerradas. "Todo" es la última vista.
- **Tarjetas:** *Por cobrar, Vencido y Por facturar son estado vivo* (no se filtran, como el pipeline de Cotizaciones). *Cobrado y Días promedio de cobro son acumulados y respetan Configuración → Métricas "contar desde/hasta"* (por **fecha de pago**). Nunca se reinician solas; las métricas mensuales irán en el Dashboard (pendiente de Alfredo).
- **Días promedio de cobro:** de la **fecha de emisión** al **último pago**, solo cuentas Pagadas con todas sus fechas. Un pago "sin fecha" (histórico) cuenta como cobrado solo cuando no hay rango y **nunca** entra al promedio.
- **El histórico del Excel de 2026 no trae fecha de pago ni monto pagado**, solo el UUID/folio del complemento: por eso `PagoCobranza.fecha` admite NULL. Estatus del Excel: "Pagado", "Vigente No Pagado", "Cancelada" (→ Pagada, Facturada, Cancelada).
- **Un mismo complemento de pago puede cubrir varias facturas** (visto en el Excel): el UUID del complemento se repite entre pagos de cuentas distintas; no es único.
- **Dinero que no se borra:** una cotización con cuentas en Cobranza **no se puede eliminar** (409 con mensaje); un cliente con cuentas tampoco (aparece como "Cobranza" en sus dependencias); `eliminarGrupo` solo desliga `grupo_id`.

## Alertas y configuración

- Cuentas con saldo **vencidas** (rojo) o **por vencer** (ámbar) entran al ícono de Alertas y a su página (sección "Cobranza"); cada alerta abre la cuenta. Lo vencido siempre alerta; el único umbral es `cobranzaPorVencerDias` (Configuración → Alertas → "Cobros por vencer"). No es un par urgente/seguimiento como los demás, por eso `actualizarUmbral` acepta campos sin par.
- Configuración → Métricas tiene la fila "Cobranza" (`cobranza` en `api/src/metricas-desde.js`).

## Functions (todas cerradas por defecto; ninguna pública)

`listCobranzaAdmin`, `getResumenCobranzaAdmin`, `crearCuentaCobrar`, `editarCuentaCobrar`, `cambiarEstatusCuentaCobrar`, `dividirCuentaCobrar`, `registrarPagoCobranza`, `anularPagoCobranza`. La lógica pura (IVA, saldo, estatus, semáforo, resumen) vive en `api/src/cobranza.js` y las escrituras en `api/src/cobranza-db.js`. Pruebas: `api/test-cobranza.js` (en `npm test`) y `tools/prueba-cobranza.js` (jsdom, datos ficticios).

## Pendiente

- **Importación única del Excel de Viri** (script en `tools/`, nunca con datos en el repo; dry-run primero y esperar el "dale"): falta la ruta del archivo.
- **Niveles futuros de Facturama** (no hoy): 2) lectura por API, 3) clientes sincronizados, 4) timbrar desde el sitio con botón explícito de Viri.
- Tarjeta de Cobranza en Tracking View y Cobranza en la búsqueda global (no se hicieron en la fase 1).
