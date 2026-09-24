// Menú móvil del encabezado: abre/cierra la lista de enlaces bajo 600 px.
(() => {
  const nav = document.querySelector('nav');
  const btn = nav && nav.querySelector('.nav-toggle');
  if (!btn) return;
  const set = (abierto) => {
    nav.classList.toggle('open', abierto);
    btn.setAttribute('aria-expanded', String(abierto));
    btn.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  };
  btn.addEventListener('click', () => set(!nav.classList.contains('open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('.nav-links a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
})();
