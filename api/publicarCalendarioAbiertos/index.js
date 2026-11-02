// publicarCalendarioAbiertos/index.js
// Function protegida (rol "admin"): «Publicar calendario». Arma la FOTO pública de Cursos Abiertos con lo que hay en SQL (grupos abiertos PUBLICADOS que aún no
// empiezan, sus sesiones y sus conteos) y la escribe en Table Storage, que es lo único que lee el sitio (nada público toca SQL).
//   · Todo o nada: si algún grupo no pasa la validación (api/src/calendario-abiertos.js) no se publica nada y se devuelve cuáles fallaron y por qué.
//   · CONTADOR de lugares: se concilia con la verdad de SQL = confirmadas + apartadas + lo que sigue en la cola del sitio sin importar. Así dos personas no se
//     llevan el último lugar y lo que el público ya reservó no se pierde al publicar.
//   · Ajustes del sitio (descuento de equipo, instrucciones de pago, landings…): los de la foto anterior, o los de api/src/grupo-abierto.js la primera vez;
//     el cuerpo puede traer `ajustes` y `ejemplo` para fijarlos (hasta que existan en Personalizar).
//   · Marca Grupo.publicado_en de cada grupo publicado. Nunca borra ni cambia otra cosa.
const { getPool, sql } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const cal = require("../src/calendario-abiertos");
const colas = require("../src/cursos-abiertos-cola");
const ga = require("../src/grupo-abierto");

const res = (context, status, body) => { context.res = { status, headers: JSON_HEADERS, body }; };

module.exports = async function (context, req) {
  const body = req.body || {};
  try {
    const pool = await getPool();
    const [g, s] = await Promise.all([
      pool.request().query(
        `SELECT g.id, g.grupo_codigo, g.programa_id, g.nombre_curso, g.herramientas, g.niveles, g.modalidad, g.sede, g.horas, g.cupo_total, g.minimo_para_abrir,
                g.precio_persona, g.precio_preventa, CONVERT(varchar(10), g.preventa_hasta, 23) AS preventa_hasta, g.mes_estimado, g.resumen_publico, g.temario_corto,
                (SELECT COUNT(*) FROM Inscripcion i WHERE i.grupo_id = g.id AND i.estado = 'confirmada') AS confirmadas,
                (SELECT COUNT(*) FROM Inscripcion i WHERE i.grupo_id = g.id AND i.estado = 'apartada') AS apartadas
         FROM Grupo g WHERE g.estrategia = 'abiertos' AND g.publicacion = 'publicado'`
      ),
      pool.request().query("SELECT s.grupo_id, s.inicio, s.fin FROM GrupoSesion s JOIN Grupo g ON g.id = s.grupo_id WHERE g.estrategia = 'abiertos' AND g.publicacion = 'publicado'"),
    ]);

    const tabla = cal.getTable();
    const previa = await cal.leerFoto(tabla); // ajustes de la última foto (si hay)
    const ajustes = body.ajustes && typeof body.ajustes === "object" ? body.ajustes : previa ? previa.foto.ajustes : {};
    const ejemplo = typeof body.ejemplo === "boolean" ? body.ejemplo : previa ? !!previa.foto.ejemplo : false;
    const cruda = ga.armarFoto(g.recordset, s.recordset, ajustes, { ejemplo });

    // lugares que ya apartó el público y aún no se importan
    let enCola = {};
    try {
      const filas = [];
      await colas.inscripciones.resumen(colas.inscripciones.getTable(), { select: ["grupo", "lugares"], agrupar: (e) => filas.push({ grupo: e.grupo, lugares: e.lugares }), fila: () => ({}) });
      enCola = ga.lugaresEnCola(filas);
    } catch (err) {
      context.log.error("No se pudo leer la cola para conciliar el contador:", err.message);
      return res(context, 503, { error: "No se pudo leer la cola de inscripciones; no se publicó para no perder lugares reservados. Inténtalo de nuevo." });
    }
    const reconciliar = {};
    cruda.grupos.forEach((x) => { reconciliar[x.codigo] = x.inscritos_confirmados + x.apartados_sin_pago + (enCola[x.codigo] || 0); });

    const r = await cal.guardarFoto(tabla, cruda, { reconciliar });
    const ids = g.recordset.map((x) => x.id);
    for (const id of ids) await pool.request().input("id", sql.Int, id).query("UPDATE Grupo SET publicado_en = SYSUTCDATETIME() WHERE id = @id");
    return res(context, 200, { ok: true, grupos: r.grupos, publicado_en: r.publicadoEn, ejemplo });
  } catch (err) {
    if (err.safe) return res(context, 400, { error: err.message, errores: err.errores || [] });
    context.log.error("Error publicando el calendario de Cursos Abiertos:", err.message);
    return res(context, 500, { error: "No se pudo publicar el calendario." });
  }
};
