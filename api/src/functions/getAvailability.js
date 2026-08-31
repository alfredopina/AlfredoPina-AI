// getAvailability.js
// Azure Function (v4 programming model, HTTP GET, anónima) que:
//   1. Lee el link .ics secreto desde la variable de entorno OUTLOOK_ICS_URL
//      (nunca desde el repo, nunca desde el navegador).
//   2. Descarga y parsea el calendario con node-ical.
//   3. Extrae SOLO la etiqueta whitelisteada entre corchetes de cada título
//      (ej. "[EXCEL]") — descarta todo lo demás del título real.
//   4. Aplica las reglas de agenda-config.json (horario, viernes, buffer Presencial).
//   5. Regresa un grid de slots ya sanitizado — el navegador nunca ve el .ics crudo
//      ni el título real de ningún evento.

const { app } = require("@azure/functions");
const ical = require("node-ical");
const config = require("../../config/agenda-config.json");
const { expandAllEvents } = require("../ical-expand");
const { computeAvailability } = require("../availability-logic");

app.http("getAvailability", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "availability",
  handler: async (request, context) => {
    const icsUrl = process.env.OUTLOOK_ICS_URL;

    if (!icsUrl) {
      context.error("OUTLOOK_ICS_URL no está configurada como Environment variable.");
      return {
        status: 500,
        jsonBody: { error: "El calendario no está configurado todavía. Intenta más tarde." },
      };
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + config.icsFetchWindowDays * 24 * 60 * 60 * 1000);

    let data;
    try {
      data = await ical.async.fromURL(icsUrl);
    } catch (err) {
      context.error("Error al leer/parsear el .ics publicado", err);
      return {
        status: 502,
        jsonBody: { error: "No se pudo leer el calendario en este momento." },
      };
    }

    try {
      const eventInstances = expandAllEvents(data, now, windowEnd);
      const days = computeAvailability(eventInstances, config, now, windowEnd);

      return {
        status: 200,
        jsonBody: {
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
        headers: { "Cache-Control": "public, max-age=120" },
      };
    } catch (err) {
      context.error("Error al calcular disponibilidad a partir del .ics", err);
      return {
        status: 500,
        jsonBody: { error: "Ocurrió un problema al calcular la disponibilidad." },
      };
    }
  },
});
