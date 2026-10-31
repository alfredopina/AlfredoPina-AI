// api/src/dashboard-resumen-db.js
// Carga (con consultas ligeras, solo admin) las filas que necesita dashboard-resumen.js y las deja en su forma "preparada":
// fechas DATETIME2 como milisegundos UTC; fechas DATE como medianoche de Monterrey (UTC-6). Despierta la base: es admin, está bien.
const { getPool } = require("./backoffice-db");
const { calcularDiasInactivo, calcularCompletado } = require("./cliente-actividad");
const { TZ } = require("./dashboard-resumen");

const inst = (v) => (v == null ? null : new Date(v).getTime()); // DATETIME2 (UTC)
const dia = (v) => (v == null ? null : new Date(v).getTime() + TZ); // DATE → medianoche de Monterrey
const diaTxt = (v) => (v == null ? null : new Date(v).toISOString().slice(0, 10)); // DATE → "YYYY-MM-DD"
const lista = (json) => { try { const a = JSON.parse(json || "[]"); return Array.isArray(a) ? a.map((x) => String(x).toLowerCase()) : []; } catch (_) { return []; } };

// solo: lista opcional de bloques ("sols", "grupos", "clientes") que NO hace falta cargar → vienen vacíos (el Resumen de dinero solo usa cuentas, pagos y cotizaciones)
async function cargarDatos(umbrales, { omitir = [] } = {}) {
  const pool = await getPool();
  const q = (texto) => pool.request().query(texto);
  const vacio = { recordset: [] };
  const si = (nombre, texto) => (omitir.includes(nombre) ? vacio : q(texto));
  const [cuentas, pagos, cots, sols, grupos, clientes] = await Promise.all([
    q(`SELECT x.id, x.estrategia, x.tipo_factura, x.estatus, x.total, x.subtotal, x.fecha_emision, x.fecha_creacion, x.vencimiento,
              c.tipo_cliente AS tipo, q.herramienta AS cot_herr, g.herramientas AS gru_herr
       FROM CuentaPorCobrar x
       LEFT JOIN Cliente c ON c.id = x.cliente_id
       LEFT JOIN Cotizacion q ON q.id = x.cotizacion_id
       LEFT JOIN Grupo g ON g.id = x.grupo_id`),
    q("SELECT cuenta_id, fecha, monto, anulado, fecha_creacion FROM PagoCobranza"),
    q(`SELECT q.id, q.estatus, q.precio_final, q.alternativa_grupo, q.herramienta, q.fecha_creacion, q.fecha_envio, q.fecha_estatus, q.fecha_cierre, q.motivo_perdida, c.tipo_cliente AS tipo
       FROM Cotizacion q LEFT JOIN Cliente c ON c.id = q.cliente_id`),
    si("sols", `SELECT s.herramienta, s.canal_origen, s.estatus, s.creo_prospecto, s.fecha_creacion, p.primera, c.tipo_cliente AS tipo
       FROM Solicitud s
       LEFT JOIN (SELECT solicitud_id, MIN(fecha_creacion) AS primera FROM Cotizacion WHERE solicitud_id IS NOT NULL GROUP BY solicitud_id) p ON p.solicitud_id = s.id
       LEFT JOIN Cliente c ON c.id = s.cliente_id`),
    si("grupos", `SELECT g.herramientas, g.estatus_cierre, g.fecha_inicio, g.fecha_fin, g.fecha_cierre, g.fecha_creacion, c.tipo_cliente AS tipo
       FROM Grupo g JOIN Cliente c ON c.id = g.cliente_id`),
    // mismos ingredientes que getResumenClientesAdmin (Completos y Activos salen de cliente-actividad.js, nunca de otra regla)
    si("clientes", `SELECT c.id, c.codigo, c.cliente_desde, c.tipo_cliente, c.fecha_creacion,
              cp.correo AS principal_correo, cp.telefono AS principal_telefono,
              (SELECT COUNT(*) FROM Contacto WHERE cliente_id = c.id) AS n_contactos,
              (SELECT MAX(fecha_creacion) FROM Solicitud WHERE cliente_id = c.id AND estatus IN ('Nueva', 'En seguimiento')) AS solicitud_pendiente_fecha,
              (SELECT MAX(COALESCE(fecha_envio, fecha_creacion)) FROM Cotizacion WHERE cliente_id = c.id AND estatus IN ('Enviada', 'En negociación')) AS cotizacion_activa_fecha,
              (SELECT MAX(fecha_cierre) FROM Cotizacion WHERE cliente_id = c.id AND estatus IN ('Ganada', 'Perdida')) AS cotizacion_cerrada_fecha,
              CASE WHEN EXISTS (SELECT 1 FROM Grupo WHERE (cliente_id = c.id OR cliente_final_id = c.id) AND (estatus_cierre IS NULL OR estatus_cierre <> 'Cerrado')) THEN 1 ELSE 0 END AS grupo_activo,
              (SELECT MAX(fecha_fin) FROM Diploma WHERE cliente_id = c.id AND estatus = 'vigente') AS ultimo_diploma_fecha,
              (SELECT MAX(fecha_cierre) FROM Grupo WHERE (cliente_id = c.id OR cliente_final_id = c.id) AND estatus_cierre = 'Cerrado') AS ultimo_grupo_cerrado_fecha,
              CASE WHEN EXISTS (SELECT 1 FROM Contacto WHERE cliente_id = c.id AND correo IS NOT NULL AND correo <> '') THEN 1 ELSE 0 END AS algun_contacto_con_correo
       FROM Cliente c
       OUTER APPLY (SELECT TOP 1 correo, telefono FROM Contacto WHERE cliente_id = c.id AND es_principal = 1) cp
       WHERE c.tipo_cliente NOT IN ('Prospecto', 'Tercero')`),
  ]);

  const pagosDe = new Map();
  for (const p of pagos.recordset) {
    if (!pagosDe.has(p.cuenta_id)) pagosDe.set(p.cuenta_id, []);
    pagosDe.get(p.cuenta_id).push({ fecha: diaTxt(p.fecha), creada: inst(p.fecha_creacion), monto: Number(p.monto), anulado: !!p.anulado });
  }
  const ahora = new Date();
  return {
    cuentas: cuentas.recordset.map((x) => ({
      estrategia: x.estrategia || null, tipo_factura: x.tipo_factura || null, estatus: x.estatus, total: Number(x.total), subtotal: Number(x.subtotal), emision: diaTxt(x.fecha_emision), creada: inst(x.fecha_creacion),
      vencimiento: diaTxt(x.vencimiento), tipo: x.tipo || null,
      herrs: x.cot_herr ? [String(x.cot_herr).toLowerCase()] : lista(x.gru_herr), pagos: pagosDe.get(x.id) || [],
    })),
    cotizaciones: cots.recordset.map((c) => ({
      id: c.id, estatus: c.estatus, precio: Number(c.precio_final) || 0, alt: c.alternativa_grupo, herr: String(c.herramienta || "").toLowerCase(), creada: inst(c.fecha_creacion),
      enviada: inst(c.fecha_envio != null ? c.fecha_envio : c.fecha_creacion), motivo: c.motivo_perdida || null,
      cierre: c.fecha_cierre != null ? dia(c.fecha_cierre) : inst(c.fecha_estatus), cierreReal: c.fecha_cierre != null ? dia(c.fecha_cierre) : null, tipo: c.tipo || null,
    })),
    solicitudes: sols.recordset.map((s) => ({
      herr: String(s.herramienta || "").toLowerCase(), canal: s.canal_origen, estatus: s.estatus, prospecto: !!s.creo_prospecto, creada: inst(s.fecha_creacion), primera: inst(s.primera), tipo: s.tipo || null,
    })),
    grupos: grupos.recordset.map((g) => {
      const fechas = [inst(g.fecha_creacion), dia(g.fecha_inicio), dia(g.fecha_fin), dia(g.fecha_cierre)].filter((x) => x != null);
      return {
        herrs: lista(g.herramientas), cerrado: g.estatus_cierre === "Cerrado", activo: g.estatus_cierre !== "Cerrado", fin: dia(g.fecha_fin), cierre: dia(g.fecha_cierre),
        existe: fechas.length ? Math.min(...fechas) : null, tipo: g.tipo || null,
      };
    }),
    clientes: clientes.recordset.map((c) => ({
      tipo: c.tipo_cliente, creada: inst(c.fecha_creacion), contactos: c.n_contactos || 0,
      completo: calcularCompletado({ codigo: c.codigo, clienteDesde: c.cliente_desde, tipoCliente: c.tipo_cliente, principalCorreo: c.principal_correo, principalTelefono: c.principal_telefono, algunContactoConCorreo: !!c.algun_contacto_con_correo }),
      activo: calcularDiasInactivo(
        { solicitudPendienteFecha: c.solicitud_pendiente_fecha, cotizacionActivaFecha: c.cotizacion_activa_fecha, grupoActivo: !!c.grupo_activo, cotizacionCerradaFecha: c.cotizacion_cerrada_fecha, ultimoDiplomaFecha: c.ultimo_diploma_fecha, ultimoGrupoCerradoFecha: c.ultimo_grupo_cerrado_fecha },
        ahora,
        { diasVerde: umbrales.clientesSeguimientoDias, diasAmarillo: umbrales.clientesDias }
      ).semaforo === "verde",
    })),
  };
}

module.exports = { cargarDatos };
