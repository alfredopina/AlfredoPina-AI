// api/rutas-publicas.js
// ÚNICA lista de Functions PÚBLICAS (sin sesión). Todo lo demás en /api/* es SOLO ADMIN por defecto: una Function nueva nace cerrada y
// da 401 hasta que se decida lo contrario. Para abrir una a propósito: agregarla aquí (con su motivo) y correr `node tools/generar-rutas.js`;
// los tests (`npm test`) comprueban que `staticwebapp.config.json` es exactamente lo que genera esta lista.
// (Auditoría A01-001, 2026-10-13/14: antes había que listar las ~150 rutas de admin y lo no listado quedaba abierto a internet.)
//
// `ruta` es el `route` de function.json (no siempre el nombre de la carpeta: getAvailability → "availability").
// Regla de costo: ninguna pública puede tocar la base SQL (ver api/test-regla-publico-sin-sql.js); única excepción: enviarResumenSemanal.
module.exports = [
  // ── formularios y envíos del público (escriben en colas de Table Storage; el admin las importa) ──
  { ruta: "crearSolicitudPublica", motivo: "Formulario de solicitud de cotización (cursos.html)" },
  { ruta: "enviarDiagnostico", motivo: "Envío del diagnóstico (solo con link/QR de cliente)" },
  { ruta: "enviarRespuesta", motivo: "Envío de la encuesta (solo con link/QR de grupo)" },
  { ruta: "confirmarVistaPropuesta", motivo: "Aviso de que el cliente abrió la propuesta" },
  { ruta: "responderPropuesta", motivo: "Aceptación de la propuesta en línea" },
  { ruta: "registrarEventoDiploma", motivo: "Clic en Agregar a LinkedIn (verificar.html)" },

  // ── lecturas públicas por código o catálogo ──
  { ruta: "getCatalogoCursos", motivo: "Catálogo público de cursos y programas" },
  { ruta: "getCatalogoRecursos", motivo: "Catálogo público de recursos" },
  { ruta: "getRecursos", motivo: "Descarga de materiales con código (con freno de intentos)" },
  { ruta: "availability", motivo: "Agenda: disponibilidad desde el calendario de Outlook (Function getAvailability)" },
  { ruta: "getPropuestaPublica", motivo: "Propuesta web por código" },
  { ruta: "verificarDiploma", motivo: "Verificación pública de diplomas (con freno de intentos)" },
  { ruta: "getDiplomasGrupoPublico", motivo: "Diplomas de un grupo por token" },
  { ruta: "getLinkEncuestaPublico", motivo: "Datos del link de una encuesta por token" },
  { ruta: "getPreguntasEncuesta", motivo: "Banco de preguntas de la encuesta" },
  { ruta: "getPreguntasDiagnostico", motivo: "Banco de preguntas del diagnóstico" },
  { ruta: "getReporteDiagnosticoPublico", motivo: "Reporte de diagnóstico publicado, por código" },
  { ruta: "getReporteEncuestaPublico", motivo: "Reporte de encuesta publicado, por código" },
  { ruta: "getReporteCalificacionesPublico", motivo: "Reporte de resultados publicado, por código" },

  // ── imágenes públicas (firmas, fotos y logos que se ven en diplomas y reportes) ──
  { ruta: "getFirmaPublica", motivo: "Firma del instructor en el diploma" },
  { ruta: "getFotoInstructor", motivo: "Foto del instructor en la verificación de diplomas" },
  { ruta: "getFotoGrupoReporte", motivo: "Foto final del grupo en el reporte de resultados" },
  { ruta: "getLogoIntermediario", motivo: "Logo del socio comercial en diplomas y reportes" },

  // ── tareas programadas (cron de GitHub Actions; protegidas por el secreto x-backup-secret, no por sesión) ──
  { ruta: "respaldoAutomatico", motivo: "Respaldo semanal de Table Storage (cron)" },
  { ruta: "notificarSolicitudesAtoradas", motivo: "Aviso de solicitudes atoradas (cron)" },
  { ruta: "enviarResumenSemanal", motivo: "Resumen semanal por correo (cron; única pública que toca SQL, 1 vez por semana)" },
];
