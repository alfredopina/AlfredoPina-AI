// api/src/notificaciones-atoradas.js
// "Solicitud atorada": una solicitud del formulario público que lleva más de N horas en la cola (Table Storage
// SolicitudesPendientes) sin haber pasado a SQL. Pasa a SQL solo cuando alguien abre el admin, así que cubre tres casos:
// el correo inmediato falló o llegó al tope por hora, hubo un error al pasarla, o simplemente nadie abrió el admin.
// Lógica pura (sin Azure) para poder probarla.
const { armarAviso, fechaLocal } = require("./notificaciones-correo");

// pendientes: filas de la cola ({ rowKey, recibidoEn, datos (JSON), avisadoAtorada? }).
// Regresa las que llevan >= horas, aún sin aviso, de la más vieja a la más nueva, con sus horas de espera.
function seleccionarAtoradas(pendientes, ahora, horas) {
  const limiteMs = horas * 3600 * 1000;
  const lista = [];
  for (const e of pendientes || []) {
    if (e.avisadoAtorada) continue;
    const t = Date.parse(e.recibidoEn);
    if (isNaN(t) || ahora - t < limiteMs) continue;
    let d = {};
    try { d = JSON.parse(e.datos || "{}"); } catch (err) { /* fila rara: se avisa igual con lo que haya */ }
    lista.push({ llave: e.rowKey, recibidoEn: e.recibidoEn, horasEspera: Math.floor((ahora - t) / 3600000), programa: d.temarioNombre || "", empresa: d.empresaNombre || "", nombre: d.nombreContacto || "", correo: d.correo || "" });
  }
  lista.sort((a, b) => String(a.recibidoEn).localeCompare(String(b.recibidoEn)));
  return lista;
}

function armarAvisoAtoradas(lista, horas) {
  const n = lista.length;
  const filas = lista.slice(0, 10).map((s) => [
    `Hace ${s.horasEspera} h`,
    [s.programa, s.empresa && s.empresa !== s.nombre ? s.empresa : s.nombre, s.correo].filter(Boolean).join(" — ") + ` (recibida ${fechaLocal(s.recibidoEn)})`,
  ]);
  if (n > 10) filas.push(["Y además", `${n - 10} más`]);
  const aviso = armarAviso({
    titulo: n === 1 ? "Una solicitud lleva más de " + horas + " h sin procesarse" : `${n} solicitudes llevan más de ${horas} h sin procesarse`,
    filas,
    enlace: "https://www.alfredopina.ai/admin",
    textoEnlace: "Abre el admin (Solicitudes): al entrar se procesan solas",
  });
  const asunto = n === 1 ? "Solicitud atorada: " + (lista[0].programa || "sin programa") : `${n} solicitudes atoradas`;
  return { asunto: asunto.slice(0, 150), ...aviso };
}

module.exports = { seleccionarAtoradas, armarAvisoAtoradas };
