// api/src/cursos-abiertos-cola.js
// Colas de Cursos Abiertos (Table Storage; mismo patrón que Diagnóstico y Encuesta, mecánica genérica en cola-tabla.js):
//   · InscripcionesAbiertasPendientes — una fila por inscripción (1 a 3 personas). El admin la importa a SQL (Alumno + Inscripción + cuenta por cobrar).
//   · ListaEsperaAbiertaPendientes — una fila por «avísame». El admin la importa a ListaEspera.
// Llave idempotente = el UUID que genera el navegador al abrir el formulario: un reintento no crea otra fila (409 = ya estaba).
const { crearCola } = require("./cola-tabla");

const inscripciones = crearCola({ tabla: "InscripcionesAbiertasPendientes" });
const espera = crearCola({ tabla: "ListaEsperaAbiertaPendientes" });

const CLAVE_OK = /^[A-Za-z0-9-]{8,64}$/;

module.exports = { inscripciones, espera, CLAVE_OK };
