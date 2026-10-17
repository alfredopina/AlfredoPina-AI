// api/src/busqueda-global.js
// Búsqueda global del admin (barra superior, Ctrl+K): un texto → clientes, cotizaciones, grupos, solicitudes y contactos que lo contienen.
// Lógica pura sobre un pool de mssql: se prueba con un pool simulado (api/test-busqueda-global.js). Solo la usa el admin (getPool): lo
// público nunca toca la base. LIKE con los comodines del texto escapados, mínimo 2 caracteres y tope por tipo.
const MIN_CARACTERES = 2;
const MAX_POR_TIPO = 5;

// el usuario escribe "50%" o "a_b": no deben actuar como comodines de LIKE
function patron(texto) {
  return "%" + String(texto).replace(/[\\%_\[]/g, (c) => "\\" + c) + "%";
}

function limpiarTexto(q) {
  return String(q == null ? "" : q).replace(/\s+/g, " ").trim().slice(0, 80);
}

const CONSULTAS = {
  clientes: `SELECT TOP (@max) c.id, c.nombre, c.codigo, c.tipo_cliente
               FROM Cliente c
              WHERE c.nombre LIKE @p ESCAPE '\\' OR c.codigo LIKE @p ESCAPE '\\'
              ORDER BY CASE WHEN c.nombre LIKE @inicio ESCAPE '\\' THEN 0 ELSE 1 END, c.nombre`,
  cotizaciones: `SELECT TOP (@max) q.id, q.folio, q.herramienta, q.temario_nombre, q.estatus, q.precio_final, COALESCE(cf.nombre, c.nombre) AS cliente
                   FROM Cotizacion q
                   JOIN Cliente c ON c.id = q.cliente_id
                   LEFT JOIN Cliente cf ON cf.id = q.cliente_final_id
                  WHERE q.folio LIKE @p ESCAPE '\\' OR c.nombre LIKE @p ESCAPE '\\' OR cf.nombre LIKE @p ESCAPE '\\' OR q.temario_nombre LIKE @p ESCAPE '\\'
                  ORDER BY q.fecha_creacion DESC`,
  grupos: `SELECT TOP (@max) g.id, g.nombre_curso, g.grupo_codigo, g.estatus_curso, g.estatus_cierre, g.fecha_inicio, COALESCE(cf.nombre, c.nombre) AS cliente
             FROM Grupo g
             JOIN Cliente c ON c.id = g.cliente_id
             LEFT JOIN Cliente cf ON cf.id = g.cliente_final_id
            WHERE g.nombre_curso LIKE @p ESCAPE '\\' OR g.grupo_codigo LIKE @p ESCAPE '\\' OR c.nombre LIKE @p ESCAPE '\\' OR cf.nombre LIKE @p ESCAPE '\\' OR g.instructor LIKE @p ESCAPE '\\'
            ORDER BY g.fecha_creacion DESC`,
  solicitudes: `SELECT TOP (@max) s.id, s.herramienta, s.temario_nombre, s.estatus, c.nombre AS cliente, ct.nombre AS contacto
                  FROM Solicitud s
                  JOIN Cliente c ON c.id = s.cliente_id
                  LEFT JOIN Contacto ct ON ct.id = s.contacto_id
                 WHERE c.nombre LIKE @p ESCAPE '\\' OR ct.nombre LIKE @p ESCAPE '\\' OR s.temario_nombre LIKE @p ESCAPE '\\'
                 ORDER BY s.fecha_creacion DESC`,
  contactos: `SELECT TOP (@max) ct.id, ct.nombre, ct.correo, ct.telefono, ct.cliente_id, c.nombre AS cliente
                FROM Contacto ct
                JOIN Cliente c ON c.id = ct.cliente_id
               WHERE ct.nombre LIKE @p ESCAPE '\\' OR ct.correo LIKE @p ESCAPE '\\' OR ct.telefono LIKE @p ESCAPE '\\'
               ORDER BY ct.nombre`,
};

// → { q, clientes:[], cotizaciones:[], grupos:[], solicitudes:[], contactos:[] } (vacío si el texto es muy corto)
async function buscar(pool, sql, texto) {
  const q = limpiarTexto(texto);
  const salida = { q, clientes: [], cotizaciones: [], grupos: [], solicitudes: [], contactos: [] };
  if (q.length < MIN_CARACTERES) return salida;
  const p = patron(q);
  const inicio = patron(q).slice(1); // "q%" para ordenar primero los que empiezan con lo escrito
  const claves = Object.keys(CONSULTAS);
  const resultados = await Promise.all(claves.map((k) =>
    pool.request().input("p", sql.NVarChar, p).input("inicio", sql.NVarChar, inicio).input("max", sql.Int, MAX_POR_TIPO).query(CONSULTAS[k])
  ));
  claves.forEach((k, i) => { salida[k] = resultados[i].recordset || []; });
  return salida;
}

module.exports = { buscar, patron, limpiarTexto, MIN_CARACTERES, MAX_POR_TIPO, CONSULTAS };
