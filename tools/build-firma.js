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
  cargo: "Instructor &amp; Consultor",
  herramientas: "Excel · Power BI · Power Platform · IA",
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

const icono = (archivo, alt) => `<img src="${SITE}/assets/img/brand/${archivo}" width="18" height="18" alt="${alt}" style="border:0;width:18px;height:18px;vertical-align:middle;">`;

function completa(gif) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:${FUENTE};font-size:13px;line-height:1.55;color:${C.tinta};">
  ${logo(gif)}
  <tr><td style="border-left:3px solid ${C.azul};padding:2px 0 2px 12px;">
    <div><strong style="font-size:16px;">${DATOS.nombre}</strong> <span style="color:${C.gris};">· ${DATOS.cargo}</span></div>
    <div style="color:${C.gris};">${DATOS.herramientas}</div>
    <div style="padding-top:8px;">${a(DATOS.telefonoHref, DATOS.telefono)} &nbsp;·&nbsp; ${a("mailto:" + DATOS.correo, DATOS.correo)}</div>
    <div>${a(SITE + "/", DATOS.web)} &nbsp;&nbsp;${a(DATOS.whatsappHref, icono("firma-whatsapp.png", "WhatsApp"))}&nbsp;${a(DATOS.linkedin, icono("firma-linkedin.png", "LinkedIn"))}</div>
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

// Íconos de contacto (PNG de 36 px para mostrarse a 18 px): dibujados aquí, generados solo si hay "sharp".
const ICONOS = {
  "firma-whatsapp.png": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" fill="${C.azul}"/><path d="M8.5 7.2c.3-.4.9-.4 1.2 0l.9 1.3c.2.3.2.7-.1 1l-.6.6c.6 1.2 1.5 2.1 2.7 2.7l.6-.6c.3-.3.7-.3 1-.1l1.3.9c.4.3.4.9 0 1.2-1 1-2.3 1.2-3.6.7-2.5-1-4.3-2.8-5.3-5.3-.5-1.3-.3-2.6.7-3.6z" fill="#fff"/></svg>`,
  "firma-linkedin.png": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="4" fill="${C.azul}"/><circle cx="7.2" cy="7.6" r="1.6" fill="#fff"/><rect x="5.7" y="10" width="3" height="8.6" fill="#fff"/><path d="M11 10h2.9v1.2c.5-.9 1.5-1.4 2.7-1.4 2.3 0 3.1 1.5 3.1 3.6v5.2h-3v-4.6c0-1-.3-1.7-1.3-1.7s-1.4.8-1.4 1.8v4.5H11z" fill="#fff"/></svg>`,
};
try {
  const sharp = require("sharp");
  const BRAND = path.join(__dirname, "..", "assets", "img", "brand");
  for (const [archivo, svg] of Object.entries(ICONOS)) {
    sharp(Buffer.from(svg), { density: 600 }).resize(36, 36).png().toFile(path.join(BRAND, archivo));
  }
} catch (e) {
  console.log("(sin sharp: no se regeneraron los íconos PNG; ya están en assets/img/brand/)");
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "completa.html"), completa(false));
fs.writeFileSync(path.join(OUT, "animada.html"), completa(true));
fs.writeFileSync(path.join(OUT, "corta.html"), corta());
console.log("firmas generadas en assets/firma/: completa, animada y corta");
