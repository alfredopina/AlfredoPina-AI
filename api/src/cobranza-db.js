// Escrituras y lecturas SQL de Cobranza. Todas las escrituras reciben `nuevaRequest` = () => Request ligado a una transacción,
// así una cuenta + sus pagos + el recálculo de estatus quedan juntos o no queda nada (mismo patrón que cotizacion-eliminar.js).
const { getPool, sql } = require("./backoffice-db");
const C = require("./cobranza");

const CAMPOS_TEXTO = { concepto: 300, folio_factura: 40, uuid_factura: 40, rfc_receptor: 15, orden_compra: 60 };

const limpio = (v, max) => { const t = String(v == null ? "" : v).trim(); return t ? t.slice(0, max) : null; };

async function cargarCuenta(nuevaRequest, id) {
  if (!id) throw C.falla("Falta el id de la cuenta.");
  const r = await nuevaRequest().input("id", sql.Int, id).query("SELECT * FROM CuentaPorCobrar WHERE id = @id");
  if (!r.recordset.length) throw C.falla("Esa cuenta ya no existe.", 404);
  const p = await nuevaRequest().input("id", sql.Int, id).query("SELECT id, monto, anulado FROM PagoCobranza WHERE cuenta_id = @id");
  return { cuenta: r.recordset[0], pagos: p.recordset };
}

// recalcula Parcial/Pagada/Facturada a partir de los pagos vigentes y lo guarda si cambió
async function recalcularEstatus(nuevaRequest, id) {
  const { cuenta, pagos } = await cargarCuenta(nuevaRequest, id);
  const nuevo = C.estatusDerivado({ estatusActual: cuenta.estatus, total: cuenta.total, pagos, tieneFactura: !!(cuenta.folio_factura || cuenta.uuid_factura) });
  if (nuevo !== cuenta.estatus) {
    await nuevaRequest().input("id", sql.Int, id).input("e", sql.NVarChar, nuevo)
      .query("UPDATE CuentaPorCobrar SET estatus = @e, fecha_estatus = SYSUTCDATETIME() WHERE id = @id");
  }
  return nuevo;
}

function leerCampos(b, parcial) {
  const out = {};
  for (const [campo, max] of Object.entries(CAMPOS_TEXTO)) {
    if (parcial && !(campo in b)) continue;
    out[campo] = limpio(b[campo], max);
  }
  if (!parcial && !out.concepto) throw C.falla("Falta el concepto.");
  if (out.concepto === null && "concepto" in out) throw C.falla("El concepto no puede quedar vacío.");
  for (const campo of ["fecha_emision", "inicio_plazo"]) {
    if (parcial && !(campo in b)) continue;
    const v = b[campo];
    if (v == null || v === "") { out[campo] = null; continue; }
    if (!C.aFecha(v)) throw C.falla("Las fechas deben verse como 2026-10-22.");
    out[campo] = String(v).slice(0, 10);
  }
  if (!parcial || "plazo_dias" in b) {
    const p = b.plazo_dias == null || b.plazo_dias === "" ? C.PLAZO_DEFAULT : Number(b.plazo_dias);
    if (!Number.isInteger(p) || p < 0 || p > 365) throw C.falla("El plazo debe ser un número entero de días (0 a 365).");
    out.plazo_dias = p;
  }
  if (!parcial || "estrategia" in b) {
    const e = String(b.estrategia || "empresas");
    if (!C.ESTRATEGIAS.includes(e)) throw C.falla("Estrategia no válida.");
    out.estrategia = e;
  }
  if (!parcial || "notas" in b) out.notas = limpio(b.notas, 4000);
  return out;
}

const TIPOS = { fecha_emision: sql.Date, inicio_plazo: sql.Date, plazo_dias: sql.Int, subtotal: sql.Decimal(12, 2), iva: sql.Decimal(12, 2), retencion_isr: sql.Decimal(12, 2), retencion_iva: sql.Decimal(12, 2), total: sql.Decimal(12, 2), cliente_id: sql.Int, cotizacion_id: sql.Int, grupo_id: sql.Int };
const dia = (v) => (v ? new Date(v).toISOString().slice(0, 10) : null);
const fechaSql = (v) => (v ? new Date(v + "T00:00:00Z") : null);

async function insertarCuenta(nuevaRequest, datos) {
  const cols = Object.keys(datos);
  const req = nuevaRequest();
  for (const c of cols) req.input(c, TIPOS[c] || sql.NVarChar, c === "fecha_emision" || c === "inicio_plazo" ? fechaSql(datos[c]) : datos[c]);
  const r = await req.query(`INSERT INTO CuentaPorCobrar (${cols.join(", ")}) OUTPUT INSERTED.id VALUES (${cols.map((c) => "@" + c).join(", ")})`);
  return r.recordset[0].id;
}

// Alta manual (cobros sin cotización, cursos abiertos)
async function crearCuentaManual(nuevaRequest, b) {
  const clienteId = Number(b.cliente_id);
  if (!clienteId) throw C.falla("Elige el cliente.");
  const c = await nuevaRequest().input("id", sql.Int, clienteId).query("SELECT id FROM Cliente WHERE id = @id");
  if (!c.recordset.length) throw C.falla("Ese cliente ya no existe.", 404);
  const montos = C.desglosarMonto(b);
  if (!(montos.total > 0)) throw C.falla("El total debe ser mayor a cero.");
  const campos = leerCampos(b, false);
  let grupoId = null;
  if (b.grupo_id) {
    grupoId = Number(b.grupo_id);
    const g = await nuevaRequest().input("g", sql.Int, grupoId).query("SELECT cliente_id, cliente_final_id FROM Grupo WHERE id = @g");
    if (!g.recordset.length) throw C.falla("Ese grupo ya no existe.", 404);
    if (g.recordset[0].cliente_id !== clienteId && g.recordset[0].cliente_final_id !== clienteId) throw C.falla("Ese grupo no es de ese cliente.");
  }
  const facturada = !!(campos.folio_factura || campos.uuid_factura);
  const id = await insertarCuenta(nuevaRequest, { cliente_id: clienteId, ...(grupoId ? { grupo_id: grupoId } : {}), origen: "Manual", ...campos, ...montos, estatus: facturada ? "Facturada" : "Por facturar" });
  return { id };
}

// Hook de "Ganada": una cuenta Automática por cotización (el índice único filtrado lo garantiza; aquí se evita ni intentarlo).
// Si la cuenta ya existió (aunque luego se cancelara) NO se vuelve a crear: marcar Ganada otra vez no duplica ni revive nada.
async function crearCuentaDeCotizacion(nuevaRequest, cotizacionId) {
  const ya = await nuevaRequest().input("id", sql.Int, cotizacionId).query("SELECT TOP 1 id FROM CuentaPorCobrar WHERE cotizacion_id = @id");
  if (ya.recordset.length) return { creada: false, id: ya.recordset[0].id };
  const r = await nuevaRequest().input("id", sql.Int, cotizacionId).query(
    "SELECT id, folio, cliente_id, herramienta, precio_final FROM Cotizacion WHERE id = @id"
  );
  if (!r.recordset.length) return { creada: false, id: null };
  const cot = r.recordset[0];
  const montos = C.desglosarDesdeSubtotal(cot.precio_final);
  const concepto = `Cotización ${cot.folio} — ${cot.herramienta}`.slice(0, 300);
  const id = await insertarCuenta(nuevaRequest, { cliente_id: cot.cliente_id, cotizacion_id: cot.id, origen: "Automática", estrategia: "empresas", concepto, ...montos, estatus: "Por facturar" });
  return { creada: true, id };
}

// Hook de crearGrupo SIN cotización (el cliente contrata directo): nace una cuenta "Por facturar" ligada al grupo, con el monto que Alfredo
// haya escrito (sin IVA) o en $0 "por definir" si lo dejó vacío — Viri lo captura al facturar. Una por grupo (índice único, sql/042).
async function crearCuentaDeGrupo(nuevaRequest, { grupoId, clienteId, concepto, monto }) {
  const ya = await nuevaRequest().input("g", sql.Int, grupoId).query("SELECT TOP 1 id FROM CuentaPorCobrar WHERE grupo_id = @g AND origen = 'Automática' AND cotizacion_id IS NULL");
  if (ya.recordset.length) return { creada: false, id: ya.recordset[0].id };
  const m = Number(monto);
  if (monto != null && monto !== "" && (!Number.isFinite(m) || m < 0)) throw C.falla("El monto a facturar debe ser un número de cero en adelante.");
  const montos = m > 0 ? C.desglosarDesdeSubtotal(m) : { subtotal: 0, iva: 0, total: 0 };
  const id = await insertarCuenta(nuevaRequest, {
    cliente_id: clienteId, grupo_id: grupoId, origen: "Automática", estrategia: "empresas",
    concepto: String(concepto || "Grupo").slice(0, 300), ...montos, estatus: "Por facturar",
  });
  return { creada: true, id };
}

// Editar datos de la factura/plazo/notas. El monto solo se toca mientras no haya pagos (el saldo es sagrado).
async function editarCuenta(nuevaRequest, b) {
  const id = Number(b.id);
  const { cuenta, pagos } = await cargarCuenta(nuevaRequest, id);
  const campos = leerCampos(b, true);
  let montos = {};
  if (["subtotal", "iva", "total", "retencion_isr", "retencion_iva"].some((k) => k in b && b[k] !== "" && b[k] != null)) {
    if (C.totalPagado(pagos) > 0) throw C.falla("Ya hay pagos registrados: el monto ya no se edita (anula los pagos o crea otra cuenta).", 409);
    // si solo cambian las retenciones (o el IVA) se parte del subtotal que ya tiene la cuenta
    const hayTotalSolo = (b.subtotal === "" || b.subtotal == null) && b.total !== "" && b.total != null;
    const entrada = hayTotalSolo ? b : { ...b, subtotal: b.subtotal !== "" && b.subtotal != null ? b.subtotal : cuenta.subtotal, iva: b.iva !== "" && b.iva != null ? b.iva : cuenta.iva,
      retencion_isr: "retencion_isr" in b ? b.retencion_isr : cuenta.retencion_isr, retencion_iva: "retencion_iva" in b ? b.retencion_iva : cuenta.retencion_iva };
    montos = C.desglosarMonto(entrada);
    if (!(montos.total > 0)) throw C.falla("El total debe ser mayor a cero.");
  }
  const datos = { ...campos, ...montos };
  const cols = Object.keys(datos);
  if (!cols.length) return { id };
  const req = nuevaRequest().input("id", sql.Int, id);
  for (const c of cols) req.input(c, TIPOS[c] || sql.NVarChar, c === "fecha_emision" || c === "inicio_plazo" ? fechaSql(datos[c]) : datos[c]);
  await req.query(`UPDATE CuentaPorCobrar SET ${cols.map((c) => `${c} = @${c}`).join(", ")} WHERE id = @id`);
  // capturar el folio/UUID de una cuenta "Por facturar" la pasa a Facturada
  const refrescada = await cargarCuenta(nuevaRequest, id);
  if (refrescada.cuenta.estatus === "Por facturar" && (refrescada.cuenta.folio_factura || refrescada.cuenta.uuid_factura)) {
    await nuevaRequest().input("id", sql.Int, id).query("UPDATE CuentaPorCobrar SET estatus = 'Facturada', fecha_estatus = SYSUTCDATETIME() WHERE id = @id");
  }
  await recalcularEstatus(nuevaRequest, id);
  return { id };
}

// Estatus manual: Por facturar | Facturada | Cancelada. Reabrir (de Cancelada) lo recalcula según pagos y factura.
async function cambiarEstatus(nuevaRequest, id, estatus) {
  if (!C.ESTATUS_MANUALES.includes(estatus)) throw C.falla("Ese estatus no se cambia a mano (Parcial y Pagada salen de los pagos).");
  const { cuenta, pagos } = await cargarCuenta(nuevaRequest, id);
  if (estatus === "Cancelada" && C.totalPagado(pagos) > 0) throw C.falla("Ya tiene pagos registrados: anúlalos antes de cancelar la cuenta.", 409);
  if (estatus === "Por facturar" && C.totalPagado(pagos) > 0) throw C.falla("Ya tiene pagos registrados: no puede regresar a Por facturar.", 409);
  if (cuenta.estatus === "Cancelada" && estatus === "Facturada") {
    // reabrir: vuelve a Facturada si ya tenía folio/UUID, si no a Por facturar (luego recalcularEstatus lo acomoda según pagos)
    const vuelve = cuenta.folio_factura || cuenta.uuid_factura ? "Facturada" : "Por facturar";
    await nuevaRequest().input("id", sql.Int, id).input("e", sql.NVarChar, vuelve).query("UPDATE CuentaPorCobrar SET estatus = @e, fecha_estatus = SYSUTCDATETIME() WHERE id = @id");
  } else if (cuenta.estatus !== estatus) {
    await nuevaRequest().input("id", sql.Int, id).input("e", sql.NVarChar, estatus).query("UPDATE CuentaPorCobrar SET estatus = @e, fecha_estatus = SYSUTCDATETIME() WHERE id = @id");
  }
  return { estatus: await recalcularEstatus(nuevaRequest, id) };
}

async function registrarPago(nuevaRequest, b) {
  const id = Number(b.cuenta_id);
  const { cuenta, pagos } = await cargarCuenta(nuevaRequest, id);
  const monto = C.validarPago({ total: cuenta.total, pagos, estatus: cuenta.estatus }, b);
  const fecha = b.fecha ? String(b.fecha).slice(0, 10) : null;
  await nuevaRequest()
    .input("cuenta", sql.Int, id).input("fecha", sql.Date, fechaSql(fecha)).input("monto", sql.Decimal(12, 2), monto)
    .input("metodo", sql.NVarChar, limpio(b.metodo, 30)).input("uuid", sql.NVarChar, limpio(b.uuid_complemento, 40))
    .input("folio", sql.NVarChar, limpio(b.folio_complemento, 40)).input("notas", sql.NVarChar, limpio(b.notas, 300))
    .query("INSERT INTO PagoCobranza (cuenta_id, fecha, monto, metodo, uuid_complemento, folio_complemento, notas) VALUES (@cuenta, @fecha, @monto, @metodo, @uuid, @folio, @notas)");
  return { estatus: await recalcularEstatus(nuevaRequest, id) };
}

// "Borrar" un pago = anularlo (reversible a la vista: queda en el historial con su marca)
async function anularPago(nuevaRequest, pagoId) {
  const r = await nuevaRequest().input("id", sql.Int, Number(pagoId)).query("SELECT id, cuenta_id, anulado FROM PagoCobranza WHERE id = @id");
  if (!r.recordset.length) throw C.falla("Ese pago ya no existe.", 404);
  const pago = r.recordset[0];
  if (!pago.anulado) await nuevaRequest().input("id", sql.Int, pago.id).query("UPDATE PagoCobranza SET anulado = 1, fecha_anulado = SYSUTCDATETIME() WHERE id = @id");
  return { estatus: await recalcularEstatus(nuevaRequest, pago.cuenta_id) };
}

// La 1ª parte se queda en la cuenta original (mismo id, mismo folio); las demás nacen como cuentas nuevas, hermanas, sin factura.
async function dividirCuenta(nuevaRequest, id, partes) {
  const { cuenta, pagos } = await cargarCuenta(nuevaRequest, Number(id));
  const lista = C.validarDivision({ total: cuenta.total, estatus: cuenta.estatus, pagos }, partes);
  const proporcion = (t) => (Number(cuenta.total) ? t / Number(cuenta.total) : 0);
  // cada concepto se reparte en proporción al total; el IVA absorbe el redondeo para que subtotal + IVA − retenciones = total exacto
  const desglose = (t) => {
    const sub = C.centavos(Number(cuenta.subtotal) * proporcion(t));
    const isr = C.centavos(Number(cuenta.retencion_isr || 0) * proporcion(t));
    const riva = C.centavos(Number(cuenta.retencion_iva || 0) * proporcion(t));
    return { subtotal: sub, iva: C.centavos(t - sub + isr + riva), retencion_isr: isr, retencion_iva: riva, total: t };
  };
  const nuevas = [];
  for (let i = 0; i < lista.length; i++) {
    const m = desglose(lista[i].total);
    const concepto = lista[i].concepto || `${cuenta.concepto} (parte ${i + 1} de ${lista.length})`.slice(0, 300);
    if (i === 0) {
      await nuevaRequest().input("id", sql.Int, cuenta.id).input("s", sql.Decimal(12, 2), m.subtotal).input("i", sql.Decimal(12, 2), m.iva).input("t", sql.Decimal(12, 2), m.total).input("c", sql.NVarChar, concepto)
        .input("ri", sql.Decimal(12, 2), m.retencion_isr).input("rv", sql.Decimal(12, 2), m.retencion_iva)
        .query("UPDATE CuentaPorCobrar SET subtotal = @s, iva = @i, retencion_isr = @ri, retencion_iva = @rv, total = @t, concepto = @c WHERE id = @id");
    } else {
      nuevas.push(await insertarCuenta(nuevaRequest, {
        cliente_id: cuenta.cliente_id, cotizacion_id: cuenta.cotizacion_id, grupo_id: cuenta.grupo_id, origen: "Manual", estrategia: cuenta.estrategia,
        concepto, ...m, plazo_dias: cuenta.plazo_dias, orden_compra: cuenta.orden_compra, rfc_receptor: cuenta.rfc_receptor, estatus: "Por facturar",
      }));
    }
  }
  return { id: cuenta.id, nuevas };
}

// Ejecuta `fn` en una transacción; los errores `safe` (reglas de negocio) responden tal cual, el resto se registra y sale genérico.
async function enTransaccion(context, mensajeError, fn) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const cuerpo = await fn(() => new sql.Request(transaction));
    await transaction.commit();
    context.res = { status: 200, headers: require("./http").JSON_HEADERS, body: { ok: true, ...cuerpo } };
  } catch (err) {
    try { if (transaction) await transaction.rollback(); } catch (_) { /* ya cerrada */ }
    const { JSON_HEADERS } = require("./http");
    if (err.safe) { context.res = { status: err.status || 400, headers: JSON_HEADERS, body: { error: err.message } }; return; }
    context.log.error(mensajeError, err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: mensajeError } };
  }
}

// Lista las cuentas con pagos, saldo, vencimiento y semáforo ya calculados (el orden por defecto es "lo más urgente primero")
async function listarCuentas({ hoy = new Date(), umbralPorVencer = C.POR_VENCER_DEFAULT, clienteId = null } = {}) {
  const pool = await getPool();
  const req = pool.request();
  let where = "";
  if (clienteId) { where = "WHERE x.cliente_id = @cliente"; req.input("cliente", sql.Int, clienteId); }
  const cuentas = await req.query(`
    SELECT x.id, x.cliente_id, c.nombre AS cliente, c.codigo AS cliente_codigo, x.cotizacion_id, q.folio AS cotizacion_folio, x.grupo_id, x.origen, x.estrategia,
           x.concepto, x.subtotal, x.iva, x.retencion_isr, x.retencion_iva, x.total, x.folio_factura, x.uuid_factura, x.rfc_receptor, x.fecha_emision, x.orden_compra,
           x.inicio_plazo, x.plazo_dias, x.vencimiento, x.estatus, x.fecha_estatus, x.notas, x.fecha_creacion
    FROM CuentaPorCobrar x
    JOIN Cliente c ON c.id = x.cliente_id
    LEFT JOIN Cotizacion q ON q.id = x.cotizacion_id
    ${where}`);
  const pagos = await pool.request().query(
    "SELECT id, cuenta_id, fecha, monto, metodo, uuid_complemento, folio_complemento, notas, anulado, fecha_creacion FROM PagoCobranza ORDER BY COALESCE(fecha, CAST(fecha_creacion AS DATE)), id"
  );
  const porCuenta = new Map();
  for (const p of pagos.recordset) {
    if (!porCuenta.has(p.cuenta_id)) porCuenta.set(p.cuenta_id, []);
    porCuenta.get(p.cuenta_id).push({ ...p, fecha: dia(p.fecha), monto: Number(p.monto), anulado: !!p.anulado });
  }
  const filas = cuentas.recordset.map((x) => {
    const misPagos = porCuenta.get(x.id) || [];
    const venc = dia(x.vencimiento);
    const total = Number(x.total);
    const saldo = C.saldoDe(total, misPagos);
    const fila = { ...x, fecha_emision: dia(x.fecha_emision), inicio_plazo: dia(x.inicio_plazo), subtotal: Number(x.subtotal), iva: Number(x.iva), retencion_isr: Number(x.retencion_isr || 0), retencion_iva: Number(x.retencion_iva || 0), total, vencimiento: venc, pagos: misPagos, pagado: C.totalPagado(misPagos), saldo };
    fila.semaforo = C.semaforoDe({ estatus: x.estatus, saldo, vencimiento: venc }, hoy, umbralPorVencer);
    return fila;
  });
  filas.sort(C.compararUrgencia);
  return filas;
}

module.exports = { crearCuentaManual, crearCuentaDeCotizacion, crearCuentaDeGrupo, editarCuenta, cambiarEstatus, registrarPago, anularPago, dividirCuenta, recalcularEstatus, enTransaccion, listarCuentas };
