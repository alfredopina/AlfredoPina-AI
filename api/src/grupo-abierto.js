// api/src/grupo-abierto.js
// Cursos Abiertos — lado ADMIN del Grupo abierto (sql/048): validar lo que captura Alfredo, guardarlo (Grupo + GrupoSesion) y armar la FOTO pública a partir de SQL.
// Un Grupo abierto es un Grupo con estrategia 'abiertos' cuyo Cliente es el reservado ABIERTOS (tipo Prospecto: fuera de métricas y buscadores).
// Los estados visibles para el público (abierto, últimos lugares, lleno, próximamente, grupo confirmado) NO se guardan: los calcula la página.
// Diseño y por qué: docs/cursos-abiertos.md. Lo público nunca importa este módulo (usa SQL): ver api/test-regla-publico-sin-sql.js.
const { sql } = require("./backoffice-db");
const { HERRAMIENTAS } = require("./herramientas");

const NIVEL_TEXTO = { 1: "Básico", 2: "Intermedio", 3: "Avanzado" };
const MODALIDAD_SQL = { en_linea: "Online", presencial: "Presencial" }; // lo que ya acepta Grupo.modalidad
const MODALIDAD_PUBLICA = { Online: "en_linea", Presencial: "presencial" };
const PUBLICACIONES = ["borrador", "publicado", "cancelado"];
const AJUSTES_POR_OMISION = {
  zona_horaria: "America/Monterrey", moneda: "MXN", umbral_ultimos_lugares: 3, max_personas_por_inscripcion: 3, horas_vigencia_apartado: 48,
  descuento_equipo: null, temas_destacados: [], landing_por_herramienta: {}, instrucciones_pago: null,
};

const txt = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const falla = (m) => { const e = new Error(m); e.safe = true; return e; };
const entero = (v) => { const n = Number(v); return Number.isInteger(n) ? n : null; };
const dinero = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 1000000 ? Math.round(n * 100) / 100 : null; };

// Fecha local (Monterrey) en AAAA-MM-DD de un instante: para fecha_inicio/fecha_fin del Grupo.
function diaLocal(iso, zona = "America/Monterrey") {
  const p = {};
  new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso)).forEach((x) => { p[x.type] = x.value; });
  return p.year + "-" + p.month + "-" + p.day;
}

// Valida lo que manda el formulario de Grupos (interruptor «¿Curso abierto?»). Lanza Error con `safe` (mensaje apto para mostrar).
// herramienta/nivel/horas/nombre salen del Programa estándar elegido; aquí llegan ya resueltos por el formulario pero se revalidan.
function validarGrupoAbierto(body, ahora = new Date()) {
  const b = body || {};
  const codigo = txt(b.codigo, 20).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(codigo)) throw falla("El código del grupo debe tener de 3 a 20 letras, números o guiones (ej. IA-1207).");
  const herramienta = txt(b.herramienta, 30);
  if (!HERRAMIENTAS.includes(herramienta)) throw falla("Elige un Programa de una herramienta válida.");
  const nivel = entero(b.nivel);
  if (!NIVEL_TEXTO[nivel]) throw falla("El nivel no es válido.");
  const nombre = txt(b.programa_nombre, 160);
  if (!nombre) throw falla("Falta el programa.");
  const modalidad = txt(b.modalidad, 12);
  if (!MODALIDAD_SQL[modalidad]) throw falla("Elige la modalidad (en línea o presencial).");
  const sede = modalidad === "presencial" ? txt(b.sede, 160) : "";
  if (modalidad === "presencial" && !sede) throw falla("Indica la sede del curso presencial.");
  const horas = Number(b.horas);
  if (!(horas > 0 && horas <= 500)) throw falla("Las horas del programa no son válidas.");

  const sesiones = [];
  for (const s of Array.isArray(b.sesiones) ? b.sesiones : []) {
    const i = new Date(s && s.inicio), f = new Date(s && s.fin);
    if (!Number.isFinite(i.getTime()) || !Number.isFinite(f.getTime()) || f <= i) throw falla("Una sesión tiene fecha u hora inválida (el fin debe ser después del inicio).");
    sesiones.push({ inicio: i.toISOString(), fin: f.toISOString() });
  }
  if (sesiones.length > 40) throw falla("Máximo 40 sesiones.");
  sesiones.sort((a, c) => a.inicio.localeCompare(c.inicio));
  const mesEstimado = b.mes_estimado ? txt(b.mes_estimado, 7) : null;
  if (mesEstimado && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mesEstimado)) throw falla("El mes estimado debe ser AAAA-MM.");
  if (!sesiones.length && !mesEstimado && txt(b.publicacion, 12) === "publicado") throw falla("Para publicar sin sesiones indica al menos el mes estimado (saldrá como «Próximamente»).");

  const cupo = entero(b.cupo_total), minimo = entero(b.minimo_para_abrir);
  if (cupo === null || cupo < 1 || cupo > 500) throw falla("El cupo total debe ser de 1 a 500.");
  if (minimo === null || minimo < 1 || minimo > cupo) throw falla("El mínimo para abrir debe ser de 1 hasta el cupo total.");
  const precio = dinero(b.precio_persona);
  if (precio === null) throw falla("El precio por persona no es válido.");
  let preventa = null, preventaHasta = null;
  if (b.precio_preventa != null && b.precio_preventa !== "") {
    preventa = dinero(b.precio_preventa);
    preventaHasta = /^\d{4}-\d{2}-\d{2}$/.test(String(b.preventa_hasta || "")) ? String(b.preventa_hasta) : null;
    if (preventa === null || preventa >= precio) throw falla("El precio de preventa debe ser menor al precio normal.");
    if (!preventaHasta) throw falla("Indica hasta qué fecha vale la preventa.");
  }
  const publicacion = txt(b.publicacion, 12) || "borrador";
  if (!PUBLICACIONES.includes(publicacion)) throw falla("La publicación debe ser borrador, publicado o cancelado.");
  const temario = (Array.isArray(b.temario_corto) ? b.temario_corto : []).slice(0, 6).map((t) => txt(t, 140)).filter(Boolean);

  return {
    codigo, herramienta, nivel, nombre, modalidad, sede: sede || null, horas, sesiones, mesEstimado: sesiones.length ? null : mesEstimado,
    cupo, minimo, precio, preventa, preventaHasta, publicacion, programaId: txt(b.programa_id, 80) || null,
    resumen: txt(b.resumen, 300) || null, temario, instructor: txt(b.instructor, 150) || null, notas: txt(b.notas, 4000) || null,
  };
}

// Texto libre de Grupo.sesiones (la columna de siempre, para que Grupos lo muestre igual que un In Company)
function textoSesiones(sesiones) { return sesiones.length ? sesiones.length + (sesiones.length === 1 ? " sesión" : " sesiones") : null; }

async function idClienteAbiertos(exec) {
  const r = await exec().query("SELECT id FROM Cliente WHERE codigo = 'ABIERTOS'");
  if (!r.recordset.length) throw falla("Falta el cliente reservado ABIERTOS: corre sql/048_cursos_abiertos.sql.");
  return r.recordset[0].id;
}

// Guarda las sesiones de un grupo (borra las anteriores: solo se llama dentro de la transacción de crear/editar).
async function guardarSesiones(transaction, grupoId, sesiones) {
  await new sql.Request(transaction).input("g", sql.Int, grupoId).query("DELETE FROM GrupoSesion WHERE grupo_id = @g");
  let orden = 0;
  for (const s of sesiones) {
    await new sql.Request(transaction).input("g", sql.Int, grupoId).input("o", sql.Int, ++orden)
      .input("i", sql.DateTimeOffset, new Date(s.inicio)).input("f", sql.DateTimeOffset, new Date(s.fin))
      .query("INSERT INTO GrupoSesion (grupo_id, orden, inicio, fin) VALUES (@g, @o, @i, @f)");
  }
}

// Columnas que comparten el INSERT y el UPDATE del Grupo abierto
function ligarParametros(request, d) {
  const inicio = d.sesiones.length ? diaLocal(d.sesiones[0].inicio) : null;
  const fin = d.sesiones.length ? diaLocal(d.sesiones[d.sesiones.length - 1].fin) : null;
  return request
    .input("codigo", sql.NVarChar, d.codigo)
    .input("herramientas", sql.NVarChar, JSON.stringify([d.herramienta]))
    .input("niveles", sql.NVarChar, JSON.stringify([d.nivel]))
    .input("nombre", sql.NVarChar, d.nombre)
    .input("modalidad", sql.NVarChar, MODALIDAD_SQL[d.modalidad])
    .input("sede", sql.NVarChar, d.sede)
    .input("horas", sql.Decimal(6, 1), d.horas)
    .input("sesionesTxt", sql.NVarChar, textoSesiones(d.sesiones))
    .input("fechaInicio", sql.Date, inicio ? new Date(inicio) : null)
    .input("fechaFin", sql.Date, fin ? new Date(fin) : null)
    .input("instructor", sql.NVarChar, d.instructor)
    .input("notas", sql.NVarChar, d.notas)
    .input("programaId", sql.NVarChar, d.programaId)
    .input("cupo", sql.Int, d.cupo)
    .input("minimo", sql.Int, d.minimo)
    .input("precio", sql.Decimal(10, 2), d.precio)
    .input("preventa", sql.Decimal(10, 2), d.preventa)
    .input("preventaHasta", sql.Date, d.preventaHasta ? new Date(d.preventaHasta) : null)
    .input("publicacion", sql.NVarChar, d.publicacion)
    .input("mesEstimado", sql.NVarChar, d.mesEstimado)
    .input("resumen", sql.NVarChar, d.resumen)
    .input("temario", sql.NVarChar, JSON.stringify(d.temario));
}

const INSERT_GRUPO = `INSERT INTO Grupo
    (cliente_id, modalidad, grupo_codigo, herramientas, nombre_curso, niveles, horas, sesiones, fecha_inicio, fecha_fin, instructor, estatus_curso, notas,
     estrategia, programa_id, cupo_total, minimo_para_abrir, precio_persona, precio_preventa, preventa_hasta, sede, publicacion, mes_estimado, resumen_publico, temario_corto)
  OUTPUT INSERTED.id
  VALUES
    (@clienteId, @modalidad, @codigo, @herramientas, @nombre, @niveles, @horas, @sesionesTxt, @fechaInicio, @fechaFin, @instructor, 'Por iniciar', @notas,
     'abiertos', @programaId, @cupo, @minimo, @precio, @preventa, @preventaHasta, @sede, @publicacion, @mesEstimado, @resumen, @temario)`;

const UPDATE_GRUPO = `UPDATE Grupo SET modalidad = @modalidad, grupo_codigo = @codigo, herramientas = @herramientas, nombre_curso = @nombre, niveles = @niveles, horas = @horas,
    sesiones = @sesionesTxt, fecha_inicio = @fechaInicio, fecha_fin = @fechaFin, instructor = @instructor, notas = @notas, programa_id = @programaId,
    cupo_total = @cupo, minimo_para_abrir = @minimo, precio_persona = @precio, precio_preventa = @preventa, preventa_hasta = @preventaHasta, sede = @sede,
    publicacion = @publicacion, mes_estimado = @mesEstimado, resumen_publico = @resumen, temario_corto = @temario,
    -- un grupo publicado al que se le toca algo vuelve a «cambios sin publicar»; uno que deja de estar publicado conserva su fecha (sigue en la foto hasta publicar)
    publicado_en = CASE WHEN @publicacion = 'publicado' THEN NULL ELSE publicado_en END
  WHERE id = @id AND estrategia = 'abiertos'`;

// ── la FOTO pública a partir de SQL ──
// `grupos`: filas de Grupo abierto publicado con sus conteos; `sesiones`: filas { grupo_id, inicio, fin }; `ajustes`: los de la foto anterior o los de omisión.
// Devuelve la foto CRUDA (la limpia y valida api/src/calendario-abiertos.js al guardarla).
function armarFoto(grupos, sesiones, ajustes, { ejemplo = false, ahora = new Date() } = {}) {
  const porGrupo = new Map();
  sesiones.forEach((s) => { const l = porGrupo.get(s.grupo_id) || []; l.push({ inicio: new Date(s.inicio).toISOString(), fin: new Date(s.fin).toISOString() }); porGrupo.set(s.grupo_id, l); });
  const salida = [];
  for (const g of grupos) {
    const ses = (porGrupo.get(g.id) || []).sort((a, b) => a.inicio.localeCompare(b.inicio));
    if (ses.length && new Date(ses[0].inicio) <= ahora) continue; // ya empezó: sale de la foto (la página tampoco lo mostraría)
    let temario = [];
    try { temario = JSON.parse(g.temario_corto || "[]"); } catch (_) { temario = []; }
    let herr = ""; try { herr = JSON.parse(g.herramientas || "[]")[0]; } catch (_) { herr = ""; }
    let niv = 1; try { niv = JSON.parse(g.niveles || "[1]")[0]; } catch (_) { niv = 1; }
    salida.push({
      codigo: g.grupo_codigo, programa_id: g.programa_id || "", programa_nombre: g.nombre_curso, herramienta: herr, nivel: NIVEL_TEXTO[niv] || "Básico",
      modalidad: MODALIDAD_PUBLICA[g.modalidad] || "en_linea", sede: g.sede || null, horas_totales: Number(g.horas), sesiones: ses, mes_estimado: g.mes_estimado || null,
      precio_persona: Number(g.precio_persona), precio_preventa: g.precio_preventa == null ? null : Number(g.precio_preventa), preventa_hasta: g.preventa_hasta || null,
      cupo_total: g.cupo_total, inscritos_confirmados: Number(g.confirmadas) || 0, apartados_sin_pago: Number(g.apartadas) || 0, minimo_para_abrir: g.minimo_para_abrir,
      publicacion: "publicado", resumen: g.resumen_publico || "", temario_corto: temario,
    });
  }
  return { ejemplo: !!ejemplo, generado: ahora.toISOString(), ajustes: { ...AJUSTES_POR_OMISION, ...(ajustes || {}) }, grupos: salida };
}

// Lugares que ya ocupan los envíos del sitio que todavía NO se importan (están en la cola): { CODIGO: lugares }
function lugaresEnCola(filas) {
  const m = {};
  filas.forEach((f) => { if (f.grupo) m[f.grupo] = (m[f.grupo] || 0) + (Number(f.lugares) || 0); });
  return m;
}

module.exports = {
  NIVEL_TEXTO, MODALIDAD_SQL, AJUSTES_POR_OMISION, validarGrupoAbierto, diaLocal, idClienteAbiertos, guardarSesiones, ligarParametros,
  INSERT_GRUPO, UPDATE_GRUPO, armarFoto, lugaresEnCola,
};
