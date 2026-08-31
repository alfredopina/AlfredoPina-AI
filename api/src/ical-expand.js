// ical-expand.js
// Convierte el objeto que devuelve node-ical (data[uid] = VEVENT, con eventos
// recurrentes expresados como ev.rrule + ev.recurrences para las excepciones)
// en una lista plana de instancias concretas dentro de una ventana de fechas:
// [{ start: Date, end: Date, summary, categories }, ...]
//
// Se probó con datos sintéticos con la misma forma que node-ical (ver
// test-availability.js) — no depende de node-ical en sí, así que es fácil de
// probar sin red ni de la librería real.

function expandEvent(ev, windowStart, windowEnd) {
  const instances = [];

  if (!ev.start || !ev.end) return instances;
  const duration = ev.end.getTime() - ev.start.getTime();

  if (ev.rrule) {
    // Eventos recurrentes: node-ical expone ev.rrule como instancia de RRule (paquete "rrule"),
    // con .between(after, before, inclusive) para obtener las fechas de inicio de cada ocurrencia.
    const occurrenceStarts = ev.rrule.between(windowStart, windowEnd, true);

    const exdates = new Set(
      (ev.exdate ? Object.values(ev.exdate) : []).map((d) => d.toISOString())
    );

    for (const occStart of occurrenceStarts) {
      if (exdates.has(occStart.toISOString())) continue;

      // node-ical guarda las excepciones/modificaciones de una ocurrencia puntual
      // en ev.recurrences, indexadas por la fecha ISO (o "YYYY-MM-DD") de la ocurrencia original.
      const key1 = occStart.toISOString();
      const key2 = occStart.toISOString().slice(0, 10);
      const override = (ev.recurrences && (ev.recurrences[key1] || ev.recurrences[key2])) || null;

      if (override) {
        instances.push({
          start: override.start,
          end: override.end,
          summary: override.summary != null ? override.summary : ev.summary,
          categories: override.categories != null ? override.categories : ev.categories,
        });
      } else {
        instances.push({
          start: occStart,
          end: new Date(occStart.getTime() + duration),
          summary: ev.summary,
          categories: ev.categories,
        });
      }
    }
  } else {
    // Evento único (no recurrente).
    if (ev.end > windowStart && ev.start < windowEnd) {
      instances.push({ start: ev.start, end: ev.end, summary: ev.summary, categories: ev.categories });
    }
  }

  return instances;
}

/** data: objeto devuelto por node-ical (fromURL/parseICS). Regresa instancias de TODOS los VEVENT en la ventana. */
function expandAllEvents(data, windowStart, windowEnd) {
  const instances = [];
  for (const key of Object.keys(data)) {
    const ev = data[key];
    if (!ev || ev.type !== "VEVENT") continue;
    instances.push(...expandEvent(ev, windowStart, windowEnd));
  }
  return instances;
}

module.exports = { expandEvent, expandAllEvents };
