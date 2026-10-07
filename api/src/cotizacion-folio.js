// api/src/cotizacion-folio.js
// Folio de una Cotización. Formato nuevo (2026-10-09, pedido de Alfredo):
//   AP{AA}-{códigoCliente}-{HERRAMIENTA}-{NN}     ej. AP26-KEME-POWERBI-01
// NN = número de cotización de ESE cliente en el año (sin importar la
// herramienta), mínimo 2 dígitos. Formato viejo, que sigue existiendo en la
// base y cuenta para el consecutivo: AP_{HERRAMIENTA}_{código}_{AA}-{n}
// (ej. AP_EXCEL_KEM_26-3). Función pura (sin SQL) para poder probarla con npm test.

function folioNuevo({ yy, codigoCliente, herramienta, consecutivo }) {
  const cod = String(codigoCliente || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const herr = String(herramienta || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `AP${yy}-${cod}-${herr}-${String(consecutivo).padStart(2, "0")}`;
}

// Mayor número ya usado por un cliente en el año `yy`, leyendo ambos formatos.
// `folios` = los folios de TODAS las cotizaciones de ese cliente.
function maxConsecutivo(folios, yy) {
  const viejo = new RegExp(`_${yy}-(\\d+)$`);
  const nuevo = new RegExp(`^AP${yy}-.+-(\\d+)$`);
  let max = 0;
  for (const f of folios || []) {
    const m = viejo.exec(f || "") || nuevo.exec(f || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

module.exports = { folioNuevo, maxConsecutivo };
