// Prueba de api/src/cotizacion-eliminar.js con una "base" falsa.
const assert = require("assert");
const { eliminarCotizacionDe } = require("./src/cotizacion-eliminar");

function fabrica(handler) {
  const llamadas = [];
  const nuevaRequest = () => {
    const params = {};
    const r = {
      input(n, _t, v) { params[n] = v; return r; },
      async query(texto) {
        llamadas.push({ texto, params: { ...params } });
        const res = handler(texto, params);
        return { recordset: res || [], rowsAffected: [1] };
      },
    };
    return r;
  };
  return { nuevaRequest, hubo: (frag) => llamadas.filter((c) => c.texto.includes(frag)) };
}
async function rechaza(p, status, re) {
  try { await p; } catch (e) { assert.ok(e.safe); assert.strictEqual(e.status, status, e.message); if (re) assert.ok(re.test(e.message), e.message); return; }
  assert.fail("debía fallar");
}

(async () => {
  const cot = { id: 7, folio: "AP26-ACM-EXCEL-01", solicitud_id: 3, blob_path: "propuesta/ABCD1234" };
  const base = (extra) => (t) => {
    if (t.startsWith("SELECT id, folio, solicitud_id")) return [cot];
    if (t.includes("FROM Grupo")) return [];
    if (t.startsWith("SELECT COUNT(*)")) return [{ n: 0 }];
    return extra ? extra(t) : [];
  };

  await rechaza(eliminarCotizacionDe(fabrica(() => []).nuevaRequest, 0), 400);
  await rechaza(eliminarCotizacionDe(fabrica(() => []).nuevaRequest, 7), 404);

  // un Grupo nació de ella: no se borra
  let f = fabrica((t) => (t.startsWith("SELECT id, folio") ? [cot] : t.includes("FROM Grupo") ? [{ grupo_codigo: "GRP-01", nombre_curso: "Excel" }] : []));
  await rechaza(eliminarCotizacionDe(f.nuevaRequest, 7), 409, /GRP-01/);
  assert.strictEqual(f.hubo("DELETE").length, 0, "no borra nada");

  // única cotización de su solicitud: la solicitud vuelve a Nueva
  f = fabrica(base());
  let r = await eliminarCotizacionDe(f.nuevaRequest, 7);
  assert.strictEqual(r.folio, "AP26-ACM-EXCEL-01");
  assert.strictEqual(r.blobPath, "propuesta/ABCD1234");
  assert.strictEqual(r.solicitudReabierta, true);
  assert.strictEqual(f.hubo("SET reemplaza_a_folio = NULL")[0].params.folio, "AP26-ACM-EXCEL-01", "las versiones que la reemplazan dejan de apuntarla");
  assert.strictEqual(f.hubo("DELETE FROM Cotizacion")[0].params.id, 7);
  assert.ok(f.hubo("UPDATE Solicitud SET estatus = 'Nueva'")[0].texto.includes("AND estatus = 'Cotizada'"), "solo reabre si estaba Cotizada");

  // la solicitud tiene otra cotización: no se toca
  f = fabrica((t) => (t.startsWith("SELECT COUNT(*)") ? [{ n: 1 }] : base()(t)));
  r = await eliminarCotizacionDe(f.nuevaRequest, 7);
  assert.strictEqual(r.solicitudReabierta, false);
  assert.strictEqual(f.hubo("UPDATE Solicitud").length, 0);

  // sin solicitud ligada
  f = fabrica((t) => (t.startsWith("SELECT id, folio") ? [{ ...cot, solicitud_id: null }] : base()(t)));
  r = await eliminarCotizacionDe(f.nuevaRequest, 7);
  assert.strictEqual(r.solicitudReabierta, false);

  console.log("test-cotizacion-eliminar: ok");
})().catch((e) => { console.error(e); process.exit(1); });
