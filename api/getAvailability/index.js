// getAvailability/index.js
// Azure Function (modelo v3 — function.json + index.js, el modelo con soporte
// garantizado en "managed functions" de Azure Static Web Apps) que:
//   1. Lee el link .ics secreto desde la variable de entorno OUTLOOK_ICS_URL
//      (nunca desde el repo, nunca desde el navegador).
//   2. Descarga y parsea el calendario con node-ical.
//   3. Extrae SOLO la etiqueta whitelisteada entre corchetes de cada título
//      (ej. "[EXCEL]") — descarta todo lo demás del título real.
//   4. Aplica las reglas de agenda-config.json (horario, viernes, buffer Presencial).
//   5. Regresa un grid de slots ya sanitizado — el navegador nunca ve el .ics crudo
//      ni el título real de ningún evento.
//
// Nota: se migró del modelo v4 (app.http) a este modelo v3 porque el proyecto
// se despliega como "managed functions" dentro de Azure Static Web Apps, y ese
// hosting específico dio "Backend call failure" con el modelo v4 pese a que el
// build de Oryx terminaba en verde — el modelo v3 (carpeta + function.json) es
// el que sí está soportado sin ambigüedad en ese escenario.

const ical = require("node-ical");
const config = require("../config/agenda-config.json");
const { expandAllEvents } = require("../src/ical-expand");
const { computeAvailability } = require("../src/availability-logic");

module.exports = async function (context, req) {
  const icsUrl = process.env.OUTLOOK_ICS_URL;

  if (!icsUrl) {
    context.log.error("OUTLOOK_ICS_URL no está configurada como Environment variable.");
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: "El calendario no está configurado todavía. Intenta más tarde." },
    };
    return;
  }

  const now = new Date();
  const windowEnd = new Date(now.getTime() + config.icsFetchWindowDays * 24 * 60 * 60 * 1000);

  let data;
  try {
    data = await ical.async.fromURL(icsUrl);
  } catch (err) {
    context.log.error("Error al leer/parsear el .ics publicado", err);
    context.res = {
      status: 502,
      headers: { "Content-Type": "application/json" },
      body: { error: "No se pudo leer el calendario en este momento." },
    };
    return;
  }

  try {
    const eventInstances = expandAllEvents(data, now, windowEnd);
    const days = computeAvailability(eventInstances, config, now, windowEnd);

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120",
      },
      body: {
        generatedAt: now.toISOString(),
        timezone: config.timezone,
        slotMinutes: config.slotMinutes,
        workingHours: config.workingHours,
        categories: config.categories,
        fridayRestriction: {
          onlyTag: config.fridayRestriction.onlyTag,
          onlyLabel: config.fridayRestriction.onlyLabel,
        },
        days,
      },
    };
  } catch (err) {
    context.log.error("Error al calcular disponibilidad a partir del .ics", err);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: "Ocurrió un problema al calcular la disponibilidad." },
    };
  }
};
