// tools/herramientas-datos.js
// Fuente ÚNICA de las 6 herramientas para el sitio público: el menú desplegable (tools/build-layout.js),
// el centro /in-company y sus 6 páginas /in-company/<slug> (tools/build-in-company.js).
// `id` es el identificador interno (catálogo, admin, API: no se renombra); `slug` es la dirección pública.
// `titulo` y `descripcion` son lo que Google muestra; `h1` lo que lee la persona al llegar.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const HERRAMIENTAS = [
  {
    id: "excel", slug: "excel", nombre: "Excel", color: "#22c55e", clase: "excel", familia: "Análisis de datos",
    resumen: "Aprende a analizar información, crear reportes y automatizar formatos que hoy te quitan horas.",
    subtitulo: "Deja de perder horas armando reportes a mano. Aprende a capturar, analizar y automatizar tu información en Excel — y recupera tiempo para decidir, no para teclear.",
    alcance: ["Español · Inglés", "Office 365 · Versiones anteriores", "También en WPS y Google Sheets"],
    h1: "Cursos de Excel para empresas",
    titulo: "Cursos de Excel para empresas (In Company) — Alfredo Piña",
    descripcion: "Capacitación in company en Excel: reportes, análisis de datos y automatización. Temarios a la medida, en línea o presencial, con diploma verificable.",
  },
  {
    id: "powerbi", slug: "power-bi", nombre: "Power BI", color: "#f2c94c", clase: "pbi", familia: "Análisis de datos",
    resumen: "Aprende a construir dashboards que se actualizan solos, para decidir con datos, no con corazonadas.",
    subtitulo: "Aprende a transformar datos en decisiones — desde conectar y modelar información, hasta construir dashboards que se actualizan solos.",
    alcance: ["Español · Inglés", "Power BI Desktop y Service"],
    h1: "Cursos de Power BI para empresas",
    titulo: "Cursos de Power BI para empresas (In Company) — Alfredo Piña",
    descripcion: "Capacitación in company en Power BI: modela datos y construye dashboards que se actualizan solos. Para equipos, en línea o presencial, con diploma verificable.",
  },
  {
    id: "powerapps", slug: "power-apps", nombre: "Power Apps", color: "#c026d3", clase: "apps", familia: "Automatización",
    resumen: "Aprende a crear tus propias apps y dejar atrás los formatos en papel y los correos perdidos.",
    subtitulo: "Aprende a crear tus propias aplicaciones sin código, para dejar atrás los formatos en papel y los procesos manuales.",
    alcance: ["Español"],
    h1: "Cursos de Power Apps para empresas",
    titulo: "Cursos de Power Apps para empresas (In Company) — Alfredo Piña",
    descripcion: "Capacitación in company en Power Apps: crea apps sin código y deja atrás el papel y los procesos manuales. En línea o presencial, con diploma verificable.",
  },
  {
    id: "powerautomate", slug: "power-automate", nombre: "Power Automate", color: "#06b6d4", clase: "automate", familia: "Automatización",
    resumen: "Aprende a automatizar tareas y flujos de aprobación, para que tu equipo deje de perder horas manuales.",
    subtitulo: "Aprende a automatizar flujos de trabajo y aprobaciones entre sistemas, sin escribir una línea de código.",
    alcance: ["Español"],
    h1: "Cursos de Power Automate para empresas",
    titulo: "Cursos de Power Automate para empresas (In Company) — Alfredo Piña",
    descripcion: "Capacitación in company en Power Automate: automatiza flujos de trabajo y aprobaciones sin código. Para equipos, en línea o presencial, con diploma verificable.",
  },
  {
    id: "ia", slug: "ia-aplicada", nombre: "IA Aplicada", color: "#a78bfa", clase: "ia", familia: "Productividad con IA",
    resumen: "Aprende a usar Copilot en tu día a día para escribir, analizar y decidir más rápido.",
    subtitulo: "Aprende a usar Copilot en tu día a día para escribir, analizar y decidir más rápido.",
    alcance: ["Español", "Copilot para Microsoft 365"],
    h1: "Cursos de IA Aplicada y Copilot para empresas",
    titulo: "Cursos de IA y Copilot para empresas (In Company) — Alfredo Piña",
    descripcion: "Capacitación in company en IA aplicada y Copilot: escribe, analiza y decide más rápido. Para equipos, en línea o presencial, con diploma verificable.",
  },
  {
    id: "ofimatica", slug: "microsoft-365", nombre: "Microsoft 365", color: "#f97316", clase: "ofimatica", familia: "Productividad con IA",
    resumen: "Aprende a crear documentos, presentaciones y correos con nivel profesional.",
    subtitulo: "Aprende a crear documentos, presentaciones y correos con nivel profesional — la base de la comunicación efectiva en cualquier empresa.",
    alcance: ["Español", "Word · PowerPoint · Outlook"],
    h1: "Cursos de Microsoft 365 para empresas",
    titulo: "Cursos de Microsoft 365 para empresas (In Company) — Alfredo Piña",
    descripcion: "Capacitación in company en Microsoft 365: documentos, presentaciones y correos con nivel profesional. En línea o presencial, con diploma verificable.",
  },
];

// ícono de línea de la herramienta (currentColor), listo para pegar en HTML; viene de assets/img/brand/iconos
function iconoHerramienta(id) {
  const svg = fs.readFileSync(path.join(ROOT, "assets/img/brand/iconos", id + ".svg"), "utf8").trim();
  return svg.replace(/ xmlns="[^"]*"/, "").replace(/ width="24" height="24"/, "").replace(/ role="img" aria-label="[^"]*"/, "").replace(/<title>[^<]*<\/title>/, "");
}

const rutaHerramienta = (h) => "/in-company/" + h.slug;

module.exports = { HERRAMIENTAS, iconoHerramienta, rutaHerramienta };
