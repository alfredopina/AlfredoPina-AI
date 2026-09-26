// api/src/despertar-limite.js
// Candado para las Functions PÚBLICAS que despiertan la base SQL
// (despertarDiagnostico, despertarEncuesta). Cada "SELECT 1" que llega a una
// base serverless en pausa la reactiva y se cobra en vCore-segundos; sin
// límite, un robot o una ráfaga de aperturas repetidas la mantiene activa.
//
// Una sola ejecución real cada VENTANA_MS por instancia de la Function
// (compartida entre las dos Functions, porque despertar la base sirve para
// ambas). Las llamadas dentro de la ventana responden ok sin tocar la base:
// las páginas no esperan la respuesta (solo la disparan al cargar).
//
// Alcance honesto: frena las ráfagas y las aperturas repetidas, no a alguien
// que llame cada más de VENTANA_MS de forma sostenida; para eso se vigila la
// métrica de consumo de la base.
const VENTANA_MS = 10 * 60 * 1000;

function crearLimitador(ventanaMs = VENTANA_MS) {
  let ultimo = -Infinity;
  return async function despertarConLimite(ejecutar, ahora = Date.now()) {
    if (ahora - ultimo < ventanaMs) return { ok: true, omitido: true };
    // se marca ANTES de esperar: las llamadas simultáneas ya no entran
    ultimo = ahora;
    try {
      await ejecutar();
    } catch (err) {
      ultimo = -Infinity; // si falló, el siguiente intento sí debe reintentar
      throw err;
    }
    return { ok: true, omitido: false };
  };
}

module.exports = { crearLimitador, despertarConLimite: crearLimitador(), VENTANA_MS };
