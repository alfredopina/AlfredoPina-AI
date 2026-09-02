// test-availability.js
// Prueba local, sin red: genera un .ics sintético (con evento normal, evento
// Presencial con buffer, evento sin etiqueta reconocida, y un evento recurrente
// con una excepción EXDATE), lo parsea con node-ical.sync.parseICS y corre el
// mismo pipeline que usa la Function real (ical-expand + availability-logic),
// para verificar antes de entregar que:
//   1. Solo se exponen etiquetas de la lista blanca (config.categories).
//   2. Un evento sin etiqueta reconocida cae a "Ocupado" genérico (nunca texto libre).
//   3. El buffer de 45 min se aplica correctamente alrededor de eventos "Presencial".
//   4. El viernes se genera igual que cualquier otro día (ya no hay regla especial de sitio —
//      Alfredo lo bloquea directo desde Outlook cuando lo necesita).
//   5. Los eventos recurrentes semanales se expanden y las EXDATE se respetan.

const ical = require("node-ical");
const config = require("./config/agenda-config.json");
const { expandAllEvents } = require("./src/ical-expand");
const { computeAvailability, extractWhitelistedTag, buildSlotGrid, mondayOfWeekUTC } = require("./src/availability-logic");

function fmtUTC(d) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// Offset fijo del config: local (Monterrey) = UTC - 6 => UTC = local + 6h.
const OFFSET_MS = -config.utcOffsetHours * 60 * 60 * 1000; // = +6h en ms

function localToUTC(daysFromNow, hh, mm) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hh, mm, 0, 0);
  return new Date(d.getTime() + OFFSET_MS);
}

// --- localizar el próximo lunes, martes, miércoles, jueves y viernes a partir de hoy ---
function nextWeekday(targetDow) {
  const d = new Date();
  const cur = d.getUTCDay();
  let diff = (targetDow - cur + 7) % 7;
  if (diff === 0) diff = 7; // siempre un día futuro, no hoy, para simplificar
  return diff;
}

const monOffset = nextWeekday(1);
const tueOffset = nextWeekday(2);
const wedOffset = nextWeekday(3);
const thuOffset = nextWeekday(4);
const friOffset = nextWeekday(5);

// Evento 1: normal, con etiqueta reconocida [EXCEL], sin Presencial.
const ev1Start = localToUTC(monOffset, 10, 0);
const ev1End = localToUTC(monOffset, 11, 30);

// Evento 2: Presencial, con etiqueta [POWERBI] -> debe llevar buffer de 45 min.
const ev2Start = localToUTC(tueOffset, 14, 0);
const ev2End = localToUTC(tueOffset, 15, 0);

// Evento 3: sin etiqueta reconocida -> debe caer a "Ocupado" genérico.
const ev3Start = localToUTC(wedOffset, 9, 0);
const ev3End = localToUTC(wedOffset, 9, 30);

// Evento 4: recurrente semanal los jueves [REUNION], 4 ocurrencias, con una EXDATE.
const ev4Start = localToUTC(thuOffset, 8, 0);
const ev4End = localToUTC(thuOffset, 8, 30);
const ev4ExDate = new Date(ev4Start.getTime() + 7 * 24 * 60 * 60 * 1000); // salta la 2a ocurrencia

// Evento 5 (control): viernes, libre en el .ics real (no se agenda nada) -> el sitio
// debe mostrarlo como un día libre normal, igual que cualquier otro (ya no hay regla
// especial de viernes). No se necesita evento en el ICS para esto.
void friOffset;

const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//ES
BEGIN:VEVENT
UID:ev1@test
DTSTAMP:${fmtUTC(new Date())}
DTSTART:${fmtUTC(ev1Start)}
DTEND:${fmtUTC(ev1End)}
SUMMARY:[EXCEL] Cliente ABC - Grupo 3
END:VEVENT
BEGIN:VEVENT
UID:ev2@test
DTSTAMP:${fmtUTC(new Date())}
DTSTART:${fmtUTC(ev2Start)}
DTEND:${fmtUTC(ev2End)}
SUMMARY:[POWERBI] Cliente XYZ - Sesion 2
CATEGORIES:Presencial
END:VEVENT
BEGIN:VEVENT
UID:ev3@test
DTSTAMP:${fmtUTC(new Date())}
DTSTART:${fmtUTC(ev3Start)}
DTEND:${fmtUTC(ev3End)}
SUMMARY:Consultoria interna sin etiqueta
END:VEVENT
BEGIN:VEVENT
UID:ev4@test
DTSTAMP:${fmtUTC(new Date())}
DTSTART:${fmtUTC(ev4Start)}
DTEND:${fmtUTC(ev4End)}
SUMMARY:[REUNION] Standup semanal
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE:${fmtUTC(ev4ExDate)}
END:VEVENT
END:VCALENDAR
`;

const data = ical.sync.parseICS(icsContent);

const now = new Date();
// Igual que getAvailability/index.js: la ventana arranca en el lunes de la
// semana en curso, no en "ahora", para que la semana completa se genere
// aunque algunos de sus días ya hayan pasado (ver mondayOfWeekUTC).
const windowStart = mondayOfWeekUTC(now, config.utcOffsetHours);
const windowEnd = new Date(now.getTime() + config.icsFetchWindowDays * 24 * 60 * 60 * 1000);

const instances = expandAllEvents(data, windowStart, windowEnd);
const days = computeAvailability(instances, config, windowStart, windowEnd, now);

// ---------------- Verificaciones ----------------
let failures = 0;
function check(label, cond) {
  console.log((cond ? "OK   " : "FALLO") + " - " + label);
  if (!cond) failures++;
}

function findDay(offsetFromNow) {
  const target = new Date();
  target.setUTCHours(0, 0, 0, 0);
  target.setUTCDate(target.getUTCDate() + offsetFromNow);
  const y = target.getFullYear(), m = String(target.getMonth() + 1).padStart(2, "0"), d = String(target.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;
  return days.find((dd) => dd.date === dateStr);
}

function slotAt(day, hh, mm) {
  return day.slots.find((s) => {
    // reconstruir la hora local del slot a partir de su instante UTC y el offset fijo
    const utc = new Date(s.start);
    const localMs = utc.getTime() - OFFSET_MS;
    const localD = new Date(localMs);
    return localD.getUTCHours() === hh && localD.getUTCMinutes() === mm;
  });
}

check("extractWhitelistedTag reconoce [EXCEL]", extractWhitelistedTag("[EXCEL] Cliente ABC", config) === "EXCEL");
check("extractWhitelistedTag descarta etiqueta no listada", extractWhitelistedTag("[NOEXISTE] algo", config) === null);
check("extractWhitelistedTag regresa null sin corchetes", extractWhitelistedTag("Reunion normal", config) === null);

const dayMon = findDay(monOffset);
check("Se genera el día del evento 1 (lunes)", !!dayMon);
if (dayMon) {
  const s1000 = slotAt(dayMon, 10, 0);
  const s1100 = slotAt(dayMon, 11, 0);
  const s1200 = slotAt(dayMon, 12, 0);
  check("10:00 lunes = busy EXCEL", s1000 && s1000.status === "busy" && s1000.tag === "EXCEL" && s1000.color === "#22c55e");
  check("11:00 lunes = busy EXCEL (evento termina 11:30)", s1100 && s1100.status === "busy" && s1100.tag === "EXCEL");
  check("12:00 lunes = free (fuera del evento)", s1200 && s1200.status === "free");
}

const dayTue = findDay(tueOffset);
check("Se genera el día del evento 2 (martes, Presencial)", !!dayTue);
if (dayTue) {
  // El buffer empieza en 13:15 local (14:00 - 45min) y termina 15:45 (15:00 + 45min),
  // pero el grid está alineado a slots de 1 HORA desde las 07:00 — cualquier slot que
  // el buffer toque, aunque sea parcialmente, se marca ocupado completo (efecto de
  // "redondeo" al bloque de hora, esperado con esta granularidad).
  const s1200 = slotAt(dayTue, 12, 0); // 12:00-13:00, termina antes de que arranque el buffer (13:15) -> libre
  const s1300 = slotAt(dayTue, 13, 0); // 13:00-14:00 se traslapa con el buffer previo (13:15-15:45) -> ocupado
  const s1500 = slotAt(dayTue, 15, 0); // 15:00-16:00 se traslapa con el buffer posterior -> ocupado
  const s1600 = slotAt(dayTue, 16, 0); // 16:00-17:00, ya pasó el buffer (termina 15:45) -> libre
  check("12:00 martes = free (justo antes de que arranque el buffer)", s1200 && s1200.status === "free");
  check("13:00 martes = busy POWERBI (el slot se traslapa con el buffer previo)", s1300 && s1300.status === "busy" && s1300.tag === "POWERBI");
  check("15:00 martes = busy POWERBI (el slot se traslapa con el buffer posterior)", s1500 && s1500.status === "busy" && s1500.tag === "POWERBI");
  check("16:00 martes = free (ya pasó el buffer)", s1600 && s1600.status === "free");
}

const dayWed = findDay(wedOffset);
check("Se genera el día del evento 3 (miércoles, sin etiqueta)", !!dayWed);
if (dayWed) {
  const s0900 = slotAt(dayWed, 9, 0);
  check("09:00 miércoles = busy genérico (sin tag, sin texto libre expuesto)", s0900 && s0900.status === "busy" && s0900.tag === null && s0900.label === config.defaultBusyLabel);
}

const dayThu1 = findDay(thuOffset);
check("Jueves 1 (con evento REUNION recurrente) existe", !!dayThu1);
if (dayThu1) {
  const s0800 = slotAt(dayThu1, 8, 0);
  check("08:00 jueves 1 = busy REUNION", s0800 && s0800.status === "busy" && s0800.tag === "REUNION");
}
const dayThu2 = findDay(thuOffset + 7);
check("Jueves 2 (saltado por EXDATE) existe", !!dayThu2);
if (dayThu2) {
  const s0800b = slotAt(dayThu2, 8, 0);
  check("08:00 jueves 2 = free (EXDATE respetada, no se agendó)", s0800b && s0800b.status === "free");
}
const dayThu3 = findDay(thuOffset + 14);
if (dayThu3) {
  const s0800c = slotAt(dayThu3, 8, 0);
  check("08:00 jueves 3 = busy REUNION (recurrencia sigue funcionando tras la EXDATE)", s0800c && s0800c.status === "busy" && s0800c.tag === "REUNION");
}

const dayFri = findDay(friOffset);
check("Viernes existe en el grid (no está en closedWeekdays)", !!dayFri);
if (dayFri) {
  const anyFriSlot = dayFri.slots[0];
  check("Un slot libre de viernes es 'Disponible' normal (ya no hay regla especial)", anyFriSlot && anyFriSlot.status === "free" && anyFriSlot.tag === null && anyFriSlot.label === "Disponible");
}

const daySat = days.find((d) => d.weekday === 6);
const daySun = days.find((d) => d.weekday === 0);
check("Sábado NUNCA aparece en el grid (cerrado)", !daySat);
check("Domingo NUNCA aparece en el grid (cerrado)", !daySun);

// ---- Fix "el día que desaparece": la ventana siempre arranca en lunes ----
check("El primer día generado es siempre lunes (ventana anclada al lunes de la semana en curso, no a 'ahora')", days.length > 0 && days[0].weekday === 1);
check("Todos los slots del lunes traen el campo isPast (boolean)", days[0] && days[0].slots.length > 0 && days[0].slots.every((s) => typeof s.isPast === "boolean"));

// ---- isPast: prueba aislada con un "ahora" fijo (lunes 12:00 hora Monterrey),
// para no depender de la hora real a la que se corra este script.
const fixedMonday = mondayOfWeekUTC(new Date(), config.utcOffsetHours);
const fixedNoon = new Date(fixedMonday.getTime() + 12 * 60 * 60 * 1000); // lunes 12:00 local
const fixedWeekEnd = new Date(fixedMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
const isPastDays = buildSlotGrid(fixedMonday, fixedWeekEnd, config, [], fixedNoon);
const isPastMonday = isPastDays.find((d) => d.weekday === 1);
function isPastSlotAt(day, hh) {
  return day.slots.find((s) => {
    const utc = new Date(s.start);
    const localMs = utc.getTime() + config.utcOffsetHours * 3600000;
    return new Date(localMs).getUTCHours() === hh;
  });
}
if (isPastMonday) {
  const before = isPastSlotAt(isPastMonday, 9);  // 09:00, antes del "ahora" fijo (12:00)
  const after = isPastSlotAt(isPastMonday, 14);  // 14:00, después del "ahora" fijo
  check("Slot de las 09:00 (antes del 'ahora' fijo de las 12:00) queda isPast=true", before && before.isPast === true);
  check("Slot de las 14:00 (después del 'ahora' fijo de las 12:00) queda isPast=false", after && after.isPast === false);
} else {
  check("Se pudo generar el lunes en la prueba aislada de isPast", false);
}

console.log("\n" + (failures === 0 ? `TODO OK (${days.length} días generados)` : `${failures} verificación(es) fallida(s)`));
process.exit(failures === 0 ? 0 : 1);
