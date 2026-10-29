// sitio.js — aplica lo que Alfredo configuró en admin → Personalizar (api/getConfiguracionSitio) sobre cualquier página pública con el encabezado
// y pie compartidos: contacto del pie, ligas de perfiles y la franja de aviso. Todo lo que NO esté guardado se queda con el HTML de siempre,
// y si la lectura falla (sin red, función caída) no pasa nada: el sitio se ve como antes. El LinkedIn de la portada lo maneja linkedin.js.
// Seguridad: cada liga se vuelve a revisar aquí antes de ponerla (https, o una página del sitio que empiece con "/"), y el texto del aviso
// entra como TEXTO (textContent), nunca como HTML.
(() => {
  const https = (u, hosts) => { try { const x = new URL(u); return x.protocol === 'https:' && (!hosts || hosts.includes(x.hostname)) ? x.href : null; } catch (e) { return null; } };
  const LINKEDIN = ['www.linkedin.com'], YOUTUBE = ['www.youtube.com', 'youtube.com', 'youtu.be'];
  const enlace = (u) => (typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') && !u.includes('\\') ? u : https(u));
  const hoyMonterrey = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

  function contacto(c) {
    if (!c) return;
    if (typeof c.correo === 'string' && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(c.correo)) {
      document.querySelectorAll('[data-sitio="correo"]').forEach((a) => { a.href = 'mailto:' + c.correo; });
    }
    if (typeof c.whatsapp === 'string' && /^\d{11,15}$/.test(c.whatsapp)) {
      document.querySelectorAll('[data-sitio="whatsapp"]').forEach((a) => { a.href = 'https://wa.me/' + c.whatsapp; });
    }
  }

  function perfiles(p) {
    if (!p) return;
    const personal = https(p.linkedinPersonal, LINKEDIN);
    if (personal) document.querySelectorAll('[data-sitio="linkedin-personal"]').forEach((a) => { a.href = personal; });
    // LinkedIn de la empresa y YouTube salen en el pie solo si Alfredo los llenó
    const meta = document.querySelector('.contact-meta');
    if (!meta) return;
    const copyright = meta.querySelector('span');
    [['linkedinEmpresa', 'LinkedIn', LINKEDIN], ['youtube', 'YouTube', YOUTUBE]].forEach(([k, nombre, hosts]) => {
      const href = https(p[k], hosts);
      if (!href || meta.querySelector('[data-sitio-red="' + k + '"]')) return;
      const a = document.createElement('a');
      a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = nombre; a.setAttribute('data-sitio-red', k);
      meta.insertBefore(a, copyright);
    });
  }

  function aviso(a) {
    if (!a || !a.activo || typeof a.texto !== 'string' || !a.texto.trim()) return;
    if (a.hasta && /^\d{4}-\d{2}-\d{2}$/.test(a.hasta) && a.hasta < hoyMonterrey()) return; // ya venció
    if (document.querySelector('.aviso-sitio')) return;
    const barra = document.createElement('div');
    barra.className = 'aviso-sitio'; barra.setAttribute('role', 'status');
    const txt = document.createElement('span'); txt.textContent = a.texto;
    barra.appendChild(txt);
    const href = enlace(a.enlace);
    if (href) { const l = document.createElement('a'); l.href = href; l.textContent = 'Ver →'; barra.appendChild(l); }
    document.body.insertBefore(barra, document.body.firstChild);
  }

  fetch('/api/getConfiguracionSitio')
    .then((r) => (r.ok ? r.json() : null))
    .then((c) => { if (!c || typeof c !== 'object') return; contacto(c.contacto); perfiles(c.perfiles); aviso(c.aviso); })
    .catch(() => {});
})();
