// test-cursos-abiertos.js — Cursos Abiertos, lado PÚBLICO (2026-11-02): la foto del calendario, el contador atómico de lugares, la inscripción y la lista de espera.
// Sin red: Table Storage en memoria (con ETag y 412 como el real). Cubre: lista blanca de la foto (nunca se cuela un dato de personas ni un grupo a medias),
// publicar/leer con el contador vivo, reserva atómica bajo carrera (nunca se vende de más), liberar, y las tres Functions públicas
// (validaciones, honeypot, tiempo mínimo, idempotencia, montos calculados por el servidor, lleno, falla de la cola) — y que NINGUNA toca SQL.
const Module = require("module");
const assert = require("assert");
const fs = require("fs");

const tablas = {};
let etag = 0;
const fallas = { cola: 0 };
function fakeTable(nombre) {
  const m = tablas[nombre] || (tablas[nombre] = new Map());
  const k = (p, r) => p + "|" + r;
  const err = (c) => { const e = new Error("estado " + c); e.statusCode = c; return e; };
  return {
    createTable: async () => {},
    getEntity: async (p, r) => { const e = m.get(k(p, r)); if (!e) throw err(404); return { ...e }; },
    createEntity: async (e) => {
      if (nombre === "InscripcionesAbiertasPendientes" && fallas.cola > 0) { fallas.cola--; throw err(500); }
      if (m.has(k(e.partitionKey, e.rowKey))) throw err(409);
      m.set(k(e.partitionKey, e.rowKey), { ...e, etag: String(++etag) });
    },
    updateEntity: async (e, modo, opts) => {
      const cur = m.get(k(e.partitionKey, e.rowKey)); if (!cur) throw err(404);
      if (opts && opts.etag && opts.etag !== cur.etag) throw err(412);
      m.set(k(e.partitionKey, e.rowKey), { ...cur, ...e, etag: String(++etag) });
    },
    upsertEntity: async (e, modo) => { const cur = m.get(k(e.partitionKey, e.rowKey)); m.set(k(e.partitionKey, e.rowKey), { ...(modo === "Merge" ? cur : {}), ...e, etag: String(++etag) }); },
    deleteEntity: async (p, r) => { if (!m.delete(k(p, r))) throw err(404); },
    listEntities: (o) => {
      const f = o && o.queryOptions && o.queryOptions.filter; const mm = f && /PartitionKey eq '([^']+)'/.exec(f);
      return (async function* () { for (const e of [...m.values()]) if (!mm || e.partitionKey === mm[1]) yield { ...e }; })();
    },
  };
}
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: (_c, nombre) => fakeTable(nombre) } };
  return origLoad.call(this, req, ...a);
};
process.env.RECURSOS_STORAGE_CONNECTION = "x";

const cal = require("./src/calendario-abiertos");
const antispam = require("./src/antispam-solicitud");
const getCal = require("./getCalendarioAbiertos");
const reservar = require("./reservarCursoAbierto");
const avisar = require("./avisarCursoAbierto");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const ctx = () => ({ log: { error() {}, warn() {} }, res: null });
const llamar = async (fn, req) => { const c = ctx(); await fn(c, req || {}); return c.res; };
const filas = (t) => (tablas[t] ? [...tablas[t].values()].filter((e) => e.partitionKey === "pend") : []);
const cupo = (c) => tablas.CalendarioAbiertos.get("cupo|" + c);

const DIA = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const ses = (dias, h = 18) => { const i = Date.now() + dias * DIA; return { inicio: iso(i), fin: iso(i + 3 * 3600 * 1000) }; };
const dia = (dias) => iso(Date.now() + dias * DIA).slice(0, 10);
const grupo = (extra = {}) => ({
  codigo: "IA-TEST", programa_id: "p1", programa_nombre: "IA aplicada", herramienta: "ia", nivel: "Básico", modalidad: "en_linea", horas_totales: 12,
  sesiones: [ses(40), ses(42)], precio_persona: 3000, precio_preventa: 2500, preventa_hasta: dia(20), cupo_total: 5, inscritos_confirmados: 1, apartados_sin_pago: 0,
  minimo_para_abrir: 3, publicacion: "publicado", resumen: "r", temario_corto: ["a", "b"], ...extra,
});
const fotoBase = (grupos) => ({ ejemplo: true, ajustes: { max_personas_por_inscripcion: 3, horas_vigencia_apartado: 48, descuento_equipo: { desde_personas: 2, porcentaje: 10 }, landing_por_herramienta: { ia: "/x/ia", excel: "https://malo.example/x" } }, grupos });
const persona = (n = 1) => ({ nombre: "Persona " + n, correo: "p" + n + "@ejemplo.test", whatsapp: n === 1 ? "8100000000" : "" });
const cuerpoInsc = (extra = {}) => ({
  tipo: "inscripcion_abierta", idempotency_key: "clave-0001-aaaa", grupo: "IA-TEST", personas: [persona(1)], paga: "yo", factura: { requiere: false },
  acepta_aviso_privacidad: true, origen: { utm_source: "linkedin", utm_medium: "post", utm_campaign: "ia" }, web: "", tf: antispam.TIEMPO_MINIMO_MS + 5000, ...extra,
});
const cuerpoEsp = (extra = {}) => ({
  tipo: "lista_espera", idempotency_key: "espera-001-aaaa", contexto: "modal_avisame", grupo_referencia: "IA-TEST", nombre: "Ana", correo: "ana@ejemplo.test", interes: "ia", paga: "yo",
  acepta_aviso_privacidad: true, origen: {}, web: "", tf: antispam.TIEMPO_MINIMO_MS + 5000, ...extra,
});
const ip = (n) => ({ "x-forwarded-for": "10.0.0." + n });

(async () => {
  console.log("la foto: lista blanca");
  const sucio = fotoBase([
    { ...grupo(), correo_alumno: "secreto@ejemplo.test", inscritos: [{ nombre: "X" }] },
    grupo({ codigo: "borrador-1", publicacion: "borrador" }),
    grupo({ codigo: "BAD CODE" }),
    grupo({ codigo: "IA-OTRO", precio_preventa: 5000, preventa_hasta: dia(5) }),
    grupo({ codigo: "IA-TEST" }),
  ]);
  const { foto, errores } = cal.limpiarFoto(sucio);
  check("solo pasa el grupo bueno (borrador, código inválido, preventa mayor al precio y repetido se descartan con motivo)", foto.grupos.length === 1 && errores.length === 4);
  check("no se cuelan campos de personas ni de más", !JSON.stringify(foto).includes("secreto") && !("inscritos" in foto.grupos[0]) && !("correo_alumno" in foto.grupos[0]));
  check("landing: solo rutas del sitio (la URL externa se descarta)", foto.ajustes.landing_por_herramienta.ia === "/x/ia" && !("excel" in foto.ajustes.landing_por_herramienta));
  check("instrucciones de pago: CLABE de 18 dígitos o nada", cal.limpiarFoto({ ajustes: { instrucciones_pago: { clabe: "123" } }, grupos: [] }).foto.ajustes.instrucciones_pago === null
    && cal.limpiarFoto({ ajustes: { instrucciones_pago: { clabe: "012345678901234567", banco: "B", beneficiario: "Y" } }, grupos: [] }).foto.ajustes.instrucciones_pago.clabe === "012345678901234567");

  check("nivel combinado «Intermedio · Avanzado» es válido; uno raro o repetido, no", cal.limpiarFoto(fotoBase([grupo({ nivel: "Intermedio · Avanzado" })])).errores.length === 0
    && cal.limpiarFoto(fotoBase([grupo({ nivel: "Intermedio · Raro" })])).errores.length === 1 && cal.limpiarFoto(fotoBase([grupo({ nivel: "Básico · Básico" })])).errores.length === 1);
  console.log("publicar y leer");
  const t = cal.getTable();
  let e1;
  try { await cal.guardarFoto(t, fotoBase([grupo({ codigo: "BAD CODE" })])); } catch (e) { e1 = e; }
  check("una foto con errores NO se publica (se rechaza completa, con motivo)", e1 && e1.safe && !tablas.CalendarioAbiertos.get("calendario|actual"));
  await cal.guardarFoto(t, fotoBase([grupo()]));
  check("publica: foto + contador del grupo (arranca con confirmados + apartados)", !!tablas.CalendarioAbiertos.get("calendario|actual") && cupo("IA-TEST").reservados === 1 && cupo("IA-TEST").cupoTotal === 5);
  const leida = await cal.leerFoto(t);
  check("leer devuelve los lugares reservados vivos", leida.foto.grupos[0].reservados === 1);
  let r = await cal.reservarLugares(t, "IA-TEST", 2);
  check("reservar 2 → quedan 2", r.ok && r.libres === 2 && cupo("IA-TEST").reservados === 3);
  await cal.guardarFoto(t, fotoBase([grupo()]));
  check("republicar NO pisa las reservas del público", cupo("IA-TEST").reservados === 3);
  await cal.guardarFoto(t, fotoBase([grupo()]), { reconciliar: { "IA-TEST": 2 } });
  check("el admin concilia con lo que dice SQL (reconciliar manda)", cupo("IA-TEST").reservados === 2);

  console.log("reserva atómica (carrera)");
  await cal.guardarFoto(t, fotoBase([grupo({ cupo_total: 3, inscritos_confirmados: 0 })]), { reconciliar: { "IA-TEST": 0 } });
  const carrera = await Promise.all(Array.from({ length: 8 }, () => cal.reservarLugares(t, "IA-TEST", 1).catch((e) => ({ ok: false, error: e }))));
  check("8 reservas simultáneas con 3 lugares: exactamente 3 ganan y el contador queda en 3", carrera.filter((x) => x.ok).length === 3 && cupo("IA-TEST").reservados === 3);
  check("pedir de más no baja ni sube nada", (await cal.reservarLugares(t, "IA-TEST", 1)).motivo === "lleno" && cupo("IA-TEST").reservados === 3);
  check("grupo inexistente → no_existe", (await cal.reservarLugares(t, "NOPE", 1)).motivo === "no_existe");
  await cal.liberarLugares(t, "IA-TEST", 2);
  check("liberar devuelve lugares", cupo("IA-TEST").reservados === 1);
  await cal.liberarLugares(t, "IA-TEST", 9);
  check("liberar nunca baja de 0", cupo("IA-TEST").reservados === 0);

  console.log("getCalendarioAbiertos");
  await cal.guardarFoto(t, fotoBase([grupo()]), { reconciliar: { "IA-TEST": 1 } });
  let g = await llamar(getCal);
  check("sirve la foto con `reservados` y cache corto", g.status === 200 && g.body.grupos.length === 1 && g.body.grupos[0].reservados === 1 && /max-age=30/.test(g.headers["Cache-Control"]));
  delete tablas.CalendarioAbiertos; cal._reiniciar();
  g = await llamar(getCal);
  check("sin foto publicada → grupos vacíos (la página muestra su estado vacío)", g.status === 200 && g.body.grupos.length === 0);

  console.log("reservarCursoAbierto");
  await cal.guardarFoto(cal.getTable(), fotoBase([grupo(), grupo({ codigo: "IA-PASADO", sesiones: [{ inicio: iso(Date.now() - DIA), fin: iso(Date.now() - DIA + 3600000) }] }), grupo({ codigo: "IA-FEB", sesiones: [], mes_estimado: "2027-02" })]), { reconciliar: { "IA-TEST": 0, "IA-PASADO": 0, "IA-FEB": 0 } });
  const inscribir = (b, n = 1) => llamar(reservar, { body: b, headers: ip(n) });
  let x = await inscribir(cuerpoInsc({ monto_estimado: { total: 1 }, personas: [persona(1)] }), 1);
  check("inscripción válida: 200, 1 fila en la cola, 1 lugar reservado", x.status === 200 && x.body.ok && filas("InscripcionesAbiertasPendientes").length === 1 && cupo("IA-TEST").reservados === 1);
  const dato = JSON.parse(filas("InscripcionesAbiertasPendientes")[0].datos);
  check("el monto lo calcula el servidor (preventa vigente 2500), no el navegador", dato.monto_estimado.total === 2500 && x.body.monto.total === 2500);
  check("guarda grupo, personas, origen, estado de pago pendiente y hasta cuándo se aparta", dato.grupo === "IA-TEST" && dato.personas[0].nombre === "Persona 1" && dato.origen.utm_source === "linkedin" && dato.estado_pago === "pendiente" && !!dato.apartado_hasta);
  x = await inscribir(cuerpoInsc(), 1);
  check("el MISMO envío reintentado no duplica la fila ni gasta lugares", x.status === 200 && x.body.duplicada === true && filas("InscripcionesAbiertasPendientes").length === 1 && cupo("IA-TEST").reservados === 1);
  x = await inscribir(cuerpoInsc({ idempotency_key: "clave-0002-bbbb", personas: [persona(1), persona(2)], paga: "empresa", factura: { requiere: true, rfc: "XAXX010101000", razon_social: "Empresa SA" } }), 2);
  const d2 = JSON.parse(filas("InscripcionesAbiertasPendientes").find((f) => f.rowKey === "clave-0002-bbbb").datos);
  check("2 personas que paga la empresa: descuento de equipo del 10% (2 × 2500 − 10% = 4500) y lugares = 3", x.status === 200 && d2.monto_estimado.total === 4500 && d2.monto_estimado.descuento_pct === 10 && cupo("IA-TEST").reservados === 3 && d2.factura.rfc === "XAXX010101000");
  x = await inscribir(cuerpoInsc({ idempotency_key: "clave-0003-cccc", personas: [persona(1), persona(2), persona(3)] }), 3);
  check("pide 3 y quedan 2: 409 con cuántos quedan, sin fila nueva y sin tocar el contador", x.status === 409 && x.body.libres === 2 && filas("InscripcionesAbiertasPendientes").length === 2 && cupo("IA-TEST").reservados === 3);
  x = await inscribir(cuerpoInsc({ idempotency_key: "clave-0004-dddd", personas: [persona(1), persona(2)] }), 4);
  console.log("   (0004)", x.status, JSON.stringify(x.body), cupo("IA-TEST").reservados);
  x = await inscribir(cuerpoInsc({ idempotency_key: "clave-0005-eeee", personas: [{ ...persona(1), correo: "otro@ejemplo.test" }] }), 5);
  check("grupo lleno: 409 «lleno», sin fila", x.status === 409 && x.body.lleno === true && filas("InscripcionesAbiertasPendientes").length === 3);

  const antes = filas("InscripcionesAbiertasPendientes").length;
  const malos = [
    ["honeypot lleno: finge éxito pero no guarda", cuerpoInsc({ idempotency_key: "clave-9001-zzzz", web: "http://spam" }), 200],
    ["sin clave de idempotencia", cuerpoInsc({ idempotency_key: "x" }), 400],
    ["sin aviso de privacidad", cuerpoInsc({ idempotency_key: "clave-9002-zzzz", acepta_aviso_privacidad: false }), 400],
    ["sin quién paga", cuerpoInsc({ idempotency_key: "clave-9003-zzzz", paga: "" }), 400],
    ["correo inválido", cuerpoInsc({ idempotency_key: "clave-9004-zzzz", personas: [{ ...persona(1), correo: "no" }] }), 400],
    ["sin WhatsApp de contacto", cuerpoInsc({ idempotency_key: "clave-9005-zzzz", personas: [{ ...persona(1), whatsapp: "" }] }), 400],
    ["RFC inválido con factura", cuerpoInsc({ idempotency_key: "clave-9006-zzzz", factura: { requiere: true, rfc: "123", razon_social: "X" } }), 400],
    ["demasiado rápido (tiempo mínimo)", cuerpoInsc({ idempotency_key: "clave-9007-zzzz", tf: 100 }), 400],
    ["más personas que el máximo", cuerpoInsc({ idempotency_key: "clave-9008-zzzz", personas: [persona(1), persona(2), persona(3), persona(4)] }), 400],
    ["grupo que ya empezó", cuerpoInsc({ idempotency_key: "clave-9009-zzzz", grupo: "IA-PASADO" }), 409],
    ["grupo sin fecha (próximamente)", cuerpoInsc({ idempotency_key: "clave-9010-zzzz", grupo: "IA-FEB" }), 409],
    ["grupo que no existe", cuerpoInsc({ idempotency_key: "clave-9011-zzzz", grupo: "NOPE-1" }), 409],
  ];
  for (const [nombre, body, st] of malos) { const rr = await inscribir(body, 20); check(nombre + " → " + st, rr.status === st); }
  check("ninguno de los rechazados dejó fila", filas("InscripcionesAbiertasPendientes").length === antes);

  await cal.guardarFoto(cal.getTable(), fotoBase([grupo()]), { reconciliar: { "IA-TEST": 0 } });
  fallas.cola = 1;
  x = await inscribir(cuerpoInsc({ idempotency_key: "clave-7001-yyyy", personas: [{ ...persona(1), correo: "cola@ejemplo.test" }] }), 30);
  check("si falla guardar en la cola: 503 y el lugar se devuelve", x.status === 503 && cupo("IA-TEST").reservados === 0);
  x = await inscribir(cuerpoInsc({ idempotency_key: "clave-7001-yyyy", personas: [{ ...persona(1), correo: "cola@ejemplo.test" }] }), 30);
  check("el reintento del navegador ya sí entra", x.status === 200 && !x.body.duplicada && cupo("IA-TEST").reservados === 1);
  await cal.guardarFoto(cal.getTable(), fotoBase([grupo({ cupo_total: 60 })]), { reconciliar: { "IA-TEST": 0 } });
  let limite;
  for (let i = 0; i < 8; i++) limite = await inscribir(cuerpoInsc({ idempotency_key: "clave-80" + i + "0-limite", personas: [{ ...persona(1), correo: "l" + i + "@ejemplo.test" }] }), 40);
  check("límite por IP: tras varios envíos seguidos responde 429", limite.status === 429);

  console.log("avisarCursoAbierto (lista de espera)");
  const colaEsp = () => filas("ListaEsperaAbiertaPendientes");
  let y = await llamar(avisar, { body: cuerpoEsp(), headers: ip(50) });
  check("válida: 200 y 1 fila en la cola", y.status === 200 && y.body.ok && colaEsp().length === 1 && JSON.parse(colaEsp()[0].datos).interes === "ia");
  y = await llamar(avisar, { body: cuerpoEsp(), headers: ip(50) });
  check("el mismo envío no se duplica", y.body.duplicada === true && colaEsp().length === 1);
  for (const [nombre, body, st] of [
    ["honeypot", cuerpoEsp({ idempotency_key: "espera-901-zzzz", web: "x" }), 200],
    ["sin nombre", cuerpoEsp({ idempotency_key: "espera-902-zzzz", nombre: "" }), 400],
    ["correo inválido", cuerpoEsp({ idempotency_key: "espera-903-zzzz", correo: "no" }), 400],
    ["interés inválido", cuerpoEsp({ idempotency_key: "espera-904-zzzz", interes: "hackeo" }), 400],
    ["sin aviso de privacidad", cuerpoEsp({ idempotency_key: "espera-905-zzzz", acepta_aviso_privacidad: false }), 400],
    ["demasiado rápido", cuerpoEsp({ idempotency_key: "espera-906-zzzz", tf: 10 }), 400],
  ]) { const rr = await llamar(avisar, { body, headers: ip(60) }); check(nombre + " → " + st, rr.status === st); }
  check("«otro» es un interés válido", (await llamar(avisar, { body: cuerpoEsp({ idempotency_key: "espera-907-zzzz", interes: "otro", correo: "otro@ejemplo.test" }), headers: ip(61) })).status === 200);
  check("los rechazados no dejaron fila", colaEsp().length === 2);

  console.log("regla del proyecto: lo público no toca SQL");
  const codigo = ["./src/calendario-abiertos", "./src/cursos-abiertos-cola", "./getCalendarioAbiertos", "./reservarCursoAbierto", "./avisarCursoAbierto"]
    .map((f) => fs.readFileSync(require.resolve(f), "utf8").split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join(" ")).join(" ");
  check("ninguna de las 3 Functions ni sus módulos usa SQL (getPool / backoffice-db)", !/backoffice-db|getPool/.test(codigo));

  console.log(fallos ? "\n" + fallos + " FALLA(S)" : "\nTodo OK");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
