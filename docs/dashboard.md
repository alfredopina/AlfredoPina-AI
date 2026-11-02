# Dashboard → Resumen (dinero)

Pestaña **Resumen** del panel Dashboard (`/admin` → vista Dashboard, arriba a la izquierda). Pestañas: **Resumen · Cobranza · Ventas · Operaciones** (las tres últimas son solo una explicación, "pronto"; Alfredo las diseñará después y afinará qué entra en Operaciones) **· Productos** (se conserva como estaba).

Es **un embudo en una sola pantalla** (rehecho el 2026-11-02; antes eran tres vistas separadas y a Alfredo le restaban). Todo en **pesos SIN IVA**, salvo Solicitudes (cantidad). Cinco barras **alineadas a la izquierda** (el embudo se imagina de la mitad hacia la derecha), con la misma escala; cada barra se reparte en segmentos sólidos que muestran **dónde está hoy ese dinero**:

| Barra | Qué mide | Segmentos (suman exactamente el total de la barra) |
|---|---|---|
| **Solicitudes** (cantidad) | solicitudes creadas en el mes | **Del sitio** · **Manuales** (las atendidas, por canal) · **Sin atender** (ámbar). Atendida = ya no está en «Nueva»; lo atendido mide lo mismo que Cotizado; la meta también es una cantidad |
| **Cotizado** (enviado en el mes) | cotizaciones enviadas, una por oportunidad | Por **tipo de servicio**: cursos estándar · cursos personalizados · consultoría (`temario_tipo`), con **cuántas cotizaciones** son y su monto. El tipo de una oportunidad con alternativas es el de su cotización de monto más alto |
| **Ganado** (cerrado en el mes, de cualquier cotización) | cotizaciones Ganadas con fecha de cierre en el mes | Ya facturado · **Por facturar** (ámbar), según la cuenta ligada a su cotización (`cotizacion_id`) |
| **Facturado** (emitido en el mes) | cuentas con fecha de emisión en el mes | Cobrado · Por cobrar en plazo · **Por cobrar vencido** (rojo), por el saldo y semáforo de hoy (misma regla de Cobranza). **Cohorte**. **Su meta es la de Ganado** (lo que ganas es lo que debes facturar) |
| **Cobrado** (pagos del mes) | pagos vigentes con fecha del mes | De facturas de este mes · De meses anteriores |

Cada fila: monto + **barra apilada** con **contorno punteado = meta** (sale del borde izquierdo; la barra lo rebasa o se queda corta) y el texto «sobre/bajo su meta» con ícono + **leyenda** de segmentos (monto y porcentaje) + **línea de 12 meses** (punteada = meta; puntos con tooltip de mes y monto) + **variación** (porcentaje y monto) contra **Mes ant. · 3 meses · Año ant.** Debajo, **3 lecturas** (una por etapa: Cotizado, Facturado, Cobrado; reglas fijas, sin IA, que se recalculan con los filtros; cada una lleva al Tracking donde se atiende) y la franja **«Hoy»** con la foto de TODA la cartera (Por vender · Por facturar · Por cobrar con el vencido destacado; en un mes pasado dice «Al cierre de …»), porque el vencido de un solo mes engañaría. El botón **?** explica barras, colores y variación. La meta general de Alfredo es **aumentar Cotizado** (la fila lo trae marcado).

**Etiquetas (decisión de Alfredo):** dentro de cada segmento va su **monto** (en Solicitudes, la cantidad), no un porcentaje; solo se escribe si cabe, y la leyenda de abajo nombra todos. El ancho de cada segmento es proporcional a su valor (se corrigió un error del primer despliegue en que las barras salían más cortas de lo debido).

**Colores (decisión de Alfredo, sólidos y sin tramas):** lo normal va en azules y grises sin significado; **solo se colorea lo que hay que mirar** — ámbar (sin atender, por facturar) y rojo (vencido). Si un segmento vale cero no se dibuja ni se lista. Los ámbar y rojos llevan además ícono de alerta en la leyenda (nunca solo color, por la deuteranomalía).

Mockup aprobado: `docs/mockups/dashboard-resumen-v5.html` / `.png` (el v4 de tres vistas queda como historial).

## Por qué está hecho así

- **El cálculo vive en el servidor, en JS** (`api/src/dashboard-dinero.js`, puro y probado). Las cuentas por cobrar se reconstruyen a cualquier fecha con `filasEn` de `dashboard-resumen.js` y se pasan por la **misma `cobranza.resumir` del Tracking**; así Por cobrar, Vencido y Cobrado cuadran con Cobranza. `dashboard-resumen-db.js` carga cuentas, pagos, cotizaciones y solicitudes (4 consultas ligeras; Grupos y Clientes se omiten).
- **Todo sin IVA.** La cotización ya es subtotal (`precio_final`). Las cuentas se pasan a base subtotal: el total pasa a ser el `subtotal` y **cada pago se escala por subtotal / total** (el cobrado, el saldo y el vencido quedan sin IVA ni retenciones).
- **El total de cada barra es siempre lo ocurrido en el mes** (una cotización enviada en octubre cuenta en octubre aunque se gane en diciembre); cómo se reparte, ver la tabla de arriba. Cobrado puede superar a Facturado: se cobra cartera de meses anteriores.
- **Mismo corte:** el mes en curso (hasta hoy, día 28 por ejemplo) se compara con el mes anterior **hasta el mismo día**, y la serie de 12 meses y la meta usan también ese corte, para que el promedio sea justo. Un mes pasado se ve completo contra mes completo.
- **Meta:** **Solicitudes (cantidad), Cotizado, Ganado y Cobrado** pueden llevar una **meta propia** (Configuración → Metas, desde 2026-11-01; Solicitudes se agregó el 2026-11-02): monto mensual SIN IVA (Solicitudes: número entero), del **mes completo** (no se prorratea aunque el mes vaya a medias: la barra muestra el avance hacia la meta del mes). El resto de las filas, y estas tres mientras su campo esté vacío, usan el **promedio de los puntos de la serie de 12 meses** (`metaOrigen: "promedio"`; el texto de la fila dice «prom. 12 m» en vez de «meta»). Con menos de 3 meses de historia y sin meta propia no hay meta: la fila dice «sin meta aún» y la barra va azul. Una meta de $0 es válida. «Todo el historial» nunca lleva meta.
- **Por qué solo tres:** son los números que Alfredo decide (cuánto cotizar, ganar y cobrar). Las demás se derivan o son topes (Por facturar, Por cobrar, Vencido: más bajo es mejor), y un tope necesita invertir la lectura de la barra; queda pendiente en `ROADMAP.md`. Las metas viven en Table Storage (`ConfiguracionNotificaciones`, renglón `config/metas`, `api/src/metas.js`): leerlas y guardarlas no despierta la base.
- **Selector de mes independiente de «contar desde»** de Configuración. «Todo el historial» = acumulado hasta hoy, sin serie, sin meta ni comparación («acumulado»).
- **Comparación contra:** mes anterior (al mismo corte) · promedio de los 3 meses anteriores al mismo corte (solo los que tengan datos) · mismo periodo del año pasado (sin datos hasta que exista historia: «sin datos», nunca un número inventado; con 2027 se llena solo).
- **Deuteranomalía:** la variación siempre lleva ícono (↑ ↓ —) + texto + posición; la fila dice «sobre/bajo su meta» con ícono; las lecturas llevan ícono + palabra (ATENCIÓN · REVISAR · DATO · VA BIEN). Colores de las variaciones: verde-azulado = va bien, ámbar = va mal, azul = igual. En las barras: ámbar = pendiente, rojo = vencido, el resto azules y grises.

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

`api/src/metas.js` + `api/getMetasAdmin/` + `api/guardarMetasAdmin/` (metas propias; tarjeta «Metas» de Configuración en `admin/index.html`) · `api/src/dashboard-dinero.js` (cálculo puro) · `api/src/dashboard-resumen.js` (reconstrucción de cuentas y fechas, compartida) · `api/src/dashboard-resumen-db.js` (carga) · `api/getDashboardResumenAdmin/` (Function admin, cerrada por el comodín `/api/*`) · `admin/index.html` (clases `rs-*`, IIFE «DASHBOARD → RESUMEN», pestañas `#dashTabs`) · pruebas: `api/test-dashboard-dinero.js` y `api/test-dashboard-resumen.js` (en `npm test`) y `tools/prueba-dashboard-resumen.js` (jsdom, `JSDOM_DIR`).

**Código heredado:** `dashboard-resumen.js` conserva el cálculo de las 25 tarjetas (`calcular`, `fotoDelDia`) y `dashboard-foto.js` la foto diaria; **ya no se usan** desde la Function. Se dejan por si los dashboards de detalle por Tracking (Ventas, Operaciones, Cobranza) reutilizan esas métricas; si no, se pueden borrar.

## Decisiones del embudo (2026-11-02)

- **Solicitudes en cantidad, no pesos** (Alfredo: «si cambio precios, dependiendo el sapo la pedrada»): nada de estimar con tarifas. «Atendida» = estatus distinto de Nueva (la misma regla del Tracking de Solicitudes). Su meta es una cantidad y se captura en Configuración → Metas.
- **Facturado es cohorte** (estado de hoy de lo emitido en el mes); **Ganado y Cobrado son flujo**; Cotizado se reparte por tipo de servicio (ya no por ganado/perdido: eso lo muestran las demás barras y la franja «Hoy»).
- **El desglose de Facturado y Ganado usa el estado de hoy**, también al mirar un mes pasado (no hay historial de estatus); «Hoy» sí se reconstruye al cierre del mes elegido.
- **Cuenta ↔ cotización:** si una cotización ganada no tiene cuenta (o su cuenta está cancelada o aún «Por facturar»), cuenta como Por facturar.
- La escala de Solicitudes no pasa de 1.6 veces la barra más larga (si hay una sola atendida, la barra no se dispara).

## Ajustes del 2026-11-02 (tarde) — manda esto sobre lo anterior si hay contradicción

Alfredo vio el embudo desplegado y pidió: **barras simples del v4** (una sola barra con su marca blanca de meta, más alta, con el monto escrito dentro o a su lado) en lugar de la barra apilada; **leyendas siempre visibles**, aunque valgan cero (atenuadas), **en una línea** y con **muestras en tonos de azul**; el ícono de alerta (sin color propio) marca solo lo pendiente o vencido con valor; se **quitó la franja «Hoy / Al cierre de…»** y la etiqueta **FOCO** de Cotizado; se **quitaron los subtítulos** de cada fila y los nombres son más grandes; **«Ganado» se llama «Vendido»** en pantalla (la llave interna sigue siendo `gan`); y se arregló el **color de la lista del filtro de Mes** (las opciones heredaban el fondo translúcido del filtro activo).
- Leyendas: Solicitudes (del sitio · manuales · sin atender) · Cotizado (estándar · personalizados · consultoría, con cuántas cotizaciones entre paréntesis y el monto) · Vendido (facturado · por facturar) · Facturado (cobrado · por cobrar en plazo · vencido) · Cobrado (de este mes · de meses anteriores). Facturado usa la meta de Vendido.
- El desglose sigue calculándose en el servidor (`desglose` de `calcularDinero`); el Vencido y Por facturar de toda la cartera ya no se muestran en una franja aparte: los trae la lectura de Facturado.

### Segunda ronda del 2026-11-02 (manda sobre lo anterior)

Las muestras de las leyendas no significaban nada con la barra simple, así que **la barra vuelve a dividirse en segmentos, en tonos de azul** (`#3d7fff`, `#7fb0ff`, `#cfe0ff`, uno por parte y el mismo tono en la leyenda), con el monto escrito dentro si cabe. Además: barras **50 % más altas** (36 px); **si la barra rebasa su meta vibra** (late y su contorno respira, como los demás elementos «vivos» del admin: `cot-vv`, `admin-live-pulse`; sin animación con «reducir movimiento») en lugar de cambiar de color; **«sobre/bajo su meta» se sustituyó por un triángulo** (verde hacia arriba = sobre su meta, rojo hacia abajo = por debajo; la dirección lo dice aunque no se distingan los colores) **con la meta al lado** (el texto queda solo para lectores de pantalla); el **ícono de Facturado** es ahora un recibo (se parecía al de Cotizado); la columna del concepto se angostó y la **variación** es más grande, con el chip y la nota de monto («+$500 vs sep») en paralelo.

### Tercera ronda del 2026-11-02 (manda sobre lo anterior)

- **Escala de Solicitudes:** su **meta mide lo mismo que la de Cotizado** (8 solicitudes ≈ $250,000), así las dos marcas de meta quedan en el mismo punto horizontal. Solo si falta alguna de las dos metas se usa la regla vieja (lo atendido mide lo mismo que Cotizado, sin pasar de 1.6 veces la barra más larga).
- **Las lecturas usan exactamente las cifras de las barras.** La de Facturado citaba cifras de toda la cartera (Por facturar y Vencido totales) que ya no aparecen en pantalla desde que se quitó la franja «Hoy»; ahora dice cuánto se facturó contra su meta, cuánto **de lo vendido este mes** sigue sin factura y cuánto **de lo facturado este mes** ya venció (las mismas cifras de las leyendas). El vencido de toda la cartera se atiende en Cobranza y en las alertas.

## Lecturas: biblioteca de reglas (2026-11-02)

Las 3 lecturas de abajo **ya no son fijas**: `api/src/dashboard-lecturas.js` evalúa **todas** sus reglas, cada una dice si aplica hoy, qué tan urgente es (tipo `urg` 90 · `alerta` 60 · `info` 35 · `bien` 20, más un peso de 0 a ~30 según lo grave o lo grande) y cita **nombres** (clientes, folios, días). Se muestran las 3 de mayor peso, **a lo más 2 de una misma etapa**; el resto queda en `lecturasOtras`. Una regla que falle se omite y el Resumen sale igual. La Function devuelve `lecturas` ya elegidas; la pantalla solo las pinta (negritas `**x**`, lista de nombres y botón al Tracking). Las reglas «del día» (pipeline, cartera, proyección) solo corren en el **mes en curso**; en un **mes cerrado** salen los resultados contra metas y en **todo el historial** un acumulado.

| Etapa | Regla (id) | Qué dice |
|---|---|---|
| Cotizado | `proyeccion-cotizado` | Al ritmo actual cierras en $X contra tu meta; te faltan $Y ≈ N cotizaciones de tu ticket promedio en D días (o «ya rebasaste tu meta») |
| Cotizado | `seguimiento-cotizaciones` | N cotizaciones abiertas con más de 6 días (umbral de Alertas), con cliente, monto, días y folio; urgente al pasar el umbral urgente (10) |
| Cotizado | `cierre-por-tipo` | Qué tipo de servicio cierra más (90 días, ≥3 cerradas por tipo y ≥15 pts de diferencia) |
| Cotizado | `descuentos-cierre` | El descuento de 15 % o más no mejora el cierre (6 meses, ≥4 cerradas en cada grupo) |
| Cotizado | `motivo-perdida` | Motivo principal de pérdida (90 días, ≥3 perdidas, ≥40 %) y qué hacer |
| Cotizado | `clientes-dormidos` | Clientes que ya compraron y llevan 6+ meses sin cotización (con cuánto compraron) |
| Cotizado | `concentracion-cotizado` | Un cliente concentra 50 % o más de lo cotizado del mes |
| Solicitudes | `solicitudes-sin-atender` | Solicitudes en «Nueva» con más de 24 h (urgente a las 72 h), con nombre y canal |
| Vendido | `cobertura-pipeline` | Por vender × tu tasa de cierre de 90 días contra lo que te falta para tu meta de Vendido |
| Facturado | `por-facturar-edad` | Vendido que lleva 7+ días sin factura, con cliente y días (urgente desde 14) |
| Facturado | `vendido-sin-factura` | Qué parte de lo vendido del mes sigue sin factura |
| Cobrado | `vencidos-top` | Vencido total, % de lo por cobrar y los clientes con más atraso (urgente desde 20 %) |
| Cobrado | `calendario-cobro` | Lo que vence en los próximos 7 días, con nombres |
| Cobrado | `proyeccion-cobrado` | Cobrado contra meta: lo que vence en el mes + lo vencido; avisa si aun cobrando todo no alcanza |
| Cobrado | `dias-de-cobro` | Cómo pagan tus clientes (días reales contra plazo, 6 meses) y quién se atrasa siempre |
| Cobrado | `concentracion-cartera` | Un cliente concentra 50 % o más de lo por cobrar |
| Cobrado | `cobrado-vs-facturado` | La cartera crece o baja este mes |
| Cobrado | `cartera-sana` | Sin cartera vencida (solo si no hay vencido) |
| Meses cerrados | `resultado-cot` · `resultado-gan` · `resultado-cob` | Cómo cerró cada meta |
| Acumulado | `acumulado` | Totales de todo el historial |

**Para agregar una regla** basta con un objeto más en `REGLAS` (id, etapa, `cuando`, `run(x)`); `x` trae las cifras del Resumen (`x.F`, `x.D`), las cotizaciones y cuentas ya filtradas, las filas de Cobranza de hoy (`x.vivas`) y los umbrales de Alertas. Pruebas: `api/test-dashboard-lecturas.js`.
**Límite conocido:** las cuentas importadas del histórico tienen como `fecha_creacion` la del import, así que su edad en `por-facturar-edad` se mide desde ahí.

### Cuarta ronda del 2026-11-02 (manda sobre lo anterior)

- **Meta = banderín** (idea 1 de las propuestas): un poste corto y una banderita con el monto corto de la meta (`$250k`, `$1.2M`; en Solicitudes, la cantidad) **arriba** de la barra. Ya no hay línea con bolita cruzando la barra, así que no se encima con las etiquetas de los segmentos; si la meta cae muy a la derecha (>82 %), la banderita se abre hacia la izquierda.
- **Botón «Siguientes 3»** junto al encabezado «LECTURAS POR PRIORIDAD · 1–3 DE n»: el servidor ya entrega todas las lecturas por prioridad (hasta 12: `lecturas` + `lecturasOtras`) y la pantalla las pagina de 3 en 3; al terminar vuelve a las primeras. Ícono de **chispas** que titilan en desfase y, al pulsar, aceleran y giran medio segundo («calculando») antes de que entren las siguientes con una animación escalonada. Sin animación si el sistema pide reducir movimiento. Al actualizar datos o cambiar filtros vuelve a las 3 más importantes.

### Quinta ronda del 2026-11-02 (manda sobre lo anterior)

El banderín no gustó y hacía el panel más alto. **La meta ahora es el diseño 5 (bullet chart)**: pista de 34 px con una barra de valor más delgada (22 px) que **arranca con corte recto**, con segmentos **pegados, sin huecos y con cortes rectos**; **solo se curva el final** de la barra. La meta es una **muesca blanca** que cruza la barra y su **etiqueta («meta $250k») va a la derecha, fuera de la pista** y a la altura de la barra, así que no agrega altura al panel y nunca se encima con la barra, aunque la rebase (la barra además vibra). El espacio de la etiqueta se reserva siempre para que todas las pistas midan lo mismo y la escala común se conserve. Mockup de las opciones: `docs/mockups/meta-disenos.html` / `.png`.

### Sexta ronda del 2026-11-02 (manda sobre lo anterior)

Se **quitó la etiqueta de meta a la derecha** de la pista (era redundante: el subtítulo de la barra, «▲ prom. 12 m $10,167» / «▼ meta $250,000», ya dice la meta); la muesca blanca se queda. El **subtítulo es más visible** (14 px, texto en tono principal y triángulo de 18 px). El **ícono de Facturado es un banco** (columnas bajo un frontón), distinto al de Cotizado y al de Cobrado.
