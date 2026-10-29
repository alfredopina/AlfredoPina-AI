// Sección "Lo último en LinkedIn": muestra la publicación incrustada que Alfredo configura en admin → Personalizar (api/getConfiguracionSitio).
// Si no hay nada guardado ahí, o la lectura falla, usa assets/data/linkedin.json de siempre. Si la liga no es una publicación incrustada de
// LinkedIn, o Alfredo apagó la sección, se queda oculta.
(() => {
  const seccion = document.getElementById('linkedin');
  const cont = document.getElementById('liEmbed');
  if (!seccion || !cont) return;
  const mostrar = (d) => {
    if (!d || typeof d.embed !== 'string' || !/^https:\/\/www\.linkedin\.com\/embed\/feed\/update\//.test(d.embed)) return;
    const f = document.createElement('iframe');
    f.src = d.embed;
    f.title = 'Publicación reciente de Alfredo Piña en LinkedIn';
    f.loading = 'lazy';
    f.setAttribute('allowfullscreen', '');
    f.style.height = (Number(d.alto) || 560) + 'px';
    cont.appendChild(f);
    seccion.hidden = false;
  };
  fetch('/api/getConfiguracionSitio')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((c) => {
      if (c && c.linkedin) { if (c.linkedin.mostrar !== false) mostrar({ embed: c.linkedin.embed, alto: c.linkedin.alto }); return null; }
      return fetch('/assets/data/linkedin.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then(mostrar);
    })
    .catch(() => {});
})();
