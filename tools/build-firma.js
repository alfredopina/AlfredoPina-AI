// tools/build-firma.js
// Genera las firmas de correo (fragmentos HTML) en assets/firma/. Se pegan tal cual en Gmail u Outlook.
//
// Uso (desde la raíz del repo):   node tools/build-firma.js
//
// Reglas de una firma de correo (por eso se ve "anticuada" por dentro): tablas y estilos en línea,
// fuentes del sistema (las web fonts no cargan), imágenes con URL absoluta y ancho fijo, y todos los
// datos importantes también como TEXTO, porque muchos clientes bloquean las imágenes.
// Para cambiar un dato (p. ej. el correo cuando exista @alfredopina.ai): edita DATOS y vuelve a correrlo.

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets", "firma");
const SITE = "https://www.alfredopina.ai";

const DATOS = {
  nombre: "Alfredo Piña",
  cargo: "Instructor &amp; Consultor · Excel, Power BI e IA",
  descriptor: "Productividad con Datos · Automatización · IA",
  telefono: "(+52) 811 725 5937",
  telefonoHref: "tel:+528117255937",
  whatsappHref: "https://wa.me/528117255937",
  correo: "alfredo.pina@lifezen.com.mx",
  web: "www.alfredopina.ai",
  linkedin: "https://www.linkedin.com/in/alfredopinacortez",
};

const C = { tinta: "#0d1424", gris: "#586277", azul: "#1f5fe0", linea: "#c9d3e6" };
const FUENTE = "Arial,Helvetica,sans-serif";
const a = (href, texto) => `<a href="${href}" style="color:${C.azul};text-decoration:none;">${texto}</a>`;

function logo(gif) {
  const ext = gif ? "gif" : "png";
  return `<tr><td style="padding:0 0 12px 0;"><a href="${SITE}/" style="text-decoration:none;"><img src="${SITE}/assets/img/brand/logo-principal-claro.${ext}" width="260" alt="alfredopina.ai" style="display:block;border:0;width:260px;height:auto;"></a></td></tr>`;
}

function completa(gif) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:${FUENTE};font-size:13px;line-height:1.55;color:${C.tinta};">
  ${logo(gif)}
  <tr><td style="border-left:3px solid ${C.azul};padding:2px 0 2px 12px;">
    <div style="font-size:16px;font-weight:bold;color:${C.tinta};">${DATOS.nombre}</div>
    <div style="color:${C.gris};">${DATOS.cargo}</div>
    <div style="padding-top:8px;">${a(DATOS.telefonoHref, DATOS.telefono)} &nbsp;·&nbsp; ${a(DATOS.whatsappHref, "WhatsApp")}</div>
    <div>${a("mailto:" + DATOS.correo, DATOS.correo)}</div>
    <div>${a(SITE + "/", DATOS.web)} &nbsp;·&nbsp; ${a(DATOS.linkedin, "LinkedIn")}</div>
    <div style="padding-top:8px;font-size:11px;color:${C.gris};">${DATOS.descriptor}</div>
  </td></tr>
</table>
`;
}

function corta() {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:${FUENTE};font-size:13px;line-height:1.55;color:${C.tinta};">
  <tr><td style="border-left:3px solid ${C.azul};padding:2px 0 2px 12px;">
    <div><strong>${DATOS.nombre}</strong> <span style="color:${C.gris};">· Instructor &amp; Consultor</span></div>
    <div>${a(DATOS.telefonoHref, DATOS.telefono)} &nbsp;·&nbsp; ${a(SITE + "/", DATOS.web)}</div>
  </td></tr>
</table>
`;
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "completa.html"), completa(false));
fs.writeFileSync(path.join(OUT, "animada.html"), completa(true));
fs.writeFileSync(path.join(OUT, "corta.html"), corta());
console.log("firmas generadas en assets/firma/: completa, animada y corta");
