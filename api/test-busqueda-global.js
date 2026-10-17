// test-busqueda-global.js — búsqueda global del admin (Ctrl+K), sin red: pool de SQL simulado.
const Module = require("module");

const consultas = [];
let falla = false;
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (/backoffice-db$/.test(req)) {
    const sql = { NVarChar: "nv", Int: "i" };
    const pool = {
      request() {
        const params = {};
        const r = {
          input(n, t, v) { params[n] = v; return r; },
          async query(texto) {
            if (falla) throw new Error("detalle-interno-sql");
            consultas.push({ texto, params: { ...params } });
            const tabla = /FROM (\w+)/.exec(texto)[1];
            return { recordset: tabla === "Cliente" ? [{ id: 1, nombre: "Acme", codigo: "ACME", tipo_cliente: "Directo" }] : [] };
          },
        };
        return r;
      },
    };
    return { getPool: async () => pool, sql };
  }
  return origLoad.call(this, req, ...a);
};

const { buscar, patron, limpiarTexto, MIN_CARACTERES, MAX_POR_TIPO, CONSULTAS } = require("./src/busqueda-global");
const funcion = require("./buscarGlobalAdmin");

let fallos = 0;
const check = (n, ok) => { console.log((ok ? "  OK " : "  FALLA ") + n); if (!ok) fallos++; };
const sql = { NVarChar: "nv", Int: "i" };
const poolFalso = () => require("./src/backoffice-db"); // el stub de arriba

(async () => {
  const { getPool } = poolFalso();
  const pool = await getPool();

  check("el patrón escapa los comodines de LIKE (% _ [ \\) para que el texto se busque literal", patron("50%_a[b\\") === "%50\\%\\_a\\[b\\\\%");
  check("limpia espacios dobles y recorta a 80 caracteres", limpiarTexto("  hola   mundo ") === "hola mundo" && limpiarTexto("x".repeat(200)).length === 80);
  check("tolera null/undefined", limpiarTexto(null) === "" && limpiarTexto(undefined) === "");

  let r = await buscar(pool, sql, "a");
  check("menos de " + MIN_CARACTERES + " caracteres: no consulta la base y regresa todo vacío", consultas.length === 0 && r.clientes.length === 0 && Object.keys(r).length === 6);

  r = await buscar(pool, sql, "  Acme  ");
  check("busca en las 5 tablas (clientes, cotizaciones, grupos, solicitudes, contactos)", consultas.length === 5 && ["Cliente", "Cotizacion", "Grupo", "Solicitud", "Contacto"].every((t) => consultas.some((c) => new RegExp("FROM " + t + "\\b").test(c.texto))));
  check("pasa el texto como PARÁMETRO (nunca pegado en el SQL)", consultas.every((c) => c.params.p === "%Acme%" && !c.texto.includes("Acme")));
  check("limita cada tipo a " + MAX_POR_TIPO, consultas.every((c) => c.params.max === MAX_POR_TIPO) && /TOP \(@max\)/.test(CONSULTAS.clientes));
  check("todas las consultas escapan con ESCAPE '\\'", Object.values(CONSULTAS).every((q) => q.includes("ESCAPE '\\'")));
  check("devuelve lo encontrado agrupado por tipo", r.clientes.length === 1 && r.clientes[0].nombre === "Acme" && Array.isArray(r.grupos));
  check("los clientes que EMPIEZAN con lo escrito salen primero", /CASE WHEN c\.nombre LIKE @inicio/.test(CONSULTAS.clientes));

  // la Function
  const ctx = (q) => ({ log: { error() {} }, res: null, _req: { query: { q } } });
  let c = ctx("Acme"); await funcion(c, c._req);
  check("Function: 200 con los grupos de resultados", c.res.status === 200 && c.res.body.clientes.length === 1);
  c = ctx(""); await funcion(c, { query: {} });
  check("Function sin texto: 200 y todo vacío (sin tocar la base)", c.res.status === 200 && c.res.body.clientes.length === 0);
  falla = true; c = ctx("Acme"); await funcion(c, c._req);
  check("si la base falla: 500 con texto fijo, sin el error interno", c.res.status === 500 && !JSON.stringify(c.res.body).includes("detalle-interno-sql"));
  falla = false;

  if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
  console.log("\ntest-busqueda-global: ok");
})().catch((e) => { console.error(e); process.exit(1); });
