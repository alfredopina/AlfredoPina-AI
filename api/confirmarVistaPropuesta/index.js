// confirmarVistaPropuesta/index.js
// Function PÚBLICA: propuesta.html la llama UNA vez, cuando el cliente lleva ~8 s con la propuesta abierta y visible.
// La PRIMERA confirmación de cada propuesta manda un correo a Alfredo ("Abrieron tu propuesta"); las siguientes no
// hacen nada. Se confirma desde la página (no al pedir los datos) porque los filtros de seguridad de correo corporativo
// abren los links solos y daban falsos avisos. Nunca toca SQL. El admin y los robots de vista previa no cuentan.
const { getPropuestasTable, confirmarVistaCliente } = require("../src/propuestas");
const { CODIGO_CORTO_RE } = require("../src/codigo-corto");
const { esAdmin, esBot } = require("../src/verif-cliente");
const { enviarCorreo, armarAviso, fechaLocal } = require("../src/notificaciones-correo");
const { JSON_HEADERS } = require("../src/http");

module.exports = async function (context, req) {
  const ok = { status: 200, headers: JSON_HEADERS, body: { ok: true } };
  const codigo = String((req.body && req.body.codigo) || "").trim().toLowerCase();
  if (!CODIGO_CORTO_RE.test(codigo)) {
    context.res = { status: 400, headers: JSON_HEADERS, body: { error: "Falta el código de la propuesta." } };
    return;
  }
  if (esAdmin(req) || esBot(req)) {
    context.res = ok;
    return;
  }
  try {
    const r = await confirmarVistaCliente(getPropuestasTable(), codigo);
    if (r && r.primera) {
      const s = r.snapshot;
      const aviso = armarAviso({
        titulo: "Abrieron tu propuesta",
        filas: [
          ["Propuesta", `${s.folio} — ${s.programa}`],
          ["Cliente", s.cliente],
          ["Contacto", s.contacto],
          ["Primera vez que la vieron", fechaLocal(r.vivo.vistaConfirmadaEn)],
          ["Aperturas hasta ahora", r.vivo.vistas],
        ],
        enlace: `https://www.alfredopina.ai/propuesta/${codigo}`,
        textoEnlace: "Ver la propuesta",
      });
      await enviarCorreo({ tipo: "propuestaAbierta", asunto: `Abrieron tu propuesta: ${s.folio} — ${s.cliente}`.slice(0, 150), ...aviso });
    }
  } catch (err) {
    context.log.error("Error confirmando la vista de la propuesta:", err.message);
  }
  context.res = ok;
};
