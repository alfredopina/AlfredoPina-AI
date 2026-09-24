// titular del hero: se escribe letra por letra (el texto completo queda en el DOM para lectores de pantalla y buscadores)
{
  const h = document.querySelector('h1.hero-tagline');
  if (h && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const caret = h.querySelector('.caret');
    h.setAttribute('aria-label', h.textContent);
    const letras = [];
    const recorrer = (nodo) => [...nodo.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const f = document.createDocumentFragment();
        [...n.textContent].forEach((ch) => {
          const sp = document.createElement('span');
          sp.textContent = ch;
          sp.style.visibility = 'hidden';
          sp.setAttribute('aria-hidden', 'true');
          f.appendChild(sp);
          letras.push(sp);
        });
        n.replaceWith(f);
      } else if (n.nodeType === 1 && n !== caret && n.tagName !== 'BR') recorrer(n);
    });
    recorrer(h);
    let i = 0;
    const paso = () => { if (i < letras.length) { letras[i++].style.visibility = 'visible'; setTimeout(paso, 42); } };
    setTimeout(paso, 350);
  }
}

// signature "active cell" selector
  const targets = [
    { el: document.querySelector('h1.hero-tagline'), label: 'A1' },
    { el: document.querySelectorAll('.stats-grid .cell')[1], label: 'B4' },
    { el: document.querySelectorAll('.insight-card')[2], label: 'D6' },
    { el: document.querySelectorAll('.kpi-card')[1], label: 'E5' },
    { el: document.querySelector('.geo-panel'), label: 'E9' },
    { el: document.querySelectorAll('.cert-card')[0], label: 'F4' },
    { el: document.querySelector('.courses-grid'), label: 'G1' },
  ].filter(t => t.el);

  const box = document.createElement('div');
  box.className = 'selector-box';
  const label = document.createElement('div');
  label.className = 'selector-label';
  box.appendChild(label);
  document.body.appendChild(box);

  let i = 0;
  function place(){
    const t = targets[i % targets.length];
    const r = t.el.getBoundingClientRect();
    box.style.top = (r.top + window.scrollY - 6) + 'px';
    box.style.left = (r.left - 6) + 'px';
    box.style.width = (r.width + 12) + 'px';
    box.style.height = (r.height + 12) + 'px';
    label.textContent = t.label;
    i++;
  }
  window.addEventListener('load', () => { place(); setInterval(place, 3200); });
  window.addEventListener('resize', place);

  // animated counters
  function animateCount(el){
    const target = parseInt(el.getAttribute('data-target'), 10);
    const dur = 1400;
    const start = performance.now();
    function tick(now){
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.floor(eased * target);
      el.textContent = val.toLocaleString('es-MX');
      if(p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString('es-MX');
    }
    requestAnimationFrame(tick);
  }
  const statsSection = document.querySelector('.stats');
  if(statsSection){
    let counted = false;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if(e.isIntersecting && !counted){
          counted = true;
          statsSection.querySelectorAll('.count').forEach(animateCount);
        }
      });
    }, { threshold: .4 });
    obs.observe(statsSection);
  }

  // EXPERIENCIA — dashboard: contadores propios + radar de anillos (Monterrey → México → LatAm → América)
  const dashSection = document.querySelector('#experiencia');
  if(dashSection){
    let dashCounted = false;
    const dashObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if(e.isIntersecting && !dashCounted){
          dashCounted = true;
          dashSection.querySelectorAll('.count').forEach(animateCount);
          dashSection.querySelectorAll('.kpi-card').forEach(c => c.classList.add('in-view'));
          const rings = Array.from(dashSection.querySelectorAll('.radar-ring'))
            .sort((a,b) => parseFloat(a.getAttribute('r')) - parseFloat(b.getAttribute('r')));
          rings.forEach((el, i) => setTimeout(() => el.classList.add('lit'), 150 + i * 280));
          const labels = [
            dashSection.querySelector('.radar-label-mty'),
            dashSection.querySelector('.radar-label-mx'),
            dashSection.querySelector('.radar-label-latam'),
            dashSection.querySelector('.radar-label-am'),
          ];
          labels.forEach((el, i) => { if(el) setTimeout(() => el.classList.add('lit'), 150 + i * 280); });
        }
      });
    }, { threshold: .3 });
    dashObs.observe(dashSection);
  }

  // insight cards spark-bar reveal
  const cardObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: .35 });
  document.querySelectorAll('.insight-card').forEach(c => cardObs.observe(c));

  // cursos — fade-in on scroll
  const courseObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: .2 });
  document.querySelectorAll('.course-card').forEach(c => courseObs.observe(c));
