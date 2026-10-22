// Lógica pura de Cobranza (sin SQL, sin red): IVA, saldo, estatus derivado, vencimiento y semáforo. Una sola fuente de verdad para
// las Functions de cobranza y para las alertas. Montos en pesos con 2 decimales (siempre se redondea a centavos).
const IVA_TASA = 0.16;
const ESTRATEGIAS = ["empresas", "abiertos"];
const ESTATUS = ["Por facturar", "Facturada", "Parcial", "Pagada", "Cancelada"];
const ESTATUS_MANUALES = ["Por facturar", "Facturada", "Cancelada"]; // Parcial/Pagada solo salen de los pagos
const METODOS = ["Transferencia", "Cheque", "Efectivo", "Tarjeta", "Otro"];
const PLAZO_DEFAULT = 30;
const POR_VENCER_DEFAULT = 7;
const DIA_MS = 24 * 3600 * 1000;

const falla = (mensaje, status = 400) => Object.assign(new Error(mensaje), { status, safe: true });
const centavos = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// la Cotización va antes de impuestos: precio_final = subtotal; IVA 16 % aparte
function desglosarDesdeSubtotal(subtotal, tasa = IVA_TASA) {
  const s = centavos(subtotal);
  const iva = centavos(s * tasa);
  return { subtotal: s, iva, total: centavos(s + iva) };
}

// Persona física con actividad empresarial: el cliente puede RETENER ISR y/o IVA, y entonces lo que pagan es MENOS que subtotal + IVA.
// total = lo que realmente se cobra = subtotal + IVA − retención de ISR − retención de IVA (es el "Total" del CFDI).
// Captura manual: subtotal (IVA calculado al 16 % si no se da) con sus retenciones opcionales, o solo el total ya neto
// (histórico: el subtotal sale al revés sin retenciones, porque no se pueden adivinar).
function desglosarMonto({ subtotal, iva, total, retencion_isr, retencion_iva }) {
  const vacio = (v) => v == null || v === "";
  const num = (v) => (vacio(v) ? null : Number(v));
  const t = num(total), s = num(subtotal), i = num(iva), ri = num(retencion_isr), rv = num(retencion_iva);
  for (const v of [t, s, i, ri, rv]) if (v != null && (!Number.isFinite(v) || v < 0)) throw falla("Los montos deben ser números de cero en adelante.");
  if (s != null) {
    const base = i != null ? { subtotal: centavos(s), iva: centavos(i) } : desglosarDesdeSubtotal(s);
    const isr = centavos(ri || 0), rviva = centavos(rv || 0);
    const neto = centavos(base.subtotal + base.iva - isr - rviva);
    if (neto < 0) throw falla("Las retenciones no pueden ser mayores que el subtotal más el IVA.");
    return { subtotal: base.subtotal, iva: base.iva, retencion_isr: isr, retencion_iva: rviva, total: neto };
  }
  if (t != null) {
    const sub = centavos(t / (1 + IVA_TASA));
    return { subtotal: sub, iva: centavos(t - sub), retencion_isr: 0, retencion_iva: 0, total: centavos(t) };
  }
  throw falla("Falta el monto (subtotal o total).");
}

// "YYYY-MM-DD" o Date → medianoche UTC de ese día (null si no es fecha)
function aFecha(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v) ? null : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}
const diasEntre = (a, b) => { const x = aFecha(a), y = aFecha(b); return x && y ? Math.round((y - x) / DIA_MS) : null; };

function vencimientoDe(inicioPlazo, plazoDias) {
  const f = aFecha(inicioPlazo);
  if (!f) return null;
  return new Date(f.getTime() + Number(plazoDias == null ? PLAZO_DEFAULT : plazoDias) * DIA_MS).toISOString().slice(0, 10);
}

const totalPagado = (pagos) => centavos((pagos || []).filter((p) => !p.anulado).reduce((a, p) => a + Number(p.monto || 0), 0));
const saldoDe = (total, pagos) => centavos(Number(total) - totalPagado(pagos));

// Cancelada manda; con pagos pasa a Parcial/Pagada; sin pagos vuelve a Facturada (si ya estaba facturada) o a Por facturar.
function estatusDerivado({ estatusActual, total, pagos, tieneFactura }) {
  if (estatusActual === "Cancelada") return "Cancelada";
  const pagado = totalPagado(pagos);
  if (pagado > 0) return pagado >= centavos(total) ? "Pagada" : "Parcial";
  return tieneFactura || estatusActual === "Facturada" || estatusActual === "Parcial" || estatusActual === "Pagada" ? "Facturada" : "Por facturar";
}

function validarPago({ total, pagos, estatus }, { monto, fecha, metodo }) {
  const m = Number(monto);
  if (!Number.isFinite(m) || m <= 0) throw falla("El monto del pago debe ser mayor a cero.");
  if (estatus === "Cancelada") throw falla("Esa cuenta está cancelada: reábrela antes de registrar un pago.", 409);
  if (estatus === "Por facturar") throw falla("Primero marca la cuenta como Facturada (con su folio) antes de registrar un pago.", 409);
  const saldo = saldoDe(total, pagos);
  if (centavos(m) > saldo) throw falla(`El pago excede el saldo (queda por cobrar ${saldo.toFixed(2)}).`, 409);
  if (fecha != null && fecha !== "" && !aFecha(fecha)) throw falla("La fecha del pago debe verse como 2026-10-22.");
  if (metodo && !METODOS.includes(metodo)) throw falla("Método de pago no válido.");
  return centavos(m);
}

// División en parcialidades: la 1ª parte se queda en la cuenta original. Solo sin pagos y sin cancelar; la suma debe ser exacta.
function validarDivision({ total, estatus, pagos }, partes) {
  if (estatus === "Cancelada" || estatus === "Pagada" || estatus === "Parcial" || totalPagado(pagos) > 0) throw falla("Solo se divide una cuenta sin pagos y no cancelada.", 409);
  if (!Array.isArray(partes) || partes.length < 2 || partes.length > 12) throw falla("Indica de 2 a 12 partes.");
  const montos = partes.map((p) => centavos(p && p.total));
  if (montos.some((m) => !Number.isFinite(m) || m <= 0)) throw falla("Cada parte debe tener un total mayor a cero.");
  if (centavos(montos.reduce((a, b) => a + b, 0)) !== centavos(total)) throw falla(`Las partes deben sumar exactamente ${centavos(total).toFixed(2)}.`);
  return partes.map((p, i) => ({ total: montos[i], concepto: String(p.concepto || "").trim().slice(0, 300) || null }));
}

// Condición del semáforo (el front la pinta SIEMPRE con ícono + texto + posición). Pagada/Cancelada/sin saldo → "cerrada".
// vencida: ya pasó el vencimiento · por_vencer: faltan ≤ umbral días · al_corriente · sin_plazo: aún sin inicio de plazo
function semaforoDe({ estatus, saldo, vencimiento }, hoy = new Date(), umbralPorVencer = POR_VENCER_DEFAULT) {
  if (estatus === "Cancelada" || estatus === "Pagada" || !(saldo > 0)) return { clave: "cerrada", dias: null };
  const faltan = diasEntre(hoy, vencimiento);
  if (faltan == null) return { clave: "sin_plazo", dias: null };
  if (faltan < 0) return { clave: "vencida", dias: -faltan };
  if (faltan <= umbralPorVencer) return { clave: "por_vencer", dias: faltan };
  return { clave: "al_corriente", dias: faltan };
}

// "Lo más urgente primero": vencidas (más días arriba) → por vencer (menos días) → sin plazo → al corriente → cerradas
const RANGO = { vencida: 0, por_vencer: 1, sin_plazo: 2, al_corriente: 3, cerrada: 4 };
function compararUrgencia(a, b) {
  const ra = RANGO[a.semaforo.clave], rb = RANGO[b.semaforo.clave];
  if (ra !== rb) return ra - rb;
  if (a.semaforo.clave === "vencida") return b.semaforo.dias - a.semaforo.dias;
  if (a.semaforo.clave === "por_vencer" || a.semaforo.clave === "al_corriente") return a.semaforo.dias - b.semaforo.dias;
  return 0;
}

// Tarjetas del Tracking. Estado VIVO (no se filtra por "contar desde/hasta"): por cobrar, vencido, por facturar y conteos.
// ACUMULADO (respeta el rango): cobrado = pagos vigentes por su fecha de pago; días promedio = emisión → último pago, solo cuentas
// Pagadas con ambas fechas. Un pago "sin fecha" (histórico) cuenta como cobrado solo cuando NO hay rango, y nunca entra al promedio.
function resumir(filas, { desde = null, hasta = null } = {}) {
  const d = desde ? Date.parse(desde) : null, h = hasta ? Date.parse(hasta) : null;
  const enRango = (fecha) => {
    if (!fecha) return d == null && h == null;
    const t = aFecha(fecha).getTime() + 6 * 3600 * 1000; // el día de la fecha empieza a las 00:00 de Monterrey (UTC-6), como el rango
    return (d == null || t >= d) && (h == null || t < h);
  };
  const r = { por_cobrar: 0, por_cobrar_n: 0, vencido: 0, vencido_n: 0, por_vencer: 0, por_vencer_n: 0, por_facturar: 0, por_facturar_n: 0, cobrado: 0, cobrado_n: 0, dias_promedio: null };
  const dias = [];
  for (const f of filas) {
    if (f.estatus === "Cancelada") continue;
    if (f.estatus === "Por facturar") { r.por_facturar += f.total; r.por_facturar_n++; continue; }
    if (f.saldo > 0) {
      r.por_cobrar += f.saldo; r.por_cobrar_n++;
      if (f.semaforo.clave === "vencida") { r.vencido += f.saldo; r.vencido_n++; }
      if (f.semaforo.clave === "por_vencer") { r.por_vencer += f.saldo; r.por_vencer_n++; }
    }
    const vigentes = (f.pagos || []).filter((p) => !p.anulado);
    for (const p of vigentes) if (enRango(p.fecha)) { r.cobrado += Number(p.monto); r.cobrado_n++; }
    if (f.estatus === "Pagada" && f.fecha_emision) {
      const fechas = vigentes.map((p) => p.fecha).filter(Boolean).sort();
      const ultimo = fechas.length === vigentes.length ? fechas[fechas.length - 1] : null; // un pago sin fecha impide calcular
      if (ultimo && enRango(ultimo)) { const n = diasEntre(f.fecha_emision, ultimo); if (n != null && n >= 0) dias.push(n); }
    }
  }
  for (const k of ["por_cobrar", "vencido", "por_vencer", "por_facturar", "cobrado"]) r[k] = centavos(r[k]);
  if (dias.length) r.dias_promedio = Math.round((dias.reduce((a, b) => a + b, 0) / dias.length) * 10) / 10;
  return r;
}

module.exports = {
  resumir,
  IVA_TASA, ESTRATEGIAS, ESTATUS, ESTATUS_MANUALES, METODOS, PLAZO_DEFAULT, POR_VENCER_DEFAULT,
  falla, centavos, desglosarDesdeSubtotal, desglosarMonto, aFecha, diasEntre, vencimientoDe,
  totalPagado, saldoDe, estatusDerivado, validarPago, validarDivision, semaforoDe, compararUrgencia,
};
