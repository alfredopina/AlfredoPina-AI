// Prueba de api/src/antispam-solicitud.js: señales del formulario, IP del visitante, y los
// contadores por ventana con una tabla en memoria (incluido que fallen abiertos).
const assert = require("assert");
const a = require("./src/antispam-solicitud");

const ctx = { log: { error() {}, warn() {} } };
const ok = { tf: 6000, nombre: "Ana", empresa: "ACME", comentarios: "Quiero cotizar" };

// ── señales ──
assert.strictEqual(a.validarSenales(ok), null);
assert.ok(a.validarSenales({ ...ok, tf: undefined }), "sin tiempo de llenado: se rechaza");
assert.ok(a.validarSenales({ ...ok, tf: "abc" }), "tiempo no numérico: se rechaza");
assert.ok(a.validarSenales({ ...ok, tf: 500 }), "muy rápido: se rechaza");
assert.strictEqual(a.validarSenales({ ...ok, tf: a.TIEMPO_MINIMO_MS }), null, "justo en el mínimo pasa");
assert.ok(a.validarSenales({ ...ok, nombre: "Gana en www.spam.com" }), "enlace en el nombre");
assert.ok(a.validarSenales({ ...ok, empresa: "https://malo.example" }), "enlace en la empresa");
assert.strictEqual(a.validarSenales({ ...ok, comentarios: "Mira https://acme.com/proyecto" }), null, "un enlace en comentarios es válido");
assert.ok(a.validarSenales({ ...ok, comentarios: "http://a.com y www.b.com" }), "dos enlaces en comentarios");
// el regex global no debe quedarse con estado entre llamadas
assert.strictEqual(a.validarSenales({ ...ok, comentarios: "http://a.com" }), null);
assert.strictEqual(a.validarSenales({ ...ok, comentarios: "http://a.com" }), null);

// ── IP ──
assert.strictEqual(a.ipDe({ headers: { "x-forwarded-for": "187.1.2.3:51234, 10.0.0.1" } }), "187.1.2.3");
assert.strictEqual(a.ipDe({ headers: { "x-forwarded-for": "[2001:db8::1]:443" } }), "2001:db8::1");
assert.strictEqual(a.ipDe({ headers: { "x-forwarded-for": "2001:db8::1" } }), "2001:db8::1");
assert.strictEqual(a.ipDe({ headers: { "x-azure-clientip": "8.8.8.8" } }), "8.8.8.8");
assert.strictEqual(a.ipDe({ headers: {} }), "");
assert.strictEqual(a.ipDe({}), "");

// ── claves ──
assert.strictEqual(a.claveContacto("a@b.com", "8112345678"), a.claveContacto("A@B.com", "000"), "el correo manda y no distingue mayúsculas");
assert.strictEqual(a.claveContacto(null, "81 1234-5678"), a.claveContacto(null, "(81)12345678"), "sin correo: solo dígitos del WhatsApp");
assert.strictEqual(a.claveContacto(null, null), "");
assert.notStrictEqual(a.hashClave("ip|1.1.1.1"), a.hashClave("ip|1.1.1.2"));

// ── contadores con tabla en memoria ──
function tablaFalsa() {
  const filas = new Map();
  return {
    filas, creada: 0,
    async createTable() { this.creada++; },
    async getEntity(p, r) {
      const e = filas.get(p + "|" + r);
      if (!e) throw Object.assign(new Error("no"), { statusCode: 404 });
      return { ...e };
    },
    async upsertEntity(e) { filas.set(e.partitionKey + "|" + e.rowKey, { ...e }); },
  };
}

(async () => {
  const t = tablaFalsa();
  const lim = { max: 3, ventanaMs: 60 * 60 * 1000 };
  assert.strictEqual(await a.excede(t, "ip", "k", lim, ctx), false);
  await a.registrar(t, "ip", "k", lim, ctx);
  await a.registrar(t, "ip", "k", lim, ctx);
  assert.strictEqual(await a.excede(t, "ip", "k", lim, ctx), false, "2 de 3: todavía cabe");
  await a.registrar(t, "ip", "k", lim, ctx);
  assert.strictEqual(await a.excede(t, "ip", "k", lim, ctx), true, "3 de 3: ya excede");
  assert.strictEqual(await a.excede(t, "ip", "otra", lim, ctx), false, "otra clave no se afecta");
  assert.strictEqual(await a.excede(t, "contacto", "k", lim, ctx), false, "otra partición no se afecta");

  // ventana vencida: vuelve a empezar
  t.filas.get("ip|k").ventanaInicio = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  assert.strictEqual(await a.excede(t, "ip", "k", lim, ctx), false, "ventana vencida: ya no excede");
  await a.registrar(t, "ip", "k", lim, ctx);
  assert.strictEqual(t.filas.get("ip|k").conteo, 1, "ventana nueva arranca en 1");

  // tope de avisos
  const t2 = tablaFalsa();
  const aviso = { max: 2, ventanaMs: 60 * 60 * 1000 };
  assert.strictEqual(await a.consumirCupo(t2, "aviso", "global", aviso, ctx), true);
  assert.strictEqual(await a.consumirCupo(t2, "aviso", "global", aviso, ctx), true);
  assert.strictEqual(await a.consumirCupo(t2, "aviso", "global", aviso, ctx), false, "pasado el tope no hay cupo");

  // sin tabla o con la tabla rota: falla abierto, nunca lanza
  assert.strictEqual(await a.excede(null, "ip", "k", lim, ctx), false);
  assert.strictEqual(await a.consumirCupo(null, "aviso", "global", aviso, ctx), true);
  await a.registrar(null, "ip", "k", lim, ctx);
  const rota = { async createTable() { throw new Error("storage caído"); }, async getEntity() { throw new Error("x"); }, async upsertEntity() { throw new Error("x"); } };
  assert.strictEqual(await a.excede(rota, "ip", "k", lim, ctx), false, "tabla rota: falla abierto");
  await a.registrar(rota, "ip", "k", lim, ctx);
  assert.strictEqual(await a.excede(t, "ip", "", lim, ctx), false, "sin clave (sin IP) no limita");

  console.log("test-antispam-solicitud: ok");
})().catch((e) => { console.error(e); process.exit(1); });
