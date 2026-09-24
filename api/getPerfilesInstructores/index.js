// getPerfilesInstructores/index.js
// Function protegida (rol "admin"): reseñas y estado de foto de cada
// instructor, para la pestaña Instructores del panel Diplomas.
const { getPerfilesInstructores } = require("../src/plantillas-storage");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context) {
  try {
    context.res = { status: 200, headers: JSON_HEADERS, body: { perfiles: await getPerfilesInstructores() } };
  } catch (err) {
    context.log.error("Error leyendo perfiles de instructores:", err.message);
    context.res = { status: 500, headers: JSON_HEADERS, body: { error: "No se pudieron cargar los perfiles." } };
  }
};
