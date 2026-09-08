// getRecursos/index.js
// Azure Function (modelo v3 clásico) pública: recibe herramienta + curso + código,
// valida el código contra la tabla "Cursos" y, si coincide, regresa los recursos
// de ese curso desde la tabla "Recursos" (Azure Table Storage). El navegador
// nunca ve el código correcto ni los recursos de un curso que no desbloqueó.
//
// Rate limiting (por curso, no por IP — más simple y suficiente para el volumen
// real): 10 intentos fallidos seguidos en una ventana de 15 min bloquean ese
// curso por 5 min, sin importar quién los mande. Un código correcto limpia el
// contador. Si Table Storage falla al leer/escribir el contador, se deja pasar
// la validación normal (fail-open) — más vale no bloquear el acceso legítimo
// por un problema del contador, que no es la defensa principal.
const { getCursosTable, getRecursosTable, getIntentosCodigoTable } = require("../src/recursos-tables");
const { escaparComillasOData } = require("../src/odata-escape");

const TIPOS = ["manual", "caso", "plantilla", "skill", "extra"];
const PLURAL = { manual: "manuales", caso: "casos", plantilla: "plantillas", skill: "skills", extra: "extra" };
const { JSON_HEADERS } = require("../src/http");

const VENTANA_MS = 15 * 60 * 1000;
const MAX_INTENTOS = 10;
const BLOQUEO_MS = 5 * 60 * 1000;

// null si no está bloqueado; si algo falla al leer, regresa null (fail-open).
async function checarBloqueo(table, partitionKey, context) {
  try {
    const entidad = await table.getEntity(partitionKey, "contador");
    if (entidad.bloqueadoHasta && new Date(entidad.bloqueadoHasta).getTime() > Date.now()) {
      return entidad.bloqueadoHasta;
    }
    return null;
  } catch (err) {
    if (err.statusCode !== 404) context.log.error("Error leyendo el contador de intentos:", err.message);
    return null;
  }
}

// Registra un intento fallido y bloquea el curso si se pasó del umbral en la ventana.
async function registrarIntentoFallido(table, partitionKey, context) {
  try {
    const ahora = Date.now();
    let entidad = null;
    try {
      entidad = await table.getEntity(partitionKey, "contador");
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }

    const ventanaVigente = entidad && ahora - new Date(entidad.ventanaInicio).getTime() < VENTANA_MS;
    const fallos = (ventanaVigente ? entidad.fallos : 0) + 1;
    const ventanaInicio = ventanaVigente ? entidad.ventanaInicio : new Date(ahora).toISOString();
    const bloqueadoHasta = fallos >= MAX_INTENTOS ? new Date(ahora + BLOQUEO_MS).toISOString() : "";

    await table.upsertEntity(
      { partitionKey, rowKey: "contador", fallos, ventanaInicio, bloqueadoHasta },
      "Replace"
    );
  } catch (err) {
    context.log.error("Error registrando el intento fallido:", err.message);
  }
}

// Código correcto: limpia el contador para no penalizar intentos futuros legítimos.
async function limpiarIntentos(table, partitionKey, context) {
  try {
    await table.deleteEntity(partitionKey, "contador");
  } catch (err) {
    if (err.statusCode !== 404) context.log.error("Error limpiando el contador de intentos:", err.message);
  }
}

module.exports = async function (context, req) {
  const herramienta = (req.query.herramienta || "").trim().toLowerCase();
  const curso = (req.query.curso || "").trim().toLowerCase();
  const codigo = (req.query.codigo || "").trim().toUpperCase();

  if (!herramienta || !curso || !codigo) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Faltan datos (herramienta, curso o código)." } };
    return;
  }

  let cursoEntity;
  try {
    const cursosTable = getCursosTable();
    cursoEntity = await cursosTable.getEntity(herramienta, curso);
  } catch (err) {
    if (err.statusCode === 404) {
      context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese curso no existe." } };
      return;
    }
    context.log.error("Error consultando la tabla Cursos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudo validar el curso. Intenta de nuevo en un momento." } };
    return;
  }

  if (cursoEntity.estado !== "publicado") {
    context.res = { status: 404, headers: JSON_HEADERS, body: { error: "Ese curso no existe." } };
    return;
  }

  const partitionKey = `${herramienta}_${curso}`;

  let intentosTable = null;
  try {
    intentosTable = await getIntentosCodigoTable();
  } catch (err) {
    context.log.error("Error preparando la tabla de intentos:", err.message); // fail-open: sigue sin rate limiting
  }

  if (intentosTable) {
    const bloqueadoHasta = await checarBloqueo(intentosTable, partitionKey, context);
    if (bloqueadoHasta) {
      context.res = {
        status: 429,
        headers: JSON_HEADERS,
        body: { error: "Demasiados intentos con este curso. Intenta de nuevo en unos minutos." },
      };
      return;
    }
  }

  if ((cursoEntity.codigo || "").trim().toUpperCase() !== codigo) {
    if (intentosTable) await registrarIntentoFallido(intentosTable, partitionKey, context);
    context.res = { status: 401, headers: JSON_HEADERS, body: { error: "Código incorrecto." } };
    return;
  }

  if (intentosTable) await limpiarIntentos(intentosTable, partitionKey, context);

  const agrupado = { manuales: [], casos: [], plantillas: [], skills: [], extra: [] };

  try {
    const recursosTable = getRecursosTable();
    const entidades = recursosTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${escaparComillasOData(partitionKey)}'` },
    });

    const todas = [];
    for await (const r of entidades) todas.push(r);
    todas.sort((a, b) => (a.orden || 0) - (b.orden || 0));

    for (const r of todas) {
      if (!TIPOS.includes(r.tipo)) continue;
      const item = { titulo: r.titulo || "", texto: r.texto || "" };
      if (r.tipo !== "skill") item.url = r.url || "#";
      agrupado[PLURAL[r.tipo]].push(item);
    }
  } catch (err) {
    context.log.error("Error consultando la tabla Recursos:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los recursos. Intenta de nuevo en un momento." } };
    return;
  }

  context.res = {
    status: 200,
    headers: JSON_HEADERS,
    body: { nombre: cursoEntity.nombre || curso, ...agrupado },
  };
};
