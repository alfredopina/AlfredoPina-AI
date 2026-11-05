// Catálogo y temarios de UNA herramienta de Cursos In Company. La usan las 6 páginas /in-company/<slug>
// (generadas por tools/build-in-company.js): cada <body> trae data-herramienta (id interno del catálogo) y
// data-nombre; título, subtítulo y chips ya vienen escritos en el HTML (los lee Google sin ejecutar nada).
const HERRAMIENTA = document.body.dataset.herramienta;
const NOMBRE_HERRAMIENTA = document.body.dataset.nombre || '';

function checkDot(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function checkIcon(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const TOOL_COLOR = { excel:'#22c55e', powerbi:'#f2c94c', powerapps:'#c026d3', powerautomate:'#06b6d4', ia:'#a78bfa', ofimatica:'#f97316' };
const catalogoCache = {};
let currentCat = HERRAMIENTA;
let currentCatalogo = null;

// Condiciones comerciales (vigencia, duración mínima, etc.): SOLO en el PDF de cotización. Aquí vive "Cómo contratar".
const ico = (d, ancho = 1.5) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + ancho + '" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision">' + d + '</svg>';
const ICO_PUBLICO = ico('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2c2.6.2 4.5 2 4.5 4.8"/>', 2);
const PASOS_CONTRATAR = [
  { t:'Solicita', d:'Elige tu programa y cuéntanos de tu equipo.', i:ico('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 12v5M9.5 14.5h5"/>') },
  { t:'Recibe tu cotización', d:'Te la entregamos en un máximo de 24 hr.', i:ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') },
  { t:'Confirma', d:'Con orden de compra o anticipo. Nosotros gestionamos el alta de proveedor.', i:ico('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>') },
  { t:'Agendamos', d:'Definimos fechas y plataforma, y el grupo se confirma en calendario.', i:ico('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>') },
];
// Por qué contratarnos: lo que acompaña a cualquier programa. Es el MISMO bloque para las 6 herramientas; si una
// necesita algo distinto, CONTRATAR_POR_HERRAMIENTA['powerbi'] = { incluye:[…], pasos:[…] } lo reemplaza solo ahí.
const INCLUYE = [
  { t:'Realiza un diagnóstico previo', d:'Medimos el nivel de tu equipo.', i:ico('<path d="M3 12h4l2 6 4-14 2 8h6"/>') },
  { t:'Agenda a tu criterio', d:'Sesiones de 2 hr hasta un día.', i:ico('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M12 13v3l2 1"/>') },
  { t:'Tu plataforma de comunicación', d:'Teams, Zoom, Meet o la tuya.', i:ico('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>') },
  { t:'Presencial in company', d:'En tus instalaciones, sin costo en Monterrey.', i:ico('<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>') },
  { t:'Sesión Kick off (Opcional)', d:'Arranque con objetivos y logística.', i:ico('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>') },
  { t:'Grabación de las sesiones', d:'Disponible por tiempo limitado.', i:ico('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>') },
  { t:'Proyecto final con tus datos', d:'Un proyecto práctico enfocado en tu información.', i:ico('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/><path d="M13 14l2 2 3-4"/>') },
  { t:'Diploma y credencial en LinkedIn', d:'Diploma y credencial para tu perfil.', i:ico('<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5 7 21l5-3 5 3-1.5-7.5"/>') },
];
const CONTRATAR_POR_HERRAMIENTA = {};

// ============================================================
// CARGA Y RENDER DEL CATÁLOGO — un solo mount point (#cursoPanel)
// reusado por las 6 herramientas, con cache en memoria por herramienta.
// ============================================================
async function activateTab(cat){
  currentCat = cat;

  document.querySelectorAll('.nav-dd-menu a[data-cat]').forEach(a => {
    if(a.dataset.cat === cat) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });

  // con viaje, su hero reemplaza el encabezado genérico (título/subtítulo/chips)
  const encabezado = document.getElementById('catTitle').closest('header');
  if(encabezado) encabezado.classList.toggle('ic-enc-solo-lectores', !!(window.ViajeHerramienta && window.ViajeHerramienta.tieneConfig(cat)));

  document.querySelector('section.wrap').style.setProperty('--c', TOOL_COLOR[cat] || '#22c55e');

  const panel = document.getElementById('cursoPanel');
  if(!catalogoCache[cat]){
    panel.innerHTML = '<p class="section-sub">Cargando…</p>';
    try {
      const res = await fetch(`/api/getCatalogoCursos?herramienta=${encodeURIComponent(cat)}`);
      const data = await res.json().catch(() => ({}));
      if(!res.ok) throw new Error(data.error || 'Error de red');
      catalogoCache[cat] = data;
    } catch(e){
      catalogoCache[cat] = { temas: [], estandar: [], proyectos: [] };
    }
  }
  currentCatalogo = catalogoCache[cat];
  renderCursoPanel();
}

// los íconos de marca viven en el menú desplegable del nav (se estampan con tools/build-layout.js)
function toolIconInline(cat){
  const el = document.querySelector(`.nav-dd-menu a[data-cat="${cat}"] svg`);
  return el ? el.outerHTML : '';
}
function toolIconSvg(cat){
  return toolIconInline(cat).replace('<svg ', '<svg class="soon-icon" ');
}

function renderCursoPanel(){
  const panel = document.getElementById('cursoPanel');
  if(window.ViajeHerramienta) window.ViajeHerramienta.destruir();
  const data = currentCatalogo || { temas: [], estandar: [], proyectos: [] };
  const hasEstandar = !!(data.estandar && data.estandar.length);

  if(!hasEstandar){
    const subtitulo = (document.getElementById('catSubtitle') || {}).textContent || '';
    panel.innerHTML = `
      <div class="curso-grid">
        <div class="curso-card soon in-view">
          ${toolIconSvg(currentCat)}
          <div class="soon-title">${escapeHtml(NOMBRE_HERRAMIENTA)} — en construcción</div>
          <div class="soon-text">${escapeHtml(subtitulo)}</div>
          <span class="curso-badge-soon">PRÓXIMAMENTE</span>
        </div>
      </div>`;
    return;
  }

  // El viaje (scroll-scrub) solo existe para las herramientas registradas en
  // window.ViajeEscenas (Excel en viaje-xl.js, Power BI en viaje-bi.js, Ofimática en viaje-ofi.js, IA en viaje-ia.js, Power Apps en viaje-pa.js, Power Automate en viaje-auto.js). Para
  // replicarlo a otra herramienta: registrar su bloque ahí, nada se toca aquí.
  // Ojo: sin programas estándar publicados en el admin no hay viaje ("en construcción").
  const tieneViaje = window.ViajeHerramienta && window.ViajeHerramienta.tieneConfig(currentCat);
  panel.innerHTML = (tieneViaje ? window.ViajeHerramienta.html(currentCat) : '') + estandarHtml(data.estandar);
  if(tieneViaje) window.ViajeHerramienta.iniciar(currentCat);
}

// ============================================================
// TEMARIOS ESTÁNDAR — un "program-fn" (acordeón estilo función) por temario
// ============================================================
function estandarHtml(estandar){
  return `
    <div class="programs-head" id="programas"><div class="builder-title">Nuestros programas más pedidos</div></div>
    <div class="programs-list" id="programsList">${estandar.map(programFnHtml).join('')}</div>
    ${contratarHtml()}`;
}

// Debajo de los programas, dos secciones con el mismo peso visual: "Cómo contratar" (stepper del proceso de
// cotización in company) y "No llevas solo un curso" (lo que acompaña a cada programa).
function contratarHtml(){
  const datos = Object.assign({ pasos: PASOS_CONTRATAR, incluye: INCLUYE }, CONTRATAR_POR_HERRAMIENTA[currentCat] || {});
  const pasos = datos.pasos.map((p, i) => `
    <li class="paso">
      <div class="paso-ico">${p.i}<span class="paso-num">${String(i + 1).padStart(2, '0')}</span></div>
      <div class="paso-t">${p.t}</div>
      <p class="paso-d">${p.d}</p>
    </li>`).join('');
  const incluye = datos.incluye.map(b => `
    <div class="incl-card">
      <span class="incl-ico">${b.i}</span>
      <div class="incl-t">${b.t}</div>
      <p class="incl-d">${b.d}</p>
    </div>`).join('');
  return `
    <section class="contratar" id="comoContratar" aria-labelledby="contratarTitulo">
      <div class="contratar-kicker">COTIZACIÓN IN COMPANY</div>
      <h2 class="contratar-titulo" id="contratarTitulo">Cómo contratar</h2>
      <ol class="pasos">${pasos}</ol>
    </section>
    <section class="contratar" id="porqueContratarnos" aria-labelledby="porqueTitulo">
      <div class="contratar-kicker">POR QUÉ CONTRATARNOS</div>
      <h2 class="contratar-titulo" id="porqueTitulo">No llevas solo un curso</h2>
      <div class="incl-grid">${incluye}</div>
      <div class="contratar-cta"><a href="#programas" class="viaje-btn solid" onclick="event.preventDefault(); document.getElementById('programas').scrollIntoView({behavior:'smooth'});">Elegir mi programa</a></div>
    </section>`;
}

const LEYENDA_PROYECTO = 'Al concluir el programa, el participante desarrollará un proyecto práctico basado en sus propios datos para aprobar el curso.';

function proyectoHeroHtml(progId, pr){
  if(!pr.imagenMiniUrl) return '';
  return `<button type="button" class="proy-hero-img" onclick="event.stopPropagation(); abrirProyecto('${progId}','${pr.id}')" aria-label="Ver ejemplo: ${escapeHtml(pr.nombre)}"><img src="${escapeHtml(pr.imagenMiniUrl)}" alt="Ejemplo: ${escapeHtml(pr.nombre)}" loading="lazy"></button>`;
}

function proyectoCardHtml(progId, pr){
  const inner = (pr.imagenMiniUrl ? `<span class="proy-img"><img src="${escapeHtml(pr.imagenMiniUrl)}" alt="" loading="lazy"></span>` : '') +
    `<span class="proy-name">${escapeHtml(pr.nombre)}</span>` + (pr.resumen ? `<span class="proy-res">${escapeHtml(pr.resumen)}</span>` : '');
  return pr.imagenMiniUrl
    ? `<button type="button" class="proy-card has-img" onclick="event.stopPropagation(); abrirProyecto('${progId}','${pr.id}')" aria-label="Ver ejemplo: ${escapeHtml(pr.nombre)}">${inner}</button>`
    : `<div class="proy-card">${inner}</div>`;
}

// visor: imagen de ejemplo del proyecto en grande
function abrirProyecto(progId, projId){
  const prog = ((currentCatalogo && currentCatalogo.estandar) || []).find(x => x.id === progId);
  const pr = prog && (prog.proyectosDetalle || []).find(x => x.id === projId);
  if(!pr || !pr.imagenUrl) return;
  let dlg = document.getElementById('proyDialog');
  if(!dlg){
    document.body.insertAdjacentHTML('beforeend', `
      <dialog class="proy-dialog" id="proyDialog" aria-labelledby="proyTitulo">
        <div class="proy-dlg-head"><div><div class="proy-dlg-kicker">Ejemplo de proyecto</div><div class="proy-dlg-title" id="proyTitulo"></div></div>
          <button type="button" class="lead-dlg-close" id="proyCerrar" aria-label="Cerrar">${closeIcon}</button></div>
        <img class="proy-dlg-img" id="proyImg" alt="">
        <div class="proy-dlg-res" id="proyRes"></div>
      </dialog>`);
    dlg = document.getElementById('proyDialog');
    document.getElementById('proyCerrar').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if(e.target === dlg) dlg.close(); });
  }
  dlg.style.setProperty('--c', TOOL_COLOR[currentCat] || '#22c55e');
  document.getElementById('proyTitulo').textContent = pr.nombre;
  const img = document.getElementById('proyImg');
  img.src = pr.imagenUrl; img.alt = 'Ejemplo: ' + pr.nombre;
  document.getElementById('proyRes').textContent = pr.resumen || '';
  dlg.showModal();
}

// La descripción de un tema se parte SIN reescribirla: si el texto trae saltos de línea, cada línea es una viñeta
// y todo se ve; si es un párrafo, la primera oración queda a la vista y el resto va en "Ver detalle", una oración por renglón.
function partirDescripcion(txt){
  const t = String(txt || '').trim();
  if(!t) return { lead:'', resto:[], viñetas:false };
  if(/\n/.test(t)){
    const lineas = t.split(/\n+/).map(x => x.trim()).filter(Boolean);
    return { lead:'', resto:lineas, viñetas:true };
  }
  const oraciones = t.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/).map(x => x.trim()).filter(Boolean);
  return { lead:oraciones[0] || '', resto:oraciones.slice(1), viñetas:false };
}

function temaCardHtml(t, i){
  const d = partirDescripcion(t.descripcion);
  let cuerpo = '';
  if(d.viñetas){
    cuerpo = `<ul class="tema-lista">${d.resto.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
  } else {
    cuerpo = (d.lead ? `<p class="tema-lead">${escapeHtml(d.lead)}</p>` : '') +
      (d.resto.length
        ? `<div class="tema-resto" hidden>${d.resto.map(x => `<p>${escapeHtml(x)}</p>`).join('')}</div>
           <button type="button" class="tema-mas" aria-expanded="false" onclick="toggleTema(this)">Ver detalle ${chevronIcon}</button>`
        : '');
  }
  const ref = (i % 2 ? 'B' : 'A') + (Math.floor(i / 2) + 1);
  return `<div class="tema-card">
    <span class="tema-ref" aria-hidden="true">${ref}</span>
    <div class="tema-num">${i + 1}</div>
    <div class="tema-body"><b>${escapeHtml(t.nombre)}</b>${cuerpo}</div>
  </div>`;
}

function toggleTema(btn){
  const card = btn.closest('.tema-card');
  const resto = card.querySelector('.tema-resto');
  const abrir = resto.hidden;
  resto.hidden = !abrir;
  btn.setAttribute('aria-expanded', String(abrir));
  btn.classList.toggle('open', abrir);
  btn.firstChild.textContent = abrir ? 'Ocultar detalle ' : 'Ver detalle ';
}

function toggleTodoTemario(progId, btn){
  const abrir = btn.dataset.abierto !== '1';
  document.querySelectorAll('#temas-' + progId + ' .tema-card').forEach(card => {
    const resto = card.querySelector('.tema-resto');
    const b = card.querySelector('.tema-mas');
    if(!resto || !b) return;
    resto.hidden = !abrir;
    b.setAttribute('aria-expanded', String(abrir));
    b.classList.toggle('open', abrir);
    b.firstChild.textContent = abrir ? 'Ocultar detalle ' : 'Ver detalle ';
  });
  btn.dataset.abierto = abrir ? '1' : '0';
  btn.classList.toggle('open', abrir);
  btn.firstChild.textContent = abrir ? 'Ocultar todo el detalle ' : 'Ver todo el detalle ';
}

function programFnHtml(p){
  const temasHtml = (p.temas || []).map((t, i) => temaCardHtml(t, i)).join('');
  const hayDetalle = (p.temas || []).some(t => partirDescripcion(t.descripcion).resto.length);
  const nTemas = (p.temas || []).length;
  const proyN = (p.proyectosDetalle && p.proyectosDetalle.length) || (p.proyectos && p.proyectos.length) || 0;
  const resumenHtml = [
    nTemas + (nTemas === 1 ? ' tema' : ' temas'),
    p.horas ? p.horas + ' hr' : '',
    p.nivelLabel || '',
    proyN ? 'Proyecto práctico incluido' : '',
  ].filter(Boolean).map(t => `<span class="scope-chip">${escapeHtml(t)}</span>`).join('');
  // proyectos del programa: mini-tarjetas; con imagen de ejemplo se abre en grande al tocarla
  const proyDetalle = (p.proyectosDetalle && p.proyectosDetalle.length) ? p.proyectosDetalle : (p.proyectos || []).map(nm => ({ nombre: nm }));
  // el proyecto con imagen va de protagonista (grande, a la izquierda, junto a la leyenda); los demás, como ejemplos pequeños
  const heroIdx = Math.max(0, proyDetalle.findIndex(pr => pr.imagenMiniUrl));
  const proyHero = proyDetalle[heroIdx];
  const proyOtros = proyDetalle.filter((_, i) => i !== heroIdx);
  const proyectosHtml = proyDetalle.length
    ? `<div class="proy-banda">
        <div class="proy-titulo">PROYECTO PRÁCTICO</div>
        <div class="proy-banda-main">
          ${proyectoHeroHtml(p.id, proyHero)}
          <div class="proy-banda-texto">
            <p class="proy-leyenda">${LEYENDA_PROYECTO}</p>
            <div class="proy-hero-nombre">${escapeHtml(proyHero.nombre)}</div>
            ${proyHero.resumen ? `<p class="proy-hero-res">${escapeHtml(proyHero.resumen)}</p>` : ''}
            ${proyHero.imagenUrl ? `<button type="button" class="tema-mas" onclick="event.stopPropagation(); abrirProyecto('${p.id}','${proyHero.id}')">Ver el ejemplo en grande ${chevronIcon}</button>` : ''}
          </div>
        </div>
        ${proyOtros.length ? `<div class="proy-ejemplos">OTROS EJEMPLOS</div><div class="proy-grid">${proyOtros.map(pr => proyectoCardHtml(p.id, pr)).join('')}</div>` : ''}
      </div>` : '';

  return `
    <div class="program-fn" id="programFn-${p.id}">
      <div class="program-fn-head" onclick="toggleProgram('${p.id}')">
        <div class="program-fn-eyebrow"><span class="program-tool-ico">${toolIconInline(currentCat)}</span>${escapeHtml(NOMBRE_HERRAMIENTA.toUpperCase())}${p.nivelLabel ? ' · ' + escapeHtml(p.nivelLabel.toUpperCase()) : ''} · ${p.horas} HR</div>
        <div class="program-fn-title">${escapeHtml(p.nombre)}</div>
        <p class="program-fn-hook">${escapeHtml(p.objetivo)}</p>
        <div class="program-fn-toggle">Ver temario completo<svg class="program-fn-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      </div>
      <div class="program-fn-body">
        <div class="program-fn-inner">
          <div class="prog-resumen">${resumenHtml}</div>
          <div class="program-fn-obj prog-duo">
            ${p.dirigido ? `<div class="prog-celda"><span class="celda-ico">${ICO_PUBLICO}</span><div><h4>DIRIGIDO A</h4><p>${escapeHtml(p.dirigido)}</p></div></div>` : ''}
          </div>
          <div class="temario-head">
            <div class="proy-titulo" style="margin:0;">TEMARIO</div>
            ${hayDetalle ? `<button type="button" class="tema-mas tema-todo" data-abierto="0" onclick="toggleTodoTemario('${p.id}', this)">Ver todo el detalle ${chevronIcon}</button>` : ''}
          </div>
          <div class="temas-grid" id="temas-${p.id}">${temasHtml}</div>
          ${proyectosHtml}
          <div class="prog-cierre">
            <div class="prog-cierre-txt"><b>¿Listo para cotizar este programa?</b><span>Te entregamos la cotización en un máximo de 24 hr.</span></div>
            <button type="button" class="builder-cta" onclick="event.stopPropagation(); openLeadForm('${p.id}')">
              Solicitar cotización
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function toggleProgram(id){
  document.getElementById('programFn-' + id).classList.toggle('open');
}

// ---- solicitud de cotización: UN diálogo compartido (antes un formulario de 8 campos por tarjeta,
// dentro del acordeón). Lo esencial va primero (nombre, correo o WhatsApp, empresa); participantes,
// participantes, modalidad y comentarios también están a la vista (fecha y ciudad ya no se piden). ----
const chevronIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const closeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let leadProgId = null;      // programa para el que está armado el diálogo
let leadAbiertoEn = Date.now(); // cuándo se armó el formulario: el servidor rechaza envíos de menos de 2 s (antispam)
let leadEstado = 'form';    // 'form' | 'enviado'

function leadBodyHTML(){
  return `
    <div class="lead-fields lead-grid2">
      <div class="lead-field">
        <label for="leadName">Tu nombre *</label>
        <input type="text" id="leadName" placeholder="¿Cómo te llamas?" autocomplete="name" maxlength="200">
      </div>
      <div class="lead-field">
        <label for="leadCo">Empresa <span class="lead-opt">(opcional)</span></label>
        <input type="text" id="leadCo" placeholder="Tu empresa" autocomplete="organization" maxlength="200">
      </div>
      <div class="lead-field">
        <label for="leadMail">Correo</label>
        <input type="email" id="leadMail" placeholder="tu@empresa.com" autocomplete="email" inputmode="email" maxlength="200">
      </div>
      <div class="lead-field">
        <label for="leadWa">WhatsApp</label>
        <input type="tel" id="leadWa" placeholder="Con lada, ej. 81 1234 5678" autocomplete="tel" inputmode="tel" maxlength="40">
      </div>
      <div class="lead-note lead-full">Déjanos al menos uno de los dos para poder responderte.</div>
      <div class="lead-field">
        <label for="leadPart">Participantes *</label>
        <select id="leadPart">
          <option value="">Selecciona…</option>
          <option value="Solo yo">Solo yo</option>
          <option value="5 a 10">5 a 10</option>
          <option value="10 a 15">10 a 15</option>
          <option value="Más de 15">Más de 15</option>
          <option value="otro">Otro número…</option>
        </select>
        <input type="number" id="leadPartNum" min="1" max="5000" inputmode="numeric" placeholder="¿Cuántas personas?" style="margin-top:8px;" hidden>
      </div>
      <div class="lead-field">
        <label for="leadMod">Modalidad <span class="lead-opt">(opcional)</span></label>
        <select id="leadMod">
          <option value="">Selecciona…</option>
          <option value="Online">Online</option>
          <option value="Presencial">Presencial</option>
          <option value="Híbrido">Híbrido</option>
        </select>
      </div>
      <div class="lead-field lead-full">
        <label for="leadComments">Comentarios <span class="lead-opt">(opcional)</span></label>
        <textarea id="leadComments" rows="3" placeholder="Describe aquí tu necesidad particular o comentarios a considerar." maxlength="2000"></textarea>
      </div>
    </div>
    <input type="text" id="leadWeb" name="web" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;" aria-hidden="true">
    <div class="lead-error" id="leadErr" role="alert" hidden></div>
    <div class="lead-form-actions">
      <button type="button" class="lead-btn send" id="leadSend">Enviar solicitud</button>
    </div>`;
}

function ensureLeadDialog(){
  let dlg = document.getElementById('leadDialog');
  if(dlg) return dlg;
  document.body.insertAdjacentHTML('beforeend', `
    <dialog class="lead-dialog" id="leadDialog" aria-labelledby="leadTitle">
      <div class="lead-dlg-head">
        <span class="lead-dlg-ico" id="leadIco"></span>
        <div class="lead-dlg-titles">
          <div class="lead-dlg-kicker">Solicitar cotización</div>
          <div class="lead-dlg-title" id="leadTitle"></div>
          <div class="lead-dlg-meta" id="leadMeta"></div>
        </div>
        <button type="button" class="lead-dlg-close" id="leadClose" aria-label="Cerrar">${closeIcon}</button>
      </div>
      <div class="lead-dlg-body" id="leadBody"></div>
    </dialog>`);
  dlg = document.getElementById('leadDialog');
  document.getElementById('leadClose').addEventListener('click', () => dlg.close());
  // clic en el fondo oscuro (fuera de la tarjeta) cierra
  dlg.addEventListener('click', e => { if(e.target === dlg) dlg.close(); });
  dlg.addEventListener('click', e => { if(e.target.closest('#leadSend')) sendLead(); });
  dlg.addEventListener('change', e => {
    if(e.target.id !== 'leadPart') return;
    const num = document.getElementById('leadPartNum');
    num.hidden = e.target.value !== 'otro';
    if(!num.hidden) num.focus();
  });
  return dlg;
}

function openLeadForm(id){
  const p = ((currentCatalogo && currentCatalogo.estandar) || []).find(x => x.id === id);
  if(!p) return;
  const dlg = ensureLeadDialog();
  const toolTitle = NOMBRE_HERRAMIENTA;
  dlg.style.setProperty('--c', TOOL_COLOR[currentCat] || '#22c55e');
  document.getElementById('leadIco').innerHTML = toolIconInline(currentCat);
  document.getElementById('leadTitle').textContent = p.nombre;
  document.getElementById('leadMeta').textContent = (toolTitle + ' · ' + p.horas + ' hr').toUpperCase();
  // se conserva lo escrito si se cierra y se vuelve a abrir el mismo programa; si no, formulario limpio
  if(leadProgId !== id || leadEstado !== 'form'){
    document.getElementById('leadBody').innerHTML = leadBodyHTML();
    leadProgId = id; leadEstado = 'form'; leadAbiertoEn = Date.now();
  }
  dlg.showModal();
  document.getElementById('leadName')?.focus();
}

// reintento con pausas crecientes — mismo patrón que encuesta.html/diagnostico.html
// para cualquier Function que toque apcweb-backoffice (puede estar "dormida").
const REINTENTO_PAUSAS_MS = [4000, 8000, 15000];
async function apiPostJson(url, data){
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
  const body = await res.json().catch(() => ({}));
  if(!res.ok){ const err = new Error(body.error || 'Error de red'); err.status = res.status; throw err; }
  return body;
}
const esErrorDefinitivo = e => e && e.status >= 400 && e.status < 500;

// crea la Solicitud real en el admin: ya es el ÚNICO canal del formulario. Con la base
// dormida el servidor puede tardar más de lo que aguanta Static Web Apps (llega un 504 aunque
// sigue y termina); por eso se reintenta con pausas y la Function es idempotente (mismo envío
// = misma Solicitud, nunca duplicada). Devuelve true si quedó registrada.
async function crearSolicitudPublica(id, extra, onReintento){
  const p = ((currentCatalogo && currentCatalogo.estandar) || []).find(x => x.id === id);
  if(!p) throw new Error('Programa no encontrado.');
  const payload = {
    nombre: extra.name, correo: extra.correo, whatsapp: extra.whatsapp, empresa: extra.co, herramienta: currentCat,
    temario_nombre: p.nombre, temas: p.temas, horas_totales: p.horas,
    participantes: extra.participantes, modalidad: extra.modalidad,
    comentarios: extra.comentarios,
    web: (document.getElementById('leadWeb')?.value || ''),
    tf: Date.now() - leadAbiertoEn,
  };
  for(let intento = 0; intento <= REINTENTO_PAUSAS_MS.length; intento++){
    try { await apiPostJson('/api/crearSolicitudPublica', payload); return true; }
    catch(err){
      if(esErrorDefinitivo(err)) throw err; // validación: se le muestra tal cual
      if(intento === REINTENTO_PAUSAS_MS.length){ console.error('No se pudo registrar la solicitud:', err); return false; }
      if(onReintento) onReintento();
      await new Promise(r => setTimeout(r, REINTENTO_PAUSAS_MS[intento]));
    }
  }
  return false;
}

async function sendLead(){
  const id = leadProgId;
  const btn = document.getElementById('leadSend');
  const errEl = document.getElementById('leadErr');
  if(!id || !btn || btn.disabled) return; // evita el doble clic
  const val = k => (document.getElementById(k)?.value || '').trim();
  const name = val('leadName'), correo = val('leadMail'), whatsapp = val('leadWa');
  const mostrarError = (msg, campo) => { errEl.textContent = msg; errEl.hidden = false; if(campo) document.getElementById(campo)?.focus(); };
  errEl.hidden = true;
  if(!name) return mostrarError('Escribe tu nombre.', 'leadName');
  if(!correo && !whatsapp) return mostrarError('Déjanos tu correo o tu WhatsApp para poder responderte.', 'leadMail');
  if(correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return mostrarError('El correo no parece válido.', 'leadMail');
  if(whatsapp && (whatsapp.replace(/\D/g, '').length < 8)) return mostrarError('El WhatsApp no parece válido (incluye la lada).', 'leadWa');
  let participantes = val('leadPart');
  if(!participantes) return mostrarError('Indica cuántas personas participarán.', 'leadPart');
  if(participantes === 'otro'){
    participantes = val('leadPartNum');
    if(!/^\d+$/.test(participantes) || Number(participantes) < 1) return mostrarError('Escribe cuántas personas participarán (un número).', 'leadPartNum');
  }

  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    const ok = await crearSolicitudPublica(id, {
      name, correo, whatsapp, co: val('leadCo'),
      comentarios: val('leadComments'),
      participantes,
      modalidad: val('leadMod'),
    }, () => { btn.textContent = 'Seguimos intentando…'; });
    if(ok){
      leadEstado = 'enviado';
      document.getElementById('leadBody').innerHTML =
        '<div class="lead-ok" role="status"><b>Listo, ' + escapeHtml(name) + '.</b> Recibimos tu solicitud y te contactaremos pronto.</div>' +
        '<div class="lead-form-actions"><button type="button" class="lead-btn" id="leadDone">Cerrar</button></div>';
      document.getElementById('leadDone').addEventListener('click', () => document.getElementById('leadDialog').close());
      return;
    }
    mostrarError('No pudimos enviar tu solicitud en este momento. Inténtalo de nuevo en unos minutos o escríbenos a alfredo.pina@lifezen.com.mx.');
  } catch(e){
    mostrarError(e && e.message ? e.message : 'No pudimos enviar tu solicitud. Revisa tus datos e inténtalo de nuevo.');
  }
  btn.disabled = false;
  btn.textContent = 'Enviar solicitud';
}

// la página ya sabe de qué herramienta es: carga su catálogo al terminar de cargar
window.addEventListener('load', () => activateTab(HERRAMIENTA));
