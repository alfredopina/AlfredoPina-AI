// descartarCursoAbiertoPendiente/index.js
// Function protegida (rol "admin"): descarta un envío ATORADO de las colas de Cursos Abiertos (uno que la importación no pudo pasar a SQL, p. ej. su grupo ya no existe).
// Es de las pocas excepciones de borrado real (con confirmación fuerte en el front, como Diagnóstico y Encuesta). Si era una inscripción, devuelve sus lugares al contador
// del sitio. No toca SQL: solo Table Storage.
const colas = require("../src/cursos-abiertos-cola");
const cal = require("../src/calendario-abiertos");
const { JSON_HEADERS } = require("../src/http");

const res = (context, status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };

module.exports = async function (context, req) {
  const b = req.body || {};
  const tipo = b.tipo === "espera" ? "espera" : b.tipo === "inscripcion" ? "inscripcion" : null;
  const envioId = String(b.envioId || "");
  if (!tipo || !colas.CLAVE_OK.test(envioId)) return res(context, 400, { error: "Falta el envío." });
  try {
    const cola = tipo === "espera" ? colas.espera : colas.inscripciones;
    const t = cola.getTable();
    const fila = await cola.leer(t, envioId);
    if (!fila) return res(context, 404, { error: "Ese envío ya no está en la cola." });
    await cola.borrar(t, envioId);
    let devuelto = 0;
    if (tipo === "inscripcion" && fila.grupo && Number(fila.lugares) > 0) {
      await cal.liberarLugares(cal.getTable(), fila.grupo, Number(fila.lugares));
      devuelto = Number(fila.lugares);
    }
    return res(context, 200, { ok: true, lugares_devueltos: devuelto });
  } catch (err) {
    context.log.error("Error descartando el envío de Cursos Abiertos:", err.message);
    return res(context, 500, { error: "No se pudo descartar el envío." });
  }
};
