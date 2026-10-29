// test-sitio-config.js — admin → Personalizar (2026-10-28): validaciones, guardado, lectura pública y las 3 Functions. Sin red: Table Storage simulado.
// Lo que se vigila: que NADA raro llegue a una página pública (liga que no sea de LinkedIn, enlaces javascript:, HTML en el texto), que lo no guardado
// no exista, que el aviso vencido no salga y que lo público no exponga quién editó.
const Module = require("module");
const filas = new Map();
const nf = () => { const e = new Error("nf"); e.statusCode = 404; return e; };
const tabla = {
  createTable: async () => {},
  getEntity: async (p, r) => { const e = filas.get(p + "|" + r); if (!e) throw nf(); return { ...e }; },
  upsertEntity: async (e, modo) => { const k = e.partitionKey + "|" + e.rowKey; const a = filas.get(k); filas.set(k, modo === "Merge" && a ? { ...a, ...e } : { ...e }); },
};
let sqlTocado = false;
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === "@azure/data-tables") return { TableClient: { fromConnectionString: () => tabla } };
  if (/backoffice-db$/.test(req)) { sqlTocado = true; throw new Error("el sitio público NO debe tocar SQL"); }
  return origLoad.call(this, req, ...a);
};
process.env.RECURSOS_STORAGE_CONNECTION = "UseDevelopmentStorage=true";

let fallos = 0;
function check(n, c, det) { if (c) console.log("  ok  " + n); else { fallos++; console.log("  FALLA  " + n + (det ? " → " + det : "")); } }
const lanza = (f) => { try { f(); return null; } catch (e) { return e; } };
const S = require("./src/sitio-config");
const EMBED = "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7490820891162054656?collapsed=1";

(async () => {
  console.log("LinkedIn");
  let r = S.validarLinkedin({ codigo: `<iframe src="${EMBED}" height="628" width="504" frameborder="0" allowfullscreen="" title="Publicación incrustada"></iframe>` });
  check("acepta el código <iframe> completo y saca la liga y el alto", r.embed === EMBED && r.alto === 628 && r.mostrar === true, JSON.stringify(r));
  r = S.validarLinkedin({ codigo: EMBED });
  check("acepta solo la liga (alto 560 por omisión)", r.embed === EMBED && r.alto === 560);
  check("el alto se acota entre 300 y 1200", S.validarLinkedin({ codigo: EMBED, alto: 50 }).alto === 300 && S.validarLinkedin({ codigo: EMBED, alto: 99999 }).alto === 1200);
  check("liga de otro dominio → error", lanza(() => S.validarLinkedin({ codigo: "https://evil.com/embed/feed/update/urn:li:ugcPost:7490820891162054656" })) instanceof S.ErrorValidacion);
  check("subdominio engañoso (www.linkedin.com.evil.com) → error", lanza(() => S.validarLinkedin({ codigo: "https://www.linkedin.com.evil.com/embed/feed/update/urn:li:ugcPost:7490820891162054656" })) instanceof S.ErrorValidacion);
  check("javascript: → error", lanza(() => S.validarLinkedin({ codigo: "javascript:alert(1)" })) instanceof S.ErrorValidacion);
  check("src con otra ruta de LinkedIn (no embed) → error", lanza(() => S.validarLinkedin({ codigo: '<iframe src="https://www.linkedin.com/in/alguien">' })) instanceof S.ErrorValidacion);
  check("vacío y apagado → guarda 'sin publicación'", (() => { const x = S.validarLinkedin({ codigo: "", mostrar: false }); return x.mostrar === false && x.embed === ""; })());
  check("vacío pero encendido → pide el código", lanza(() => S.validarLinkedin({ codigo: "", mostrar: true })) instanceof S.ErrorValidacion);

  console.log("Contacto");
  r = S.validarContacto({ correo: "  Alfredo.Pina@LifeZen.com.mx ", whatsapp: "+52 81 1725 5937" });
  check("normaliza el correo y deja el WhatsApp en dígitos con lada", r.correo === "alfredo.pina@lifezen.com.mx" && r.whatsapp === "528117255937", JSON.stringify(r));
  check("un número de 10 dígitos se toma como mexicano (52)", S.validarContacto({ correo: "a@b.co", whatsapp: "8117255937" }).whatsapp === "528117255937");
  check("correo inválido → error", lanza(() => S.validarContacto({ correo: "no-es-correo", whatsapp: "528117255937" })) instanceof S.ErrorValidacion);
  check("correo con comillas o < > → error", lanza(() => S.validarContacto({ correo: '"><script>@x.co', whatsapp: "528117255937" })) instanceof S.ErrorValidacion);
  check("WhatsApp demasiado corto o largo → error", lanza(() => S.validarContacto({ correo: "a@b.co", whatsapp: "12345" })) instanceof S.ErrorValidacion && lanza(() => S.validarContacto({ correo: "a@b.co", whatsapp: "1".repeat(20) })) instanceof S.ErrorValidacion);

  console.log("Perfiles");
  r = S.validarPerfiles({ linkedinPersonal: "https://www.linkedin.com/in/alfredopinacortez/", linkedinEmpresa: "", youtube: "https://www.youtube.com/@alfredopina" });
  check("acepta LinkedIn y YouTube reales, quita la diagonal final y deja vacío lo no escrito", r.linkedinPersonal === "https://www.linkedin.com/in/alfredopinacortez" && r.linkedinEmpresa === "" && r.youtube === "https://www.youtube.com/@alfredopina", JSON.stringify(r));
  check("LinkedIn personal con ruta de empresa → error", lanza(() => S.validarPerfiles({ linkedinPersonal: "https://www.linkedin.com/company/123456" })) instanceof S.ErrorValidacion);
  check("otro dominio, http o con usuario:clave → error", ["http://www.linkedin.com/in/alguien", "https://evil.com/in/alguien", "https://user:pass@www.linkedin.com/in/alguien", "javascript:alert(1)"].every((u) => lanza(() => S.validarPerfiles({ linkedinPersonal: u })) instanceof S.ErrorValidacion));

  console.log("Aviso");
  r = S.validarAviso({ activo: true, texto: "  Nuevas   fechas <b>en noviembre</b>  ", enlace: "/cursos-abiertos", hasta: "2026-11-03" });
  check("normaliza espacios y guarda el texto tal cual (el sitio lo pinta como TEXTO, nunca como HTML)", r.texto === "Nuevas fechas <b>en noviembre</b>" && r.enlace === "/cursos-abiertos" && r.hasta === "2026-11-03", JSON.stringify(r));
  check("enlace javascript:, // o http → error", ["javascript:alert(1)", "//evil.com", "http://evil.com", "data:text/html,x"].every((u) => lanza(() => S.validarAviso({ activo: true, texto: "x", enlace: u })) instanceof S.ErrorValidacion));
  check("enlace https:// completo se acepta", S.validarAviso({ activo: true, texto: "x", enlace: "https://www.alfredopina.ai/in-company" }).enlace === "https://www.alfredopina.ai/in-company");
  check("texto de más de 120 caracteres se recorta a 120", S.validarAviso({ activo: true, texto: "a".repeat(300) }).texto.length === 120);
  check("encendido sin texto → error; apagado sin texto → ok", lanza(() => S.validarAviso({ activo: true, texto: "" })) instanceof S.ErrorValidacion && S.validarAviso({ activo: false, texto: "" }).activo === false);
  check("fecha mal escrita → error", lanza(() => S.validarAviso({ activo: true, texto: "x", hasta: "3/11/2026" })) instanceof S.ErrorValidacion);
  const ahora = new Date("2026-11-03T20:00:00-06:00"); // 3 nov, 8 pm en Monterrey
  check("el aviso vence al terminar el día 'hasta' (en hora de Monterrey)", S.avisoVigente({ activo: true, texto: "x", hasta: "2026-11-03" }, ahora) === true && S.avisoVigente({ activo: true, texto: "x", hasta: "2026-11-02" }, ahora) === false);
  check("sin fecha 'hasta' el aviso no vence; apagado nunca se ve", S.avisoVigente({ activo: true, texto: "x", hasta: "" }, ahora) === true && S.avisoVigente({ activo: false, texto: "x" }, ahora) === false);

  console.log("Guardar y leer");
  check("sin nada guardado no existe ninguna sección (el sitio usa su HTML)", Object.keys(S.paraPublico(await S.leerTodo({ usarCache: false }))).length === 0);
  check("sección desconocida → error", await S.guardarSeccion("otra", {}, "a@b.co").then(() => false, (e) => e instanceof S.ErrorValidacion));
  await S.guardarSeccion("contacto", { correo: "hola@x.co", whatsapp: "528111111111" }, "alfredo.pina@lifezen.com.mx", new Date("2026-10-28T12:00:00Z"));
  await S.guardarSeccion("aviso", { activo: true, texto: "Aviso", hasta: "2026-10-01" }, "alfredo.pina@lifezen.com.mx", new Date("2026-10-28T12:00:00Z"));
  const todo = await S.leerTodo({ usarCache: false });
  check("guarda por sección y no pisa a las demás", todo.contacto.correo === "hola@x.co" && todo.aviso.texto === "Aviso" && !todo.linkedin);
  check("registra quién y cuándo (para el panel)", todo.meta.contacto.por === "alfredo.pina@lifezen.com.mx" && /^2026-10-28/.test(todo.meta.contacto.en));
  const pub = S.paraPublico(todo, new Date("2026-10-28T12:00:00Z"));
  check("lo público NO trae quién ni cuándo", !("meta" in pub) && JSON.stringify(pub).indexOf("lifezen") === -1);
  check("lo público no trae un aviso vencido", !("aviso" in pub) && pub.contacto.whatsapp === "528111111111");
  await S.guardarSeccion("linkedin", { codigo: EMBED, mostrar: false }, "x@y.co");
  check("apagar LinkedIn lo guarda como 'no mostrar' (manda sobre el valor original del sitio)", (await S.leerTodo({ usarCache: false })).linkedin.mostrar === false);

  console.log("Functions");
  const ctx = () => ({ log: { error() {} } });
  const pubFn = require("./getConfiguracionSitio");
  let c = ctx(); await pubFn(c);
  check("pública: 200, caché de 60 s y solo secciones guardadas", c.res.status === 200 && /max-age=60/.test(c.res.headers["Cache-Control"]) && c.res.body.contacto && !c.res.body.meta);
  const admFn = require("./getConfiguracionSitioAdmin");
  c = ctx(); await admFn(c);
  check("admin: sin caché y CON quién/cuándo", c.res.status === 200 && c.res.headers["Cache-Control"] === "no-store" && c.res.body.meta.contacto.por === "alfredo.pina@lifezen.com.mx");
  const guardarFn = require("./guardarConfiguracionSitio");
  const principal = Buffer.from(JSON.stringify({ userDetails: "viri@lifezen.com.mx", userRoles: ["admin"] })).toString("base64");
  c = ctx(); await guardarFn(c, { headers: { "x-ms-client-principal": principal }, body: { seccion: "perfiles", datos: { linkedinPersonal: "https://www.linkedin.com/in/alfredopinacortez" } } });
  check("guardar: 200 y registra al usuario que verificó Azure", c.res.status === 200 && (await S.leerTodo({ usarCache: false })).meta.perfiles.por === "viri@lifezen.com.mx");
  c = ctx(); await guardarFn(c, { headers: { "x-ms-client-principal": principal }, body: { seccion: "perfiles", datos: { linkedinPersonal: "https://evil.com/in/x" } } });
  check("guardar con datos malos: 400 con el motivo", c.res.status === 400 && /LinkedIn personal/.test(c.res.body.error));
  c = ctx(); await guardarFn(c, { headers: {}, body: { seccion: "contacto", datos: { correo: "a@b.co", whatsapp: "528111111111" }, por: "falso@x.co" } });
  check("el 'por' que mande el navegador se ignora", !(await S.leerTodo({ usarCache: false })).meta.contacto.por);
  check("NINGUNA de estas Functions tocó SQL", sqlTocado === false);

  Module._load = origLoad;
  if (fallos) { console.log("\n" + fallos + " prueba(s) fallaron"); process.exit(1); }
  console.log("\ntest-sitio-config: ok");
})().catch((e) => { console.error(e); process.exit(1); });
