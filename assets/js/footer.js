// Pie con la fórmula de contacto: se "escribe" al entrar a la vista.
(() => {
  const footer = document.querySelector('#contacto');
  const bar = document.getElementById('formulaBar');
  if (!footer || !bar) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    bar.classList.add('in-view');
    return;
  }
  new IntersectionObserver((entries, obs) => {
    if (entries.some((e) => e.isIntersecting)) { bar.classList.add('in-view'); obs.disconnect(); }
  }, { threshold: 0.35 }).observe(footer);
})();
