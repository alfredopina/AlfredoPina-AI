// availability-logic.js
// Lógica pura (sin dependencias de Azure Functions ni de red) para poder
// probarla localmente con datos sintéticos. La Function real (getAvailability.js)
// solo hace fetch del .ics y le pasa los eventos ya parseados a extractSlots().

/**
 * Busca una etiqueta reconocida entre corchetes al inicio del título del evento.
 * Ej: "[EXCEL] Cliente ABC - Grupo 3" -> "EXCEL"
 * Si no hay etiqueta o no está en la lista blanca (config.categories), regresa null.
 * Esto es lo único que la Function "lee" del título real — todo lo demás se descarta.
 */
function extractWhitelistedTag(summary, config) {
  if (!summary || typeof summary !== "string") return null;
  const match = summary.match(/^\s*\[([A-Z0-9_]+)\]/);
  if (!match) return null;
  const tag = match[1];
  return Object.prototype.hasOwnProperty.call(config.categories, tag) ? tag : null;
}

/** true si el evento trae la categoría de Outlook "Presencial" (config.presencialBuffer.categoryName). */
function isPresencial(categories, config) {
  const name = config.presencialBuffer.categoryName;
  if (!categories) return false;
  if (Array.isArray(categories)) return categories.includes(name);
  return String(categories).includes(name);
}

function toMinutesOfDay(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Convierte componentes de fecha/hora en "hora local" (según config.utcOffsetHours,
 * offset fijo, ver nota en agenda-config.json) al instante UTC absoluto real.
 * Se usa esto en vez de los métodos de Date basados en la zona horaria del servidor,
 * porque una Azure Function normalmente corre en UTC sin importar dónde vive Alfredo.
 */
function localToUTC(y, m, d, hh, mm, offsetHours) {
  return new Date(Date.UTC(y, m, d, hh, mm) - offsetHours * 3600000);
}

/** Instante UTC -> componentes de fecha/hora "locales" (según el mismo offset fijo). */
function utcToLocalParts(utcDate, offsetHours) {
  const shifted = new Date(utcDate.getTime() + offsetHours * 3600000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * Medianoche local (instante UTC) del LUNES de la semana que contiene refDate.
 * Se usa para anclar la generación del grid semanal siempre al inicio de la
 * semana en curso — antes se anclaba a "ahora", así que en cuanto pasaba la
 * medianoche el día que ya había transcurrido (ej. martes) desaparecía por
 * completo de la vista semanal en vez de quedarse marcado como "ya pasó".
 * Como utcOffsetHours es fijo todo el año (sin horario de verano en Zona
 * Centro), restar días en milisegundos sobre la medianoche local es válido.
 */
function mondayOfWeekUTC(refDate, offsetHours) {
  const parts = utcToLocalParts(refDate, offsetHours);
  const localMidnightUTC = localToUTC(parts.year, parts.month, parts.day, 0, 0, offsetHours);
  const daysSinceMonday = (parts.weekday + 6) % 7; // lunes=0 ... domingo=6
  return new Date(localMidnightUTC.getTime() - daysSinceMonday * 86400000);
}

/**
 * Convierte una lista de "eventos" ya resueltos a instancias concretas
 * ({ start: Date, end: Date, summary, categories }) en intervalos ocupados
 * sanitizados: { start, end, tag, isPresencial }. Aplica el buffer de 45 min
 * antes/después a los eventos "Presencial".
 */
function buildBusyIntervals(eventInstances, config) {
  const intervals = [];
  for (const ev of eventInstances) {
    const tag = extractWhitelistedTag(ev.summary, config);
    const presencial = isPresencial(ev.categories, config);
    let start = ev.start;
    let end = ev.end;
    if (presencial) {
      start = new Date(start.getTime() - config.presencialBuffer.minutesBefore * 60000);
      end = new Date(end.getTime() + config.presencialBuffer.minutesAfter * 60000);
    }
    intervals.push({ start, end, tag, isPresencial: presencial });
  }
  return intervals;
}

/** Fecha (solo año-mes-día) en formato YYYY-MM-DD a partir de un Date construido con Date.UTC(y,m,d). */
function toDateStr(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Arma el grid de slots (duración = config.slotMinutes, por defecto 1 hora) entre
 * startDate y endDate (inclusive de startDate,
 * exclusive de endDate), aplicando: días cerrados y los intervalos
 * ocupados ya sanitizados (con tag/color, nunca texto libre). Ya no hay una
 * regla especial de viernes — Alfredo lo bloquea directo desde Outlook.
 *
 * Nota de timezone: se asume que "startDate"/"endDate" y las horas de trabajo del
 * config están en la misma zona (America/Monterrey, offset fijo, ver config). Los
 * intervalos ocupados (busyIntervals) deben venir como instantes UTC absolutos
 * (Date), igual que devuelve node-ical al parsear el .ics.
 *
 * nowDate (opcional): si se pasa, cada slot lleva un campo "isPast" (true si
 * su hora de inicio ya quedó atrás respecto a nowDate). No cambia qué días o
 * slots se generan — startDate ya puede ser anterior a "ahora" (típicamente
 * el lunes de la semana en curso, ver mondayOfWeekUTC) para que los días ya
 * transcurridos de esta semana se sigan mostrando, solo marcados como no
 * reservables en vez de desaparecer del grid.
 */
function buildSlotGrid(startDate, endDate, config, busyIntervals, nowDate) {
  const days = [];
  const offset = config.utcOffsetHours;
  const startParts = utcToLocalParts(startDate, offset);

  // y/m/d representan un DÍA CALENDARIO local (no un instante) — se avanzan de 1 en 1 y
  // se renormalizan pasándolos por Date.UTC en cada vuelta (JS resuelve el overflow solo,
  // ej. día 32 de un mes de 31 se convierte en el día 1 del mes siguiente).
  let y = startParts.year;
  let m = startParts.month;
  let d = startParts.day;

  while (true) {
    const calendarDate = new Date(Date.UTC(y, m, d));
    const dayLocalMidnightUTC = localToUTC(y, m, d, 0, 0, offset);
    if (dayLocalMidnightUTC >= endDate) break;

    const weekday = calendarDate.getUTCDay();

    if (!config.closedWeekdays.includes(weekday)) {
      const dayStartMin = toMinutesOfDay(config.workingHours.start);
      const dayEndMin = toMinutesOfDay(config.workingHours.end);
      const slots = [];

      for (let mins = dayStartMin; mins < dayEndMin; mins += config.slotMinutes) {
        const hh = Math.floor(mins / 60);
        const mm = mins % 60;
        const slotStart = localToUTC(y, m, d, hh, mm, offset);
        const slotEnd = new Date(slotStart.getTime() + config.slotMinutes * 60000);

        const overlap = busyIntervals.find((iv) => iv.start < slotEnd && iv.end > slotStart);

        let status, tag, label, color;
        if (overlap) {
          status = "busy";
          tag = overlap.tag;
          if (tag && config.categories[tag]) {
            label = config.categories[tag].label;
            color = config.categories[tag].color;
          } else {
            label = config.defaultBusyLabel;
            color = config.defaultBusyColor;
          }
        } else {
          status = "free";
          tag = null;
          label = "Disponible";
          color = null;
        }

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          status,
          tag,
          label,
          color,
          isPast: nowDate ? slotStart < nowDate : false,
        });
      }

      days.push({ date: toDateStr(calendarDate), weekday, slots });
    }

    d += 1;
  }

  return days;
}

/** Punto de entrada de la lógica pura: eventInstances ya resueltos -> grid de días. */
function computeAvailability(eventInstances, config, startDate, endDate, nowDate) {
  const busyIntervals = buildBusyIntervals(eventInstances, config);
  return buildSlotGrid(startDate, endDate, config, busyIntervals, nowDate);
}

module.exports = {
  extractWhitelistedTag,
  isPresencial,
  buildBusyIntervals,
  buildSlotGrid,
  computeAvailability,
  mondayOfWeekUTC,
};
