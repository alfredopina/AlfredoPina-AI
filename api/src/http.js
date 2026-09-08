// Headers estándar de las Functions que regresan JSON — antes copiado literal
// en cada Function, ahora en un solo lugar para que un cambio futuro (ej. un
// header de seguridad nuevo) no dependa de tocar decenas de archivos iguales.
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

module.exports = { JSON_HEADERS };
