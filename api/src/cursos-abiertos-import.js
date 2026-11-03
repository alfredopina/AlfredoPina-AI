// api/src/cursos-abiertos-import.js
// Cursos Abiertos — IMPORTACIÓN de las colas del sitio a SQL (solo admin; lo público nunca importa este módulo).
// Mismo patrón que Diagnóstico y Encuesta: el sitio dejó el envío en Table Storage (api/src/cursos-abiertos-cola.js) y el admin lo pasa a SQL cuando
// Alfredo abre «Abiertos» o pulsa «Importar ahora». Cada envío se importa POR SEPARADO y en UNA transacción: si falla, se revierte y se queda en la cola
// con su motivo (ultimoError) sin bloquear a los demás. Idempotente: la clave del envío (Inscripcion.envio_id + persona_ix, ListaEspera.envio_id) impide duplicar.
//
// Una INSCRIPCIÓN (1 a 3 personas) crea: un Alumno por persona (se reutiliza el de ese correo y ese cliente), una Inscripcion por persona en estado
// 'apartada' y UNA cuenta por cobrar (Cobranza, estrategia 'abiertos', Por facturar) por envío, a nombre de la empresa si paga una y dio su razón social
// (se reutiliza el Cliente que ya exista con ese RFC o nombre; si no, nace como Prospecto) o del cliente reservado ABIERTOS si paga la persona.
// El contador de lugares del sitio NO se toca: ya contaba esos lugares mientras estaban en la cola, y siguen ocupados al pasar a SQL.
const { sql } = require("./backoffice-db");
const colas = require("./cursos-abiertos-cola");
const { insertarCuenta } = require("./cobranza-db");
const C = require("./cobranza");
const { idClienteAbiertos } = require("./grupo-abierto");

const falla = (m) => { const e = new Error(m); e.safe = true; return e; };
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

// Cliente de la empresa que paga: por RFC, luego por razón social o nombre; si no existe nace Prospecto (código corto único).
async function clienteDeEmpresa(nr, factura) {
  const rfc = String((factura && factura.rfc) || "").toUpperCase();
  const razon = String((factura && factura.razon_social) || "").trim();
  if (!razon) return null;
  if (rfc) {
    const r = await nr().input("rfc", sql.NVarChar, rfc).query("SELECT TOP 1 id FROM Cliente WHERE rfc = @rfc ORDER BY id");
    if (r.recordset.length) return r.recordset[0].id;
  }
  const r = await nr().input("n", sql.NVarChar, razon).query("SELECT TOP 1 id FROM Cliente WHERE LOWER(razon_social) = LOWER(@n) OR LOWER(nombre) = LOWER(@n) ORDER BY id");
  if (r.recordset.length) return r.recordset[0].id;
  const base = norm(razon).replace(/[^a-z0-9]/g, "").toUpperCase().slice(0, 6) || "EMP";
  for (let i = 0; i < 6; i++) {
    const codigo = base + String(Math.floor(1000 + Math.random() * 9000));
    const existe = await nr().input("c", sql.NVarChar, codigo).query("SELECT id FROM Cliente WHERE codigo = @c");
    if (existe.recordset.length) continue;
    const ins = await nr().input("nombre", sql.NVarChar, razon.slice(0, 200)).input("codigo", sql.NVarChar, codigo).input("rfc", sql.NVarChar, rfc || null)
      .query("INSERT INTO Cliente (nombre, codigo, tipo_cliente, origen_alta, razon_social, rfc) OUTPUT INSERTED.id VALUES (@nombre, @codigo, 'Prospecto', 'Cursos Abiertos', @nombre, @rfc)");
    return ins.recordset[0].id;
  }
  throw falla("No se pudo crear la empresa de la factura (código repetido). Inténtalo de nuevo.");
}

async function alumnoDe(nr, clienteId, p) {
  const ya = await nr().input("c", sql.Int, clienteId).input("m", sql.NVarChar, p.correo).query("SELECT TOP 1 id FROM Alumno WHERE cliente_id = @c AND LOWER(correo) = LOWER(@m) ORDER BY id");
  if (ya.recordset.length) {
    if (p.whatsapp) await nr().input("id", sql.Int, ya.recordset[0].id).input("w", sql.NVarChar, p.whatsapp).query("UPDATE Alumno SET whatsapp = @w WHERE id = @id");
    return ya.recordset[0].id;
  }
  const ins = await nr().input("n", sql.NVarChar, p.nombre).input("c", sql.Int, clienteId).input("m", sql.NVarChar, p.correo).input("w", sql.NVarChar, p.whatsapp || null)
    .query("INSERT INTO Alumno (nombre_completo, cliente_id, correo, whatsapp) OUTPUT INSERTED.id VALUES (@n, @c, @m, @w)");
  return ins.recordset[0].id;
}

// Importa UN envío de inscripción. Lanza si algo falla (la transacción se revierte y el envío se queda en la cola con el motivo).
async function importarInscripcion(pool, envioId, datos) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  const nr = () => new sql.Request(transaction);
  try {
    const g = await nr().input("c", sql.NVarChar, datos.grupo).query("SELECT id, nombre_curso, grupo_codigo FROM Grupo WHERE grupo_codigo = @c AND estrategia = 'abiertos'");
    if (!g.recordset.length) throw falla("El grupo " + datos.grupo + " ya no existe: descarta este envío o créalo de nuevo.");
    const yaImportado = await nr().input("e", sql.NVarChar, envioId).query("SELECT TOP 1 id FROM Inscripcion WHERE envio_id = @e");
    if (yaImportado.recordset.length) { await transaction.commit(); return { duplicada: true }; }
    const grupo = g.recordset[0];
    const personas = Array.isArray(datos.personas) ? datos.personas : [];
    if (!personas.length) throw falla("El envío no trae personas.");
    const abiertosId = await idClienteAbiertos(nr);
    const paga = datos.paga === "empresa" ? "empresa" : "yo";
    const factura = datos.factura || {};
    const clienteId = paga === "empresa" ? (await clienteDeEmpresa(nr, factura)) || abiertosId : abiertosId;
    const total = Number(datos.monto_estimado && datos.monto_estimado.total) || 0;
    const porPersona = Math.round((total / personas.length) * 100) / 100;
    const o = datos.origen || {};
    const ids = [];
    for (let ix = 0; ix < personas.length; ix++) {
      const alumnoId = await alumnoDe(nr, clienteId, personas[ix]);
      const ins = await nr().input("g", sql.Int, grupo.id).input("a", sql.Int, alumnoId).input("paga", sql.NVarChar, paga).input("rf", sql.Bit, factura.requiere ? 1 : 0)
        .input("rfc", sql.NVarChar, factura.rfc || null).input("rz", sql.NVarChar, factura.razon_social || null).input("monto", sql.Decimal(10, 2), porPersona)
        .input("hasta", sql.DateTime2, datos.apartado_hasta ? new Date(datos.apartado_hasta) : null).input("e", sql.NVarChar, envioId).input("ix", sql.TinyInt, ix)
        .input("us", sql.NVarChar, o.utm_source || null).input("um", sql.NVarChar, o.utm_medium || null).input("uc", sql.NVarChar, o.utm_campaign || null)
        .query(`INSERT INTO Inscripcion (grupo_id, alumno_id, estado, paga, requiere_factura, rfc, razon_social, estado_pago, monto_estimado, apartado_hasta, envio_id, persona_ix,
                  utm_source, utm_medium, utm_campaign, origen)
                OUTPUT INSERTED.id VALUES (@g, @a, 'apartada', @paga, @rf, @rfc, @rz, 'pendiente', @monto, @hasta, @e, @ix, @us, @um, @uc, 'sitio')`);
      ids.push(ins.recordset[0].id);
    }
    // una cuenta por cobrar por envío (Por facturar): el precio del sitio es sin IVA, Cobranza calcula el IVA
    const concepto = (grupo.grupo_codigo + " · " + (grupo.nombre_curso || "Curso abierto") + " · " + personas.length + (personas.length === 1 ? " persona" : " personas") + (paga === "yo" ? " · " + personas[0].nombre : "")).slice(0, 300);
    const montos = C.desglosarMonto({ subtotal: total > 0 ? total : 0 });
    const cuentaId = await insertarCuenta(nr, {
      cliente_id: clienteId, grupo_id: grupo.id, origen: "Manual", estrategia: "abiertos", concepto, ...montos, estatus: "Por facturar",
      ...(factura.razon_social ? { razon_social: String(factura.razon_social).slice(0, 200) } : {}), ...(factura.rfc ? { rfc_receptor: String(factura.rfc).slice(0, 15) } : {}),
    });
    await nr().input("c", sql.Int, cuentaId).input("e", sql.NVarChar, envioId).query("UPDATE Inscripcion SET cuenta_cobrar_id = @c WHERE envio_id = @e");
    await transaction.commit();
    return { inscripciones: ids.length, cuentaId };
  } catch (err) {
    try { await transaction.rollback(); } catch (_) { /* nada que revertir */ }
    throw err;
  }
}

async function importarEspera(pool, envioId, datos) {
  const ya = await pool.request().input("e", sql.NVarChar, envioId).query("SELECT TOP 1 id FROM ListaEspera WHERE envio_id = @e");
  if (ya.recordset.length) return { duplicada: true };
  const o = datos.origen || {};
  await pool.request().input("n", sql.NVarChar, datos.nombre).input("m", sql.NVarChar, datos.correo).input("i", sql.NVarChar, datos.interes).input("p", sql.NVarChar, datos.paga === "empresa" ? "empresa" : "yo")
    .input("ctx", sql.NVarChar, datos.contexto || null).input("gr", sql.NVarChar, datos.grupo_referencia || null).input("e", sql.NVarChar, envioId)
    .input("us", sql.NVarChar, o.utm_source || null).input("um", sql.NVarChar, o.utm_medium || null).input("uc", sql.NVarChar, o.utm_campaign || null)
    .query("INSERT INTO ListaEspera (nombre, correo, interes, paga, contexto, grupo_referencia, envio_id, utm_source, utm_medium, utm_campaign) VALUES (@n, @m, @i, @p, @ctx, @gr, @e, @us, @um, @uc)");
  return { creada: true };
}

// Importa las dos colas. Nunca lanza; devuelve lo que hizo en cada una.
async function importarConSql(pool, context, opciones) {
  const vacio = { importadas: 0, errores: 0, restantes: 0 };
  const hacer = async (cola, fn) => {
    try { return await cola.importar(cola.getTable(), (id, datos) => fn(pool, id, datos), context, opciones); }
    catch (err) { if (context) context.log.error("Cola de Cursos Abiertos: no se pudo iniciar la importación:", err.message); return vacio; }
  };
  const inscripciones = await hacer(colas.inscripciones, importarInscripcion);
  const espera = await hacer(colas.espera, importarEspera);
  return { inscripciones, espera };
}

// Lo que espera en las colas (solo Table Storage; no despierta la base): totales y los que ya fallaron, con su motivo.
async function resumenColas() {
  const fila = (tipo) => (e) => ({ tipo, envioId: e.rowKey, recibidoEn: e.recibidoEn, intentos: e.intentos || 0, error: e.ultimoError || "", nombre: e.nombre || "", grupo: e.grupo || "", interes: e.interes || "" });
  const [a, b] = await Promise.all([
    colas.inscripciones.resumen(colas.inscripciones.getTable(), { select: ["nombre", "grupo"], fila: fila("inscripcion") }),
    colas.espera.resumen(colas.espera.getTable(), { select: ["nombre", "interes"], fila: fila("espera") }),
  ]);
  return { inscripciones: a.total, espera: b.total, errores: [...a.lista, ...b.lista] };
}

module.exports = { importarInscripcion, importarEspera, importarConSql, resumenColas, clienteDeEmpresa };
