// Sección "Lo último en LinkedIn": muestra la publicación incrustada indicada en assets/data/linkedin.json.
// Si el archivo no trae una URL de embed válida, la sección se queda oculta.
(() => {
  const seccion = document.getElementById('linkedin');
  const cont = document.getElementById('liEmbed');
  if (!seccion || !cont) return;
  fetch('/assets/data/linkedin.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || typeof d.embed !== 'string' || !/^https:\/\/www\.linkedin\.com\/embed\/feed\/update\//.test(d.embed)) return;
      const f = document.createElement('iframe');
      f.src = d.embed;
      f.title = 'Publicación reciente de Alfredo Piña en LinkedIn';
      f.loading = 'lazy';
      f.setAttribute('allowfullscreen', '');
      f.style.height = (Number(d.alto) || 560) + 'px';
      cont.appendChild(f);
      seccion.hidden = false;
    })
    .catch(() => {});
})();
