// api/src/calendario-abiertos.js
// Cursos Abiertos — la FOTO pública del calendario y el contador de lugares. Todo en Table Storage (tabla CalendarioAbiertos), NUNCA SQL
// (regla: lo público no despierta la base). Diseño completo: docs/cursos-abiertos.md.
//
// · La FOTO (PartitionKey "calendario", RowKey "actual") la publica el admin ("Publicar calendario") y la lee el sitio. Solo lleva grupos PUBLICADOS
//   y ningún dato de personas; `limpiarFoto` deja pasar únicamente los campos conocidos (lista blanca), así un descuido del admin no filtra nada.
// · El CONTADOR de lugares (PartitionKey "cupo", RowKey = código del grupo) guarda `cupoTotal` y `reservados` (confirmados + apartados + envíos aún
//   sin importar). Cada reserva pública lo actualiza con ETag (If-Match) y reintenta si hubo choque: así dos personas no se llevan el último lugar.
//   El admin lo concilia al publicar (SQL manda).
// · Los estados visibles (abierto, últimos lugares, lleno, próximamente) NO se guardan: los calcula la página con cupo, reservados y fechas.
const { TableClient } = require("@azure/data-tables");
const { ensureTable } = require("./diagnostico-tables");
const { HERRAMIENTAS } = require("./herramientas");

const TABLA = "CalendarioAbiertos";
const PART_FOTO = "calendario";
const FILA_FOTO = "actual";
const PART_CUPO = "cupo";
const MAX_JSON = 30000; // una propiedad de Table Storage admite 32 K caracteres
const MAX_GRUPOS = 40;
const MAX_REINTENTOS_CUPO = 6;
const MODALIDADES = ["en_linea", "presencial"];
const NIVELES = ["Básico", "Intermedio", "Avanzado"];

const notFound = (err) => err && err.statusCode === 404;

function getTable() {
  const conn = process.env.RECURSOS_STORAGE_CONNECTION;
  if (!conn) throw new Error("RECURSOS_STORAGE_CONNECTION no está configurada.");
  return TableClient.fromConnectionString(conn, TABLA);
}

let lista = false;
async function asegurar(table) {
  if (lista) return;
  await ensureTable(table);
  lista = true;
}
function _reiniciar() { lista = false; }

// ── validación de la foto (lista blanca) ──
const txt = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const ent = (v, min = 0, max = 100000) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
const fechaIso = (v) => { const t = new Date(v); return Number.isFinite(t.getTime()) ? t.toISOString() : null; };
const diaIso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
const mesIso = (v) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || "")) ? String(v) : null);
const codigoOk = (v) => /^[A-Z0-9][A-Z0-9-]{2,19}$/.test(String(v || ""));

// → { grupos:[...limpios], errores:[...] } ; un grupo con error se descarta y se reporta (nunca se publica a medias)
function limpiarGrupo(g) {
  const e = [];
  const codigo = String(g && g.codigo || "").toUpperCase();
  if (!codigoOk(codigo)) e.push("código inválido");
  const herramienta = String(g && g.herramienta || "");
  if (!HERRAMIENTAS.includes(herramienta)) e.push("herramienta inválida");
  // uno o varios niveles unidos con « · » (p. ej. «Intermedio · Avanzado»)
  const partesNivel = String(g && g.nivel || "").split(" · ");
  const nivel = partesNivel.join(" · ");
  if (partesNivel.some((p) => !NIVELES.includes(p)) || new Set(partesNivel).size !== partesNivel.length) e.push("nivel inválido");
  const modalidad = String(g && g.modalidad || "");
  if (!MODALIDADES.includes(modalidad)) e.push("modalidad inválida");
  const nombre = txt(g && g.programa_nombre, 160);
  if (!nombre) e.push("falta el nombre del programa");
  const cupo = ent(g && g.cupo_total, 1, 500), minimo = ent(g && g.minimo_para_abrir, 1, 500);
  if (cupo === null) e.push("cupo inválido");
  if (minimo === null) e.push("mínimo inválido");
  const precio = ent(g && g.precio_persona, 0, 1000000);
  if (precio === null) e.push("precio inválido");
  const horas = Number(g && g.horas_totales);
  if (!(horas > 0 && horas <= 500)) e.push("horas inválidas");
  const sesiones = [];
  for (const s of (Array.isArray(g && g.sesiones) ? g.sesiones : [])) {
    const i = fechaIso(s && s.inicio), f = fechaIso(s && s.fin);
    if (!i || !f || new Date(f) <= new Date(i)) { e.push("sesión inválida"); break; }
    sesiones.push({ inicio: i, fin: f });
  }
  if (sesiones.length > 40) e.push("demasiadas sesiones");
  const mesEstimado = g && g.mes_estimado ? mesIso(g.mes_estimado) : null;
  if (g && g.mes_estimado && !mesEstimado) e.push("mes estimado inválido");
  let preventa = null, preventaHasta = null;
  if (g && g.precio_preventa != null) {
    preventa = ent(g.precio_preventa, 0, 1000000); preventaHasta = diaIso(g.preventa_hasta);
    if (preventa === null || !preventaHasta) e.push("preventa inválida (precio y fecha límite)");
    else if (preventa >= precio) e.push("la preventa debe ser menor al precio");
  }
  const confirmados = ent(g && g.inscritos_confirmados, 0, 500), apartados = ent(g && g.apartados_sin_pago, 0, 500);
  if (confirmados === null || apartados === null) e.push("inscritos o apartados inválidos");
  const publicacion = String(g && g.publicacion || "");
  if (publicacion !== "publicado") e.push("solo se publican grupos con publicación «publicado»");
  if (e.length) return { error: (codigo || "(sin código)") + ": " + e.join(", ") };
  return {
    grupo: {
      codigo, programa_id: txt(g.programa_id, 80), programa_nombre: nombre, herramienta, nivel, modalidad,
      sede: modalidad === "presencial" ? txt(g.sede, 160) || null : null,
      horas_totales: horas, sesiones, mes_estimado: sesiones.length ? null : mesEstimado,
      precio_persona: precio, precio_preventa: preventa, preventa_hasta: preventaHasta,
      cupo_total: cupo, inscritos_confirmados: confirmados, apartados_sin_pago: apartados, minimo_para_abrir: minimo,
      publicacion, resumen: txt(g.resumen, 300),
      temario_corto: (Array.isArray(g.temario_corto) ? g.temario_corto : []).slice(0, 6).map((t) => txt(t, 140)).filter(Boolean),
    },
  };
}

// Datos de transferencia que ve quien se inscribe (los captura Alfredo en el admin; sin ellos la página dice que se envían por correo).
function instruccionesPago(ip) {
  if (!ip || !/^\d{18}$/.test(String(ip.clabe || ""))) return null;
  return { banco: txt(ip.banco, 80), clabe: String(ip.clabe), beneficiario: txt(ip.beneficiario, 120) };
}

function limpiarFoto(foto) {
  const errores = [];
  const grupos = [];
  const lista = Array.isArray(foto && foto.grupos) ? foto.grupos : [];
  if (lista.length > MAX_GRUPOS) errores.push("máximo " + MAX_GRUPOS + " grupos");
  const vistos = new Set();
  for (const g of lista.slice(0, MAX_GRUPOS)) {
    const r = limpiarGrupo(g);
    if (r.error) { errores.push(r.error); continue; }
    if (vistos.has(r.grupo.codigo)) { errores.push(r.grupo.codigo + ": código repetido"); continue; }
    vistos.add(r.grupo.codigo);
    grupos.push(r.grupo);
  }
  const aj = (foto && foto.ajustes) || {};
  const desc = aj.descuento_equipo || null;
  const landing = {};
  Object.keys(aj.landing_por_herramienta || {}).forEach((k) => {
    const u = aj.landing_por_herramienta[k];
    if (HERRAMIENTAS.includes(k) && typeof u === "string" && u.startsWith("/") && !u.startsWith("//") && !u.includes("\\")) landing[k] = u.slice(0, 120);
  });
  return {
    errores,
    foto: {
      version: 1,
      ejemplo: !!(foto && foto.ejemplo), // true = datos de prueba: la página los marca como «Ejemplo»
      generado: fechaIso(foto && foto.generado) || new Date().toISOString(),
      ajustes: {
        zona_horaria: txt(aj.zona_horaria, 60) || "America/Monterrey",
        moneda: "MXN",
        umbral_ultimos_lugares: ent(aj.umbral_ultimos_lugares, 0, 50) ?? 3,
        max_personas_por_inscripcion: ent(aj.max_personas_por_inscripcion, 1, 10) ?? 3,
        horas_vigencia_apartado: ent(aj.horas_vigencia_apartado, 1, 720) ?? 48,
        descuento_equipo: desc && ent(desc.desde_personas, 2, 50) !== null && Number(desc.porcentaje) > 0 && Number(desc.porcentaje) < 100
          ? { desde_personas: ent(desc.desde_personas, 2, 50), porcentaje: Number(desc.porcentaje) } : null,
        temas_destacados: (Array.isArray(aj.temas_destacados) ? aj.temas_destacados : []).filter((h) => HERRAMIENTAS.includes(h)),
        landing_por_herramienta: landing,
        instrucciones_pago: instruccionesPago(aj.instrucciones_pago),
      },
      grupos,
    },
  };
}

// ── persistencia ──
// Publica la foto. `reconciliar` (opcional, { CODIGO: reservados }) lo manda el admin con lo que dice SQL; sin él, un grupo NUEVO arranca
// con confirmados + apartados y uno que ya existía conserva su contador (para no pisar reservas públicas recientes).
async function guardarFoto(table, fotoCruda, { reconciliar = {}, ahora = new Date() } = {}) {
  const { foto, errores } = limpiarFoto(fotoCruda);
  if (errores.length) { const err = new Error("La foto tiene errores: " + errores.join("; ")); err.safe = true; err.errores = errores; throw err; }
  const json = JSON.stringify(foto);
  if (json.length > MAX_JSON) { const err = new Error("La foto es demasiado grande."); err.safe = true; throw err; }
  await asegurar(table);
  for (const g of foto.grupos) {
    const previo = await leerCupo(table, g.codigo);
    const reservados = Number.isInteger(reconciliar[g.codigo]) ? reconciliar[g.codigo] : previo ? previo.reservados : g.inscritos_confirmados + g.apartados_sin_pago;
    await table.upsertEntity({ partitionKey: PART_CUPO, rowKey: g.codigo, cupoTotal: g.cupo_total, reservados: Math.min(reservados, g.cupo_total) }, "Replace");
  }
  await table.upsertEntity({ partitionKey: PART_FOTO, rowKey: FILA_FOTO, datos: json, publicadoEn: ahora.toISOString() }, "Replace");
  return { grupos: foto.grupos.length, publicadoEn: ahora.toISOString() };
}

async function leerCupo(table, codigo) {
  try {
    const e = await table.getEntity(PART_CUPO, codigo);
    return { cupoTotal: Number(e.cupoTotal) || 0, reservados: Number(e.reservados) || 0, etag: e.etag };
  } catch (err) { if (notFound(err)) return null; throw err; }
}

// → { foto, publicadoEn } | null. `reservados` de cada grupo sale del contador vivo (lo que se ve en el sitio es lo más fresco).
async function leerFoto(table) {
  let e;
  try { await asegurar(table); e = await table.getEntity(PART_FOTO, FILA_FOTO); } catch (err) { if (notFound(err)) return null; throw err; }
  const foto = JSON.parse(e.datos);
  for (const g of foto.grupos) {
    const c = await leerCupo(table, g.codigo);
    g.reservados = c ? c.reservados : g.inscritos_confirmados + g.apartados_sin_pago;
  }
  return { foto, publicadoEn: e.publicadoEn };
}

// Reserva `n` lugares de forma atómica. → { ok:true, libres } | { ok:false, libres, motivo:"lleno" | "no_existe" }
async function reservarLugares(table, codigo, n) {
  await asegurar(table);
  for (let i = 0; i < MAX_REINTENTOS_CUPO; i++) {
    const c = await leerCupo(table, codigo);
    if (!c) return { ok: false, libres: 0, motivo: "no_existe" };
    const libres = c.cupoTotal - c.reservados;
    if (libres < n) return { ok: false, libres: Math.max(0, libres), motivo: "lleno" };
    try {
      await table.updateEntity({ partitionKey: PART_CUPO, rowKey: codigo, reservados: c.reservados + n }, "Merge", { etag: c.etag });
      return { ok: true, libres: libres - n };
    } catch (err) {
      if (err.statusCode !== 412) throw err; // 412 = otro visitante lo cambió primero: se vuelve a leer
    }
  }
  const err = new Error("No se pudo reservar el lugar (mucha concurrencia).");
  err.statusCode = 503;
  throw err;
}

// Devuelve lugares (reintento duplicado o fallo al guardar en la cola). Nunca baja de 0. Nunca lanza.
async function liberarLugares(table, codigo, n) {
  try {
    for (let i = 0; i < MAX_REINTENTOS_CUPO; i++) {
      const c = await leerCupo(table, codigo);
      if (!c) return;
      try { await table.updateEntity({ partitionKey: PART_CUPO, rowKey: codigo, reservados: Math.max(0, c.reservados - n) }, "Merge", { etag: c.etag }); return; }
      catch (err) { if (err.statusCode !== 412) return; }
    }
  } catch (_) { /* el admin concilia el contador al publicar */ }
}

// ── precios (los calcula el servidor; el cliente no manda montos) ──
function precioVigente(g, ahora = new Date()) {
  const vence = g.preventa_hasta ? new Date(g.preventa_hasta + "T23:59:59-06:00") : null;
  return g.precio_preventa != null && vence && vence >= ahora ? g.precio_preventa : g.precio_persona;
}
function totalesInscripcion(g, n, paga, ajustes, ahora = new Date()) {
  const d = ajustes && ajustes.descuento_equipo;
  const pct = paga === "empresa" && d && n >= d.desde_personas ? d.porcentaje : 0;
  const bruto = precioVigente(g, ahora) * n;
  const desc = Math.round((bruto * pct) / 100);
  return { precio_unitario: precioVigente(g, ahora), descuento_pct: pct, total: bruto - desc, moneda: "MXN" };
}
// ¿se puede reservar? (tiene fechas, no empezó, publicado)
function esReservable(g, ahora = new Date()) {
  return g.publicacion === "publicado" && g.sesiones.length > 0 && new Date(g.sesiones[0].inicio) > ahora;
}

module.exports = {
  TABLA, getTable, limpiarFoto, guardarFoto, leerFoto, leerCupo, reservarLugares, liberarLugares,
  precioVigente, totalesInscripcion, esReservable, _reiniciar,
};
