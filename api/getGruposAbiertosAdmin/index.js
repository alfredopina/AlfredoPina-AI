// getGruposAbiertosAdmin/index.js
// Function protegida (rol "admin"): los grupos abiertos con sus sesiones y conteos, para el Tracking «Abiertos» y para precargar el formulario de edición.
// Los conteos salen de SQL (Inscripcion + ListaEspera); lo que aún espera en las colas del sitio se suma aparte (`cola`, solo Table Storage).
const { getPool } = require("../src/backoffice-db");
const { JSON_HEADERS } = require("../src/http");
const colas = require("../src/cursos-abiertos-cola");

module.exports = async function (context) {
  try {
    const pool = await getPool();
    const [g, s, e] = await Promise.all([
      pool.request().query(
        `SELECT g.id, g.grupo_codigo AS codigo, g.programa_id, g.nombre_curso AS programa_nombre, g.herramientas, g.niveles, g.modalidad, g.sede, g.horas,
                g.cupo_total, g.minimo_para_abrir, g.precio_persona, g.precio_preventa, CONVERT(varchar(10), g.preventa_hasta, 23) AS preventa_hasta,
                g.publicacion, g.mes_estimado, g.resumen_publico AS resumen, g.temario_corto, g.instructor, g.notas, g.publicado_en,
                g.estatus_curso, g.estatus_cierre,
                (SELECT COUNT(*) FROM Inscripcion i WHERE i.grupo_id = g.id AND i.estado = 'confirmada') AS confirmadas,
                (SELECT COUNT(*) FROM Inscripcion i WHERE i.grupo_id = g.id AND i.estado = 'apartada') AS apartadas,
                (SELECT COUNT(*) FROM Inscripcion i WHERE i.grupo_id = g.id AND i.estado = 'apartada' AND i.apartado_hasta < SYSUTCDATETIME()) AS vencidas
         FROM Grupo g WHERE g.estrategia = 'abiertos' ORDER BY g.fecha_inicio DESC, g.id DESC`
      ),
      pool.request().query("SELECT s.grupo_id, s.orden, s.inicio, s.fin FROM GrupoSesion s JOIN Grupo g ON g.id = s.grupo_id WHERE g.estrategia = 'abiertos' ORDER BY s.grupo_id, s.orden"),
      pool.request().query("SELECT interes, COUNT(*) AS n FROM ListaEspera WHERE estado = 'nueva' GROUP BY interes"),
    ]);
    const sesiones = {};
    s.recordset.forEach((x) => { (sesiones[x.grupo_id] = sesiones[x.grupo_id] || []).push({ inicio: new Date(x.inicio).toISOString(), fin: new Date(x.fin).toISOString() }); });
    // lo que todavía no se importa (solo Table Storage; nunca bloquea la lista)
    let cola = { inscripciones: 0, espera: 0 };
    try {
      const [a, b] = await Promise.all([colas.inscripciones.resumen(colas.inscripciones.getTable(), { fila: () => ({}) }), colas.espera.resumen(colas.espera.getTable(), { fila: () => ({}) })]);
      cola = { inscripciones: a.total, espera: b.total };
    } catch (err) { context.log.warn("No se pudo leer la cola de Cursos Abiertos:", err.message); }
    context.res = {
      status: 200, headers: JSON_HEADERS,
      body: { grupos: g.recordset.map((x) => ({ ...x, sesiones: sesiones[x.id] || [], publicado_en: x.publicado_en ? new Date(x.publicado_en).toISOString() : null })), espera_por_interes: e.recordset, cola },
    };
  } catch (err) {
    context.log.error("Error listando los grupos abiertos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los grupos abiertos." } };
  }
};
