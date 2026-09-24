// assets/js/diploma-template.js
// Plantilla única del diploma — HTML/CSS real (no coordenadas fijas sobre una
// imagen), capturado con html2canvas + jsPDF directo en el navegador. La usan
// dos lugares: el panel Diplomas → Plantilla del admin (vista previa
// interactiva, con datos de ejemplo) y la página pública de diplomas de un
// grupo — ambos cargan este mismo archivo para no mantener el diseño dos
// veces. Requiere que la página que lo usa ya haya cargado html2canvas,
// jsPDF y (solo si va a ofrecer "Descargar todos") JSZip por <script> aparte.
//
// Diseño cerrado 2026-09-21 (ver CLAUDE.md → Identidad v2 / MANUAL_IDENTIDAD.md
// §7): logo compacto "by LifeZenTraining", barra lateral con relieve partida
// en tramos (uno por herramienta), sello de íconos sin borde que crece en L
// invertida hasta 3 herramientas, sin firma de marca, sin REG. STPS.
//
// IMPORTANTE: los <script src="...diploma-template.js?v=N"> (admin/index.html
// y diplomas-grupo.html) llevan un query de versión a propósito — Azure SWA
// cachea este archivo agresivamente y un cambio aquí no se ve reflejado sin
// eso (ya pasó una vez: un fix de color no llegaba a producción). Sube el
// número ?v= en AMBOS <script> cada vez que edites este archivo.
//
// El color de acento (barra lateral, texto del curso) se fija con un color
// literal en el style inline de cada elemento, NUNCA con una custom property
// CSS (var(--algo)) — html2canvas no siempre resuelve bien las custom
// properties puestas por style inline y el color sale mal SOLO al exportar
// a PDF/JPG (en pantalla, con CSS nativo, se veía perfecto — por eso costó
// encontrarlo). Si necesitas un color dinámico nuevo aquí, ponlo literal.
(function (global) {
  const TOOLS = {
    excel: { n: "Excel", acc: "#22c55e", deep: "#16a34a", tinta: "#15803d" },
    powerbi: { n: "Power BI", acc: "#f2c94c", deep: "#e0a800", tinta: "#8a6a00" },
    powerapps: { n: "Power Apps", acc: "#c026d3", deep: "#9b1aab", tinta: "#a21caf" },
    powerautomate: { n: "Power Automate", acc: "#06b6d4", deep: "#0891b2", tinta: "#0e7490" },
    ia: { n: "IA Aplicada", acc: "#a78bfa", deep: "#7c5cf0", tinta: "#6d3fd8" },
    ofimatica: { n: "Ofimática Básica", acc: "#f97316", deep: "#ea580c", tinta: "#b8500a" },
  };

  // mismos paths que assets/img/brand/iconos/{tool}.svg, inline a propósito
  // (no <img src>): así currentColor toma el color de tinta de cada sello,
  // algo que un <img> no puede heredar de su contenedor — ya probado con
  // html2canvas en el mockup del diploma.
  const ICON = {
    excel: '<g stroke-width="1.25" opacity=".55"><rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></g><rect x="9" y="9" width="12" height="12" stroke-width="2" fill="currentColor" fill-opacity=".14"/><rect x="18.5" y="18.5" width="4.5" height="4.5" fill="currentColor" stroke="none"/>',
    powerbi: '<g fill="currentColor" stroke="none"><g fill-opacity=".36"><rect x="9.5" y="16" width="5" height="5"/><rect x="16" y="16" width="5" height="5"/><rect x="16" y="9.5" width="5" height="5"/></g><rect x="3" y="16" width="5" height="5"/><rect x="9.5" y="9.5" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/></g>',
    powerapps: '<rect x="2.5" y="6" width="17" height="14"/><path d="M2.5 10h17" stroke-width="1.5"/><rect x="5" y="12.5" width="5" height="5" stroke-width="1.5"/><rect x="12" y="12.5" width="5" height="5" stroke-width="1.5" stroke-dasharray="1.5 1.5"/><rect x="17" y="2" width="5" height="5" fill="currentColor" stroke="none"/>',
    powerautomate: '<rect x="3" y="10" width="4" height="4"/><path d="M7 12h4M11 6.75v10.75M11 6.75h4M11 17.5h4"/><rect x="15" y="4.5" width="4.5" height="4.5"/><rect x="15" y="15.25" width="4.5" height="4.5" fill="currentColor"/>',
    ia: '<path d="M11 3l2.3 7.2 7.2 2.3-7.2 2.3L11 22l-2.3-7.2L1.5 12.5l7.2-2.3z" fill="currentColor"/><rect x="18" y="3" width="3.5" height="3.5" stroke-width="1.5"/>',
    ofimatica: '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="M2.5 2.5h9.5v9.5h-9.5z M4.5 5h5.5v1.2h-5.5z M4.5 7.6h5.5v1.2h-5.5z M4.5 10.2h3.5v1.2h-3.5z M12 2.5h9.5v9.5h-9.5z M14 5h6v4.4h-6z M2.5 12h9.5v9.5h-9.5z M4.05 14h6.4v5.2h-6.4z M5.15 15.1h4.2v3h-4.2z M5.15 15.1l2.1 1.85 2.1-1.85v1l-2.1 1.85-2.1-1.85z"/><rect x="13" y="13" width="7.5" height="7.5" stroke-width="1.5"/><rect x="15.5" y="15.5" width="2.5" height="2.5" fill="currentColor" stroke="none"/>',
  };

  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function ico(k, px, color) {
    return `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" style="color:${color}" stroke-width="1.75" stroke-linejoin="miter" stroke-linecap="square" aria-hidden="true">${ICON[k] || ""}</svg>`;
  }
  function fechasLarga(iniISO, finISO) {
    if (!iniISO || !finISO) return "";
    const a = new Date(iniISO), b = new Date(finISO);
    const d1 = a.getUTCDate(), m1 = a.getUTCMonth(), y1 = a.getUTCFullYear();
    const d2 = b.getUTCDate(), m2 = b.getUTCMonth(), y2 = b.getUTCFullYear();
    if (m1 === m2 && y1 === y2) return `Del ${d1} al ${d2} de ${MESES[m2]} de ${y2}`;
    return `Del ${d1} de ${MESES[m1]} de ${y1} al ${d2} de ${MESES[m2]} de ${y2}`;
  }

  // datos: { nombre, correo, cliente, clienteVia, curso, nivel, herramientas:[...],
  //          resultado:'Aprobado'|'Participó', fechaInicio, fechaFin, horas,
  //          instructor, folio, firmaUrl }
  function sellosHtml(herramientas) {
    const n = herramientas.length;
    const items = herramientas
      .map((k, i) => {
        const t = TOOLS[k] || TOOLS.excel;
        const area = n === 3 ? ` style="grid-area:${["2 / 2", "2 / 1", "1 / 2"][i]}"` : "";
        return `<div class="seal2"${area}>${ico(k, 66, t.tinta)}<span style="color:${t.tinta}">${esc(t.n)}</span></div>`;
      })
      .join("");
    const cls = n === 1 ? "" : n === 2 ? " h" : " l";
    return `<div class="seals${cls}">${items}</div>`;
  }
  function barraHtml(herramientas) {
    const segs = herramientas.length > 1 ? herramientas : [herramientas[0]];
    return `<div class="m-band">${segs.map((k) => { const t = TOOLS[k] || TOOLS.excel; return `<div class="seg" style="background-color:${t.acc}"></div>`; }).join("")}</div>`;
  }

  function render(datos) {
    const herramientas = (datos.herramientas && datos.herramientas.length ? datos.herramientas : ["excel"]).slice(0, 3);
    const lead = "Por su " + (datos.resultado === "Aprobado" ? "<b>participación</b> y <b>aprobación</b>" : "<b>participación</b>") + " en el curso";
    const firma = datos.firmaUrl
      ? `<img src="${esc(datos.firmaUrl)}" alt="" style="display:block; width:calc(var(--u)*160); height:auto; max-height:calc(var(--u)*70); object-fit:contain; object-position:left bottom; margin-bottom:calc(var(--u)*4)">`
      : "";
    const principal = TOOLS[herramientas[0]] || TOOLS.excel;
    return `<div class="sheet">
      <div class="m-grid"></div>${barraHtml(herramientas)}
      <div class="abs" style="left:calc(var(--u)*96);top:calc(var(--u)*58)"><img src="/assets/img/brand/logo-diploma-claro.svg" alt="alfredopina.ai" style="display:block;width:calc(var(--u)*245);height:auto"></div>
      <div class="abs" style="right:calc(var(--u)*80);top:calc(var(--u)*60);text-align:right"><div class="folio-l">Folio</div><div class="folio-v">${esc(datos.folio)}</div></div>
      <div class="abs" style="left:calc(var(--u)*96);top:calc(var(--u)*214);width:calc(var(--u)*900)">
        <div class="eyebrow">Otorga el presente diploma a</div>
        <div class="name fit" style="margin-top:calc(var(--u)*14)">${esc(datos.nombre)}</div>
        <div class="a-rule" style="margin-top:calc(var(--u)*22)"></div>
        <div class="lead" style="margin-top:calc(var(--u)*28)">${lead}</div>
        <div class="curso fit" style="margin-top:calc(var(--u)*12);color:${principal.tinta}">${esc(datos.curso)}</div>
        <div class="meta" style="margin-top:calc(var(--u)*26)"><span>Nivel ${esc(datos.nivel)}</span><i></i><span>${esc(fechasLarga(datos.fechaInicio, datos.fechaFin))}</span><i></i><span>${esc(datos.horas || "")} horas</span></div>
      </div>
      <div class="abs" style="left:calc(var(--u)*96);bottom:calc(var(--u)*70)"><div class="sign">${firma}<div class="ln"></div><div class="sn">${esc(datos.instructor)}</div><div class="sr">Instructor</div></div></div>
      ${sellosHtml(herramientas)}
    </div>`;
  }

  function fitAll(root) {
    (root || document).querySelectorAll(".fit").forEach((el) => {
      el.style.removeProperty("--fit");
      let f = 1;
      while (el.scrollWidth > el.clientWidth + 1 && f > 0.5) {
        f = Math.round((f - 0.03) * 100) / 100;
        el.style.setProperty("--fit", f);
      }
    });
  }

  // monta el diploma dentro de `frame` (un contenedor con clase .frame, ver CSS) y ajusta el texto
  async function montar(frame, datos) {
    frame.innerHTML = render(datos);
    fitAll(frame);
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
      fitAll(frame);
    }
  }

  async function rasterizar(frame) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return html2canvas(frame, { scale: 2, backgroundColor: "#fbfcff", useCORS: true });
  }
  async function capturarJPG(frame) {
    const canvas = await rasterizar(frame);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  }
  async function capturarPDF(frame) {
    const canvas = await rasterizar(frame);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "landscape", unit: "in", format: "letter" });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 11, 8.5);
    return pdf.output("blob");
  }

  function descargarBlob(nombre, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // el diploma individual se guarda con su folio tal cual (ya es un
  // identificador corto y sin caracteres raros, ej. "APACM-2601.pdf")
  function nombreArchivoDiploma(folio) {
    return folio + ".pdf";
  }
  function limpioArchivo(s) {
    return String(s || "").replace(/[\\/:*?"<>|]/g, "").trim();
  }
  // "Diplomas-{codigoCliente}-{curso}{AAMM del cierre del curso}.zip"
  function nombreZipDiplomas(snapshot) {
    const f = snapshot.fechaFin ? new Date(snapshot.fechaFin) : null;
    const aamm = f ? String(f.getUTCFullYear()).slice(-2) + String(f.getUTCMonth() + 1).padStart(2, "0") : "";
    return `Diplomas-${limpioArchivo(snapshot.clienteCodigo)}-${limpioArchivo(snapshot.curso)}${aamm}.zip`;
  }

  // genera el PDF de cada diploma de `lista` ([{datos, nombreArchivo}]) en un
  // contenedor oculto y los empaqueta en un solo .zip — requiere JSZip ya
  // cargado en la página. onProgreso(i, total) es opcional.
  async function descargarZip(lista, nombreZip, onProgreso) {
    const oculto = document.createElement("div");
    oculto.style.cssText = "position:fixed; left:-9999px; top:0; width:1100px;";
    const frame = document.createElement("div");
    frame.className = "dip-tpl-frame dip-tpl-stage";
    oculto.appendChild(frame);
    document.body.appendChild(oculto);

    const zip = new JSZip();
    try {
      for (let i = 0; i < lista.length; i++) {
        if (onProgreso) onProgreso(i, lista.length);
        await montar(frame, lista[i].datos);
        const blob = await capturarPDF(frame);
        zip.file(lista[i].nombreArchivo, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      descargarBlob(nombreZip, zipBlob);
    } finally {
      oculto.remove();
    }
  }

  const CSS = `
  .dip-tpl-stage{ --paper:#fbfcff; --dink:#0d1424; --dmuted:#586277; --dfaint:#8a93a6; --dline:rgba(13,20,36,.14) }
  .dip-tpl-frame{ container-type:inline-size; width:100%; aspect-ratio:1100/850; position:relative; overflow:hidden; background:var(--paper); border-radius:4px; box-shadow:0 1px 2px rgba(13,20,36,.08),0 14px 34px rgba(13,20,36,.12); -webkit-print-color-adjust:exact; print-color-adjust:exact }
  .dip-tpl-frame .sheet{ --u:calc(100cqw / 1100); position:absolute; inset:0; color:var(--dink); font-family:Inter,system-ui,sans-serif }
  .dip-tpl-frame .sheet *{ box-sizing:border-box; margin:0; padding:0 }
  .dip-tpl-frame .abs{ position:absolute }
  .dip-tpl-frame .m-grid{ position:absolute; inset:0; background-image:linear-gradient(rgba(13,20,36,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(13,20,36,.055) 1px,transparent 1px); background-size:calc(var(--u)*50) calc(var(--u)*50); -webkit-mask-image:linear-gradient(135deg,#000 5%,transparent 68%); mask-image:linear-gradient(135deg,#000 5%,transparent 68%) }
  .dip-tpl-frame .m-band{ position:absolute; left:0; top:0; bottom:0; width:calc(var(--u)*34); display:flex; flex-direction:column; box-shadow:calc(var(--u)*4) 0 calc(var(--u)*12) rgba(13,20,36,.22) }
  .dip-tpl-frame .m-band .seg{ flex:1; position:relative }
  /* el relieve NO puede ser box-shadow inset: html2canvas lo pinta como una
     capa translúcida sobre TODA la barra (no solo el filo) y lava el color
     de acento — con divs reales (background-color) sale exacto, ya probado
     con lectura de pixel contra el color de marca. */
  .dip-tpl-frame .m-band .seg + .seg::before{ content:""; position:absolute; top:0; left:0; right:0; height:calc(var(--u)*2); background-color:rgba(255,255,255,.6) }
  .dip-tpl-frame .m-band::before{ content:""; position:absolute; top:0; bottom:0; left:0; width:calc(var(--u)*2); background-color:rgba(255,255,255,.42); pointer-events:none }
  .dip-tpl-frame .m-band::after{ content:""; position:absolute; top:0; bottom:0; right:0; width:calc(var(--u)*2); background-color:rgba(0,0,0,.14); pointer-events:none }
  .dip-tpl-frame .eyebrow{ font-size:calc(var(--u)*14); line-height:1.2; letter-spacing:.24em; text-transform:uppercase; color:var(--dmuted); font-weight:500 }
  .dip-tpl-frame .name{ font-family:'Space Grotesk',Inter,sans-serif; font-weight:600; font-size:calc(calc(var(--u)*68)*var(--fit,1)); line-height:1.1; letter-spacing:-.02em; white-space:nowrap; color:var(--dink) }
  .dip-tpl-frame .lead{ font-size:calc(var(--u)*22); line-height:1.3; color:var(--dmuted) }
  .dip-tpl-frame .lead b{ font-weight:600; color:var(--dink) }
  .dip-tpl-frame .curso{ font-family:'Space Grotesk',Inter,sans-serif; font-weight:600; font-size:calc(calc(var(--u)*46)*var(--fit,1)); line-height:1.15; letter-spacing:-.015em; white-space:nowrap; color:var(--dink) }
  .dip-tpl-frame .meta{ display:flex; align-items:center; gap:calc(var(--u)*16); font-family:'JetBrains Mono',ui-monospace,monospace; font-size:calc(var(--u)*15); color:var(--dmuted); white-space:nowrap }
  .dip-tpl-frame .meta i{ display:block; width:calc(var(--u)*5); height:calc(var(--u)*5); border-radius:50%; background:var(--dline) }
  .dip-tpl-frame .folio-l{ font-size:calc(var(--u)*11); letter-spacing:.22em; text-transform:uppercase; color:var(--dfaint); font-weight:500 }
  .dip-tpl-frame .folio-v{ font-family:'JetBrains Mono',ui-monospace,monospace; font-size:calc(var(--u)*17); font-weight:500; color:var(--dink); margin-top:calc(var(--u)*5) }
  .dip-tpl-frame .a-rule{ width:calc(var(--u)*140); height:calc(var(--u)*6); background:var(--dline); border-radius:calc(var(--u)*3) }
  .dip-tpl-frame .sign{ width:calc(var(--u)*250) }
  .dip-tpl-frame .sign .ln{ height:calc(var(--u)*1.5); background:var(--dink); opacity:.55 }
  .dip-tpl-frame .sign .sn{ font-size:calc(var(--u)*17); font-weight:600; margin-top:calc(var(--u)*9) }
  .dip-tpl-frame .sign .sr{ font-size:calc(var(--u)*13); color:var(--dmuted); margin-top:calc(var(--u)*2) }
  .dip-tpl-frame .seals{ position:absolute; right:calc(var(--u)*80); bottom:calc(var(--u)*70); display:flex }
  .dip-tpl-frame .seals.h{ flex-direction:row-reverse; gap:calc(var(--u)*38) }
  .dip-tpl-frame .seals.l{ display:grid; grid-template-columns:auto auto; grid-template-rows:auto auto; gap:calc(var(--u)*24) calc(var(--u)*38); justify-items:center }
  .dip-tpl-frame .seal2{ display:flex; flex-direction:column; align-items:center; gap:calc(var(--u)*12) }
  .dip-tpl-frame .seal2 svg{ width:calc(var(--u)*66); height:calc(var(--u)*66); display:block }
  .dip-tpl-frame .seals.h .seal2 svg,.dip-tpl-frame .seals.l .seal2 svg{ width:calc(var(--u)*56); height:calc(var(--u)*56) }
  .dip-tpl-frame .seal2 span{ font-family:'JetBrains Mono',ui-monospace,monospace; font-size:calc(var(--u)*13); font-weight:600; letter-spacing:.18em; text-transform:uppercase; white-space:nowrap }
  `;
  // los colores de acento (--acc-ink en .curso) van por herramienta principal — el
  // color real se fija inline en cada .stage vía JS, esto solo deja un color
  // de respaldo (--dink) si algo no se resuelve.
  function inyectarCss() {
    if (document.getElementById("dip-tpl-css")) return;
    const style = document.createElement("style");
    style.id = "dip-tpl-css";
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  inyectarCss();

  global.DiplomaTemplate = { TOOLS, render, montar, fitAll, capturarJPG, capturarPDF, descargarBlob, descargarZip, fechasLarga, nombreArchivoDiploma, nombreZipDiplomas };
})(window);
