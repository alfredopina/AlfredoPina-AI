// Alta y edición MANUAL de Solicitudes (el formulario Crear/Modificar del admin). Toda la lógica de negocio vive
// aquí, sobre un `nuevaRequest` (() => Request ligado a una transacción) para poder probarla sin base de datos
// y para que cliente + contacto + solicitud se guarden juntos o no se guarde nada.
//
// Reglas (decididas con Alfredo 2026-10-08):
//   - ¿Es cliente? sí → se elige un Cliente existente (clienteId). No → es un Prospecto: nombre + código
//     (3 letras sugeridas, editables). El código NUNCA se reutiliza en silencio: si ya existe, 409.
//   - Contacto: se elige uno del cliente (contacto_id), o se captura uno nuevo (contacto_datos). Un Prospecto
//     necesita al menos correo o WhatsApp. Editar un Prospecto puede corregir su nombre, código y contacto.
//   - Editar y cambiar de Prospecto a un Cliente existente: la solicitud se re-apunta, el formulario manda el contacto
//     del prospecto como contacto NUEVO del cliente (contacto_datos) y el Prospecto viejo (con su contacto) se borra
//     SOLO si quedó vacío.
//   - Participantes/modalidad como el formulario público; un número exacto se traduce al rango de la columna
//     (CHECK de sql/007) y el número viaja en los comentarios como una línea "Participantes: N".
//   - "Recibida el" (opcional) fija fecha_creacion: una llamada capturada tarde no debe verse como lenta.
//   - Objetivo/alcance/dirigido a solo existen en personalizado (el estándar los trae de su programa).
const { sql } = require("./backoffice-db");
const { limpiarCodigo } = require("./cliente-resolver");
const { contarBloqueos } = require("./cliente-dependencias");
const { HERRAMIENTAS } = require("./herramientas");

const TEMARIO_TIPOS = ["estandar", "personalizado"];
const MODALIDADES = ["Online", "Presencial", "Híbrido"];
const PARTICIPANTES_OPCIONES = ["Solo yo", "5 a 10", "10 a 15", "Más de 15"];

const falla = (status, mensaje) => Object.assign(new Error(mensaje), { status, safe: true });

// El formulario ofrece rangos y también deja escribir un número. La columna Solicitud.participantes solo acepta los
// 4 rangos, así que un número se traduce al rango que le toca y el dato exacto viaja en las notas. De 2 a 4
// personas ningún rango aplica: la columna queda vacía y el número, en notas. null = valor no válido.
function mapearParticipantes(raw) {
  if (PARTICIPANTES_OPCIONES.includes(raw)) return { columna: raw, nota: null };
  const m = String(raw).match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 5000) return null;
  const nota = "Participantes: " + n;
  if (n === 1) return { columna: "Solo yo", nota: null };
  if (n >= 5 && n <= 10) return { columna: "5 a 10", nota };
  if (n >= 11 && n <= 15) return { columna: "10 a 15", nota };
  if (n > 15) return { columna: "Más de 15", nota };
  return { columna: null, nota };
}

// Deja en las notas UNA sola línea "Participantes: N" (la quita si ya estaba, la pone si hace falta).
function aplicarNotaParticipantes(notas, nota) {
  const sin = String(notas || "").split("\n").filter((l) => !/^\s*Participantes:\s*\d+\s*$/.test(l)).join("\n").trim();
  return [sin, nota].filter(Boolean).join("\n") || null;
}

function normalizar(body) {
  const herramienta = String(body.herramienta || "").trim().toLowerCase();
  if (!HERRAMIENTAS.includes(herramienta)) throw falla(400, "Herramienta inválida.");
  const temarioTipo = String(body.temario_tipo || "").trim();
  if (!TEMARIO_TIPOS.includes(temarioTipo)) throw falla(400, "El tipo de programa debe ser estándar o personalizado.");
  const temarioNombre = String(body.temario_nombre || "").trim() || null;
  if (temarioTipo === "estandar" && !temarioNombre) throw falla(400, "Falta el programa.");
  const temas = Array.isArray(body.temas) ? body.temas : [];
  if (!temas.length) throw falla(400, temarioTipo === "estandar" ? "Falta el desglose de temas." : "Selecciona al menos un tema.");
  const horas = Math.round(Number(body.horas_totales) * 10) / 10;
  if (!Number.isFinite(horas) || horas <= 0 || horas > 9999) throw falla(400, "Las horas no son válidas.");

  const modalidad = String(body.modalidad || "").trim() || null;
  if (modalidad && !MODALIDADES.includes(modalidad)) throw falla(400, "Modalidad inválida.");
  const partRaw = String(body.participantes === undefined || body.participantes === null ? "" : body.participantes).trim();
  let part = { columna: null, nota: null };
  if (partRaw) {
    part = mapearParticipantes(partRaw);
    if (!part) throw falla(400, "El número de participantes no es válido.");
  }
  const notas = aplicarNotaParticipantes(String(body.notas || "").trim().slice(0, 4000), part.nota);

  const personalizado = temarioTipo === "personalizado";
  const texto = (v) => (personalizado ? String(v || "").trim().slice(0, 4000) || null : null);
  // proyectos elegidos (solo personalizado; el estándar trae los de su programa): foto de id/nombre/resumen
  const proyectos = personalizado && Array.isArray(body.proyectos)
    ? body.proyectos.filter((p) => p && p.id).slice(0, 12).map((p) => ({ id: String(p.id), nombre: String(p.nombre || "").slice(0, 200), resumen: String(p.resumen || "").slice(0, 600) }))
    : [];

  let recibida = null;
  if (body.recibida_el) {
    recibida = new Date(body.recibida_el);
    if (Number.isNaN(recibida.getTime())) throw falla(400, "La fecha en que llegó no es válida.");
    if (recibida.getTime() > Date.now() + 5 * 60 * 1000) throw falla(400, "La fecha en que llegó no puede ser futura.");
  }

  const esCliente = !!body.es_cliente;
  const empresa = body.empresa || {};
  const clienteId = empresa.clienteId ? Number(empresa.clienteId) : null;
  const nombre = String(empresa.nombre || "").trim().slice(0, 200);
  const codigo = limpiarCodigo(empresa.codigo);
  if (esCliente && !clienteId) throw falla(400, "Selecciona un cliente de la lista.");
  if (!esCliente && (!nombre || !codigo)) throw falla(400, "Escribe el nombre y el código del prospecto.");

  const contactoId = body.contacto_id ? Number(body.contacto_id) : null;
  let contactoDatos = null;
  const cd = body.contacto_datos || null;
  if (cd && String(cd.nombre || "").trim()) {
    const correo = String(cd.correo || "").trim().toLowerCase().slice(0, 200) || null;
    const tel = String(cd.telefono || "").trim().slice(0, 30) || null;
    if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw falla(400, "El correo del contacto no parece válido.");
    if (tel) {
      const digitos = tel.replace(/\D/g, "").length;
      if (digitos < 8 || digitos > 15) throw falla(400, "El WhatsApp/teléfono del contacto no parece válido (incluye la lada).");
    }
    contactoDatos = { nombre: String(cd.nombre).trim().slice(0, 200), correo, telefono: tel };
  }
  if (!esCliente && (!contactoDatos || (!contactoDatos.correo && !contactoDatos.telefono))) {
    throw falla(400, "Deja el nombre del contacto y al menos un correo o WhatsApp del prospecto.");
  }

  return {
    herramienta, temarioTipo, temarioNombre: personalizado ? null : temarioNombre, temas, horas, modalidad,
    participantes: part.columna, notas, objetivo: texto(body.objetivo), alcance: texto(body.alcance), dirigidoA: texto(body.dirigido_a), proyectosJson: proyectos.length ? JSON.stringify(proyectos) : null,
    recibida, esCliente, clienteId, nombre, codigo, contactoId, contactoDatos,
  };
}

async function clientePorId(nuevaRequest, id) {
  const r = await nuevaRequest().input("id", sql.Int, id).query("SELECT id, nombre, codigo, tipo_cliente FROM Cliente WHERE id = @id");
  if (!r.recordset.length) throw falla(400, "El cliente seleccionado ya no existe.");
  return r.recordset[0];
}

// El código de un Prospecto nuevo (o corregido) jamás debe caer en uno que ya existe.
async function validarCodigoLibre(nuevaRequest, codigo, excluirId) {
  const r = await nuevaRequest()
    .input("codigo", sql.NVarChar, codigo)
    .input("excluir", sql.Int, excluirId || null)
    .query("SELECT id, nombre FROM Cliente WHERE UPPER(codigo) = @codigo AND (@excluir IS NULL OR id <> @excluir)");
  if (r.recordset.length) throw falla(409, `El código ${codigo} ya existe (${r.recordset[0].nombre}). Escribe otro.`);
}

async function insertarProspecto(nuevaRequest, nombre, codigo) {
  await validarCodigoLibre(nuevaRequest, codigo, null);
  const r = await nuevaRequest()
    .input("nombre", sql.NVarChar, nombre)
    .input("codigo", sql.NVarChar, codigo)
    .query("INSERT INTO Cliente (nombre, codigo, tipo_cliente) OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.codigo VALUES (@nombre, @codigo, 'Prospecto')");
  return { ...r.recordset[0], tipo_cliente: "Prospecto" };
}

// Contacto de la solicitud: uno existente de ESE cliente (con corrección opcional de sus datos) o uno nuevo.
async function resolverContacto(nuevaRequest, clienteId, d) {
  if (d.contactoId) {
    const c = await nuevaRequest().input("id", sql.Int, d.contactoId).query("SELECT id, cliente_id FROM Contacto WHERE id = @id");
    if (!c.recordset.length || c.recordset[0].cliente_id !== clienteId) throw falla(400, "Ese contacto no pertenece al cliente elegido.");
    if (d.contactoDatos) {
      await nuevaRequest()
        .input("id", sql.Int, d.contactoId)
        .input("nombre", sql.NVarChar, d.contactoDatos.nombre)
        .input("correo", sql.NVarChar, d.contactoDatos.correo)
        .input("telefono", sql.NVarChar, d.contactoDatos.telefono)
        .input("tieneWhatsapp", sql.Bit, d.contactoDatos.telefono ? 1 : 0)
        .query("UPDATE Contacto SET nombre = @nombre, correo = @correo, telefono = @telefono, tiene_whatsapp = @tieneWhatsapp WHERE id = @id");
    }
    return d.contactoId;
  }
  if (!d.contactoDatos) return null;
  const ins = await nuevaRequest()
    .input("clienteId", sql.Int, clienteId)
    .input("nombre", sql.NVarChar, d.contactoDatos.nombre)
    .input("correo", sql.NVarChar, d.contactoDatos.correo)
    .input("telefono", sql.NVarChar, d.contactoDatos.telefono)
    .input("tieneWhatsapp", sql.Bit, d.contactoDatos.telefono ? 1 : 0)
    .query(
      `INSERT INTO Contacto (cliente_id, nombre, correo, telefono, tiene_whatsapp, es_principal)
       OUTPUT INSERTED.id
       VALUES (@clienteId, @nombre, @correo, @telefono, @tieneWhatsapp,
               CASE WHEN EXISTS (SELECT 1 FROM Contacto WHERE cliente_id = @clienteId AND es_principal = 1) THEN 0 ELSE 1 END)`
    );
  return ins.recordset[0].id;
}

async function crearSolicitudManual(nuevaRequest, body) {
  const d = normalizar(body);
  let cliente;
  let creoProspecto = 0;
  if (d.esCliente) {
    cliente = await clientePorId(nuevaRequest, d.clienteId);
  } else {
    cliente = await insertarProspecto(nuevaRequest, d.nombre, d.codigo);
    creoProspecto = 1;
  }
  const contactoId = await resolverContacto(nuevaRequest, cliente.id, d);

  const ins = await nuevaRequest()
    .input("clienteId", sql.Int, cliente.id)
    .input("contactoId", sql.Int, contactoId)
    .input("herramienta", sql.NVarChar, d.herramienta)
    .input("temarioTipo", sql.NVarChar, d.temarioTipo)
    .input("temarioNombre", sql.NVarChar, d.temarioNombre)
    .input("temasJson", sql.NVarChar, JSON.stringify(d.temas))
    .input("horas", sql.Decimal(6, 1), d.horas)
    .input("notas", sql.NVarChar, d.notas)
    .input("participantes", sql.NVarChar, d.participantes)
    .input("modalidad", sql.NVarChar, d.modalidad)
    .input("objetivo", sql.NVarChar, d.objetivo)
    .input("alcance", sql.NVarChar, d.alcance)
    .input("dirigidoA", sql.NVarChar, d.dirigidoA)
    .input("proyectosJson", sql.NVarChar, d.proyectosJson)
    .input("recibida", sql.DateTime2, d.recibida)
    .input("creoProspecto", sql.Bit, creoProspecto)
    .query(
      `INSERT INTO Solicitud
        (cliente_id, contacto_id, herramienta, temario_tipo, temario_nombre, temas_json, horas_totales, canal_origen, notas,
         participantes, modalidad, objetivo, alcance, dirigido_a, proyectos_json, fecha_creacion, fecha_estatus, creo_prospecto)
       OUTPUT INSERTED.id
       VALUES
        (@clienteId, @contactoId, @herramienta, @temarioTipo, @temarioNombre, @temasJson, @horas, 'Manual', @notas,
         @participantes, @modalidad, @objetivo, @alcance, @dirigidoA, @proyectosJson, COALESCE(@recibida, SYSUTCDATETIME()), COALESCE(@recibida, SYSUTCDATETIME()), @creoProspecto)`
    );
  return { id: ins.recordset[0].id, cliente: { id: cliente.id, nombre: cliente.nombre, codigo: cliente.codigo } };
}

async function editarSolicitudManual(nuevaRequest, id, body) {
  if (!id) throw falla(400, "Falta el id de la solicitud.");
  const d = normalizar(body);
  const act = await nuevaRequest()
    .input("id", sql.Int, id)
    .query(
      `SELECT s.cliente_id, s.contacto_id, s.creo_prospecto, c.tipo_cliente
         FROM Solicitud s JOIN Cliente c ON c.id = s.cliente_id WHERE s.id = @id`
    );
  if (!act.recordset.length) throw falla(404, "Esa solicitud ya no existe.");
  const actual = act.recordset[0];
  const eraProspecto = actual.tipo_cliente === "Prospecto";

  let cliente;
  let creoProspecto = actual.creo_prospecto ? 1 : 0;
  let prospectoViejo = null; // id del Prospecto que podría quedar vacío

  if (d.esCliente) {
    cliente = await clientePorId(nuevaRequest, d.clienteId);
    if (cliente.id !== actual.cliente_id) {
      if (eraProspecto) prospectoViejo = actual.cliente_id;
    }
  } else if (eraProspecto && d.clienteId === actual.cliente_id) {
    // mismo Prospecto: se corrige su nombre y/o código
    await validarCodigoLibre(nuevaRequest, d.codigo, actual.cliente_id);
    await nuevaRequest()
      .input("id", sql.Int, actual.cliente_id)
      .input("nombre", sql.NVarChar, d.nombre)
      .input("codigo", sql.NVarChar, d.codigo)
      .query("UPDATE Cliente SET nombre = @nombre, codigo = @codigo WHERE id = @id");
    cliente = { id: actual.cliente_id, nombre: d.nombre, codigo: d.codigo, tipo_cliente: "Prospecto" };
  } else {
    // de un Cliente (u otro Prospecto) a un Prospecto NUEVO
    cliente = await insertarProspecto(nuevaRequest, d.nombre, d.codigo);
    creoProspecto = 1;
    if (eraProspecto) prospectoViejo = actual.cliente_id;
  }

  const contactoId = await resolverContacto(nuevaRequest, cliente.id, d);

  await nuevaRequest()
    .input("id", sql.Int, id)
    .input("clienteId", sql.Int, cliente.id)
    .input("contactoId", sql.Int, contactoId)
    .input("herramienta", sql.NVarChar, d.herramienta)
    .input("temarioTipo", sql.NVarChar, d.temarioTipo)
    .input("temarioNombre", sql.NVarChar, d.temarioNombre)
    .input("temasJson", sql.NVarChar, JSON.stringify(d.temas))
    .input("horas", sql.Decimal(6, 1), d.horas)
    .input("notas", sql.NVarChar, d.notas)
    .input("participantes", sql.NVarChar, d.participantes)
    .input("modalidad", sql.NVarChar, d.modalidad)
    .input("objetivo", sql.NVarChar, d.objetivo)
    .input("alcance", sql.NVarChar, d.alcance)
    .input("dirigidoA", sql.NVarChar, d.dirigidoA)
    .input("proyectosJson", sql.NVarChar, d.proyectosJson)
    .input("recibida", sql.DateTime2, d.recibida)
    .input("creoProspecto", sql.Bit, creoProspecto)
    .query(
      `UPDATE Solicitud SET
         cliente_id = @clienteId, contacto_id = @contactoId, herramienta = @herramienta, temario_tipo = @temarioTipo,
         temario_nombre = @temarioNombre, temas_json = @temasJson, horas_totales = @horas, notas = @notas,
         participantes = @participantes, modalidad = @modalidad, objetivo = @objetivo, alcance = @alcance, dirigido_a = @dirigidoA, proyectos_json = @proyectosJson,
         creo_prospecto = @creoProspecto,
         fecha_estatus = CASE WHEN @recibida IS NOT NULL AND estatus = 'Nueva' THEN @recibida ELSE fecha_estatus END,
         fecha_creacion = COALESCE(@recibida, fecha_creacion)
       WHERE id = @id`
    );

  // El Prospecto anterior se borra solo si ya no cuelga NADA de él (la solicitud ya apunta al cliente nuevo).
  let prospectoAnteriorBorrado = null;
  if (prospectoViejo) {
    const bloqueos = await contarBloqueos(nuevaRequest, prospectoViejo);
    if (bloqueos.length) {
      prospectoAnteriorBorrado = false;
    } else {
      await nuevaRequest().input("id", sql.Int, prospectoViejo).query("DELETE FROM Contacto WHERE cliente_id = @id");
      await nuevaRequest().input("id", sql.Int, prospectoViejo).query("DELETE FROM Cliente WHERE id = @id AND tipo_cliente = 'Prospecto'");
      prospectoAnteriorBorrado = true;
      if (creoProspecto && actual.creo_prospecto && cliente.id !== prospectoViejo && d.esCliente) {
        // esta solicitud ya no dio de alta ese Prospecto (ya no existe): no debe contar como "prospecto generado"
        await nuevaRequest().input("id", sql.Int, id).query("UPDATE Solicitud SET creo_prospecto = 0 WHERE id = @id");
      }
    }
  }
  return { ok: true, cliente: { id: cliente.id, nombre: cliente.nombre, codigo: cliente.codigo }, prospectoAnteriorBorrado };
}

module.exports = { crearSolicitudManual, editarSolicitudManual, mapearParticipantes, aplicarNotaParticipantes, normalizar, PARTICIPANTES_OPCIONES, MODALIDADES };
