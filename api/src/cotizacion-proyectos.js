// Proyectos de un programa para la propuesta de cotización (propuesta.html): nombre, descripción de una
// línea y la URL pública de la miniatura (el contenedor "proyectos" es de acceso público a nivel blob).
// El programa se encuentra por nombre (Solicitud/Cotización solo guardan el NOMBRE del programa, no su id).
// "Fail-soft": si algo falla (programa renombrado, blob caído…) devuelve lo que pudo — una cotización nunca
// debe fallar por una imagen.
const { getTemasTable, getTemariosTable, getProyectosTable, isTableNotFound } = require("./cursos-tables");
const { parseTemaIds, proyectosDePrograma } = require("./cursos-calc");
const { escaparComillasOData } = require("./odata-escape");
const { getProyectosContainer } = require("./proyectos-storage");

const MAX_PROYECTOS = 6;

async function listar(tabla, herramienta) {
  const filas = [];
  try {
    for await (const e of tabla.listEntities({ queryOptions: { filter: `PartitionKey eq '${escaparComillasOData(herramienta)}'` } })) filas.push(e);
  } catch (err) {
    if (!isTableNotFound(err)) throw err;
  }
  return filas;
}

async function proyectosParaPropuesta(herramienta, temarioNombre) {
  try {
    const nombre = (temarioNombre || "").trim().toLowerCase();
    if (!nombre) return [];
    const temarios = await listar(getTemariosTable(), herramienta);
    const programa = temarios.find((t) => (t.nombre || "").trim().toLowerCase() === nombre);
    if (!programa) return [];

    const proyectos = (await listar(getProyectosTable(), herramienta))
      .filter((p) => p.estado === "publicado")
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((p) => ({ id: p.rowKey, nombre: p.nombre || "", resumen: p.resumen || "", imagenMiniBlob: p.imagenMiniBlob || "", temaIds: parseTemaIds(p.temaIds) }));

    const temaIds = new Set(parseTemaIds(programa.temaIds));
    const elegidos = proyectosDePrograma(programa, proyectos, temaIds).slice(0, MAX_PROYECTOS);

    const container = elegidos.some((p) => p.imagenMiniBlob) ? await getProyectosContainer() : null;
    return elegidos.map((p) => ({
      nombre: p.nombre,
      resumen: p.resumen,
      imagenUrl: p.imagenMiniBlob && container ? container.getBlobClient(p.imagenMiniBlob).url : null,
    }));
  } catch (err) {
    console.warn("No se pudieron resolver los proyectos para la propuesta:", err.message);
    return [];
  }
}

module.exports = { proyectosParaPropuesta };
