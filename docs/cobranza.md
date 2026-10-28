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

## Tipo de factura, nombre fiscal y facturas de terceros (sql/043, 2026-10-24)

Viri maneja tipos de factura según lo que retiene el cliente: **Empresa** (ISR 10 % + 2/3 del IVA), **Gobierno** (solo ISR 10 %), **Anterior** (sin retención, monto + IVA: así se facturaba antes y así lo dejó Owens) y **Otro** (facturas por cuenta de terceros — "favores" de Alfredo: se facturan a su nombre pero el tercero paga el impuesto). El tipo decide las retenciones (`retencionesDe` en `api/src/cobranza.js`; el front tiene la misma regla) y vive en `CuentaPorCobrar.tipo_factura`; el **nombre fiscal** (el de la factura, que usa Viri) en `razon_social`, y el nombre comercial es el Cliente del sitio. **"Otro" se guarda completo (para el reporte al contador) pero NO cuenta en las tarjetas ni en las alertas** y vive en su pestaña "Terceros". Los terceros viven en **Clientes con el tipo "Tercero"** (sql/044; mismo patrón que Prospecto: no se miden como cliente, no salen en los selectores de Solicitud/Cotización/Grupo ni en búsquedas públicas, solo en Cobranza vía `buscarClientesAdmin?facturables=1`). Regla única: **cliente Tercero ⇔ factura tipo Otro** (el sitio pone el tipo solo y rechaza mezclarlos). **Cobranza no crea clientes**: solo se elige de la lista; si no está, se da de alta antes en Clientes (evita duplicados y nombres mal escritos en datos de dinero, y mantiene a Viri con una sola acción). Idea futura: un tipo de factura por defecto por cliente.

## La tabla (rediseño 2026-10-25, pedido de Alfredo)

Columnas: Creada · Cliente (nombre fiscal arriba; debajo el comercial + RFC) · Estrategia · Factura (folio + tipo) · Concepto · Total (con el saldo debajo si es Parcial) · Vencimiento (en Pagadas pasa a "Fecha de pago" con en cuántos días se cobró) · Estatus · Semáforo · Acciones. Vistas, en el orden del trabajo de Viri: **Por facturar · Vencidas · Por cobrar · Pagadas · Canceladas · Terceros · Todo** (arranca en Por facturar). Filtros: Cliente (comercial, fiscal, código o RFC), Estrategia y Folio/UUID. Totales al pie de la vista.

**Semáforo** (siempre ícono + texto; debajo, "emitida hace N d"): rojo = ya pasó el vencimiento y no está pagada · verde = pagada · ámbar = no pagada y faltan ≤ 7 días (umbral editable) · neutro = "En plazo" (más de 7 días), "Sin plazo" (falta el contra-recibo) o "Por facturar". Verde significa solo "pagada"; por eso "en plazo" es neutro. **Acciones:** registrar pago (solo con saldo), notas (popover, `actualizarNotasCuentaCobrar`), editar y eliminar. **Eliminar** (`eliminarCuentaCobrar`) existe solo para errores de captura: se rechaza si la cuenta tiene pagos (aunque estén anulados) o folio/UUID de factura; ahí se cancela. Una factura timbrada se cancela en el SAT, no se borra.

## Línea de cobros (2026-10-28)

**Qué es y por qué:** un solo dibujo para responder "¿qué dinero va a entrar y cuándo?" sin leer la tabla. Va entre el banner y las vistas, y **no depende de las vistas ni de los filtros** (la tabla trabaja; la línea orienta). Se alimenta de la misma lista de la tabla (`cuentas`), sin consulta nueva. **Tres zonas:** *Vencido* a la izquierda (lo más viejo, más a la izquierda), *escala de meses* al centro (1, 3 o 6 meses; flechas ‹ › de un mes en un mes; marca HOY) y *Sin fecha* a la derecha (cuentas Por facturar y facturas sin contra-recibo). Cada cobro es una **línea en su fecha de vencimiento y su altura es el monto** (con tope en el percentil 90 para que una factura enorme no aplaste a las demás). Dos facturas del mismo día se juntan en una línea ("2 facturas") y al tocarla sale la lista. Tocar una línea abre la cuenta.

**Colores y símbolos (nunca solo color):** rojo ▲ vencido · ámbar ◷ pronto (la ventana de "por vencer" de Configuración → Alertas) · verde ● por llegar · azul ▭ por facturar o sin fecha · gris punteado ○ terceros (tipo Otro; no cuentan en las tarjetas). Las etiquetas (monto y cliente) solo se escriben si caben sin encimarse ni cruzar la frontera de su zona; el resto lleva su aviso al pasar el mouse. Lo que queda fuera de la ventana se anuncia en el pie ("Después/Antes de esta ventana: N cobros por $X"): nada se pierde de vista. "Ocultar" recuerda la preferencia (`localStorage admin-cbz-linea`, junto con la escala).

## Terceros sin estrategia (sql/045, 2026-10-28)

**Por qué:** una factura por cuenta de terceros (tipo Otro) no es ingreso de Alfredo, así que no pertenece a ninguna estrategia (In company o Abiertos). Dejarla vacía (NULL) evita que "cobrado por estrategia" se ensucie con dinero ajeno. La regla va en los dos sentidos y la garantiza un CHECK (`CK_CxC_estrategia_tercero`): tipo Otro ⇒ sin estrategia; cualquier otro tipo ⇒ estrategia obligatoria. El sitio la pone solo (cliente Tercero ⇒ tipo Otro ⇒ estrategia vacía; si una cuenta deja de ser Otro vuelve a In company) y la pantalla muestra "—" o "Sin estrategia" y bloquea el campo.

**Pago "PUE"** (Pago en Una sola Exhibición): en el Excel de Viri, un PUE donde iría el UUID del complemento significa que NO aplica complemento de pago. La importación lo guarda sin UUID y deja la nota en el pago.

## Tolerancia de centavos y nombres de estrategia (2026-10-28)

**Por qué:** en el histórico hay pagos de $45,759.98 contra una factura de $45,760.00 (redondeos de Facturama o del banco). Con la regla estricta la cuenta quedaba "Parcial" con $0.02 de saldo para siempre. Ahora una diferencia de **hasta 5 centavos** cuenta como saldo cero y como Pagada (`TOLERANCIA_CENTAVOS` en `api/src/cobranza.js`: `saldoDe`, `estatusDerivado` y `validarPago`, que acepta un pago que se pasa por centavos). 6 centavos o más ya es un saldo real. Las estrategias se muestran como **"Cursos In company"** y **"Cursos Abiertos"** (los valores internos `empresas` / `abiertos` no cambian).

## Cómo nacen las cuentas (decisión de Alfredo 2026-10-24)

La cobranza nace de la **operación**, para que Viri se entere de qué hay que facturar: (1) una **cotización ganada**; (2) un **grupo creado directo**, sin cotización (Gobierno, CAINTRA contratan directo). Ambas nacen en "Por facturar". Un grupo directo lleva un campo opcional "Monto a facturar (sin IVA)" en Crear Grupo; si queda vacío la cuenta nace en $0 ("Por definir") y Viri lo captura. Una cuenta por grupo (índice único, sql/042). El alta manual (casos raros) puede ligarse a un grupo existente. Alertas nuevas: "Por facturar" sin facturar desde N días (umbral `cobranzaPorFacturarDias`, default 3). La tabla lleva **Creada** (fecha y hora) como primera columna, como los demás Trackings.

**Incidente (2026-10-24):** en el primer push `getNotificacionesActivas` desestructuraba la señal `cobranza` sin que `Promise.all` se la diera → TypeError → 500 y la campana de Alertas fallaba. Lo atrapa ahora `api/test-alertas-cobranza.js`, que corre la Function real con la base simulada.

## Functions (todas cerradas por defecto; ninguna pública)

`listCobranzaAdmin`, `getResumenCobranzaAdmin`, `crearCuentaCobrar`, `editarCuentaCobrar`, `cambiarEstatusCuentaCobrar`, `dividirCuentaCobrar`, `registrarPagoCobranza`, `anularPagoCobranza`. La lógica pura (IVA, saldo, estatus, semáforo, resumen) vive en `api/src/cobranza.js` y las escrituras en `api/src/cobranza-db.js`. Pruebas: `api/test-cobranza.js` (en `npm test`) y `tools/prueba-cobranza.js` (jsdom, datos ficticios).

## Pendiente

- **Importación única del Excel de Viri** (script en `tools/`, nunca con datos en el repo; dry-run primero y esperar el "dale"): falta la ruta del archivo.
- **Niveles futuros de Facturama** (no hoy): 2) lectura por API, 3) clientes sincronizados, 4) timbrar desde el sitio con botón explícito de Viri.
- Tarjeta de Cobranza en Tracking View y Cobranza en la búsqueda global (no se hicieron en la fase 1).
