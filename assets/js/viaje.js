// assets/js/viaje.js
// Motor de "viaje" (scrollytelling con GSAP ScrollTrigger) embebido en
// cursos.html, arriba del catálogo de cada herramienta. Este archivo es SOLO el motor
// (ViajeEngine + ViajeHerramienta); el contenido de cada herramienta vive en su propio
// archivo y se registra en window.ViajeEscenas: viaje-xl.js (Excel), viaje-bi.js,
// viaje-ofi.js, viaje-ia.js, viaje-pa.js, viaje-auto.js. Para replicarlo en otra
// herramienta: escribir su propio renderHtml()/iniciar() con el mismo patrón.
//
// Decisiones que NO hay que repetir si esto se toca:
//   - El offset de pin (NAV) se mide en vivo (nav + .cat-nav-wrap), nunca se
//     hardcodea — cursos.html tiene DOS barras sticky (nav + cat-nav-wrap),
//     a diferencia del prototipo original que solo tenía una.
//   - Dos modos sin pin: ESTÁTICO (prefers-reduced-motion o GSAP caído: todo en su
//     estado final) y MÓVIL (teléfono táctil real: pointer:coarse + max-width:560px;
//     las escenas fluyen en vertical y cada bloque se anima UNA vez al entrar en
//     pantalla, sin scrub) — nunca por ancho de ventana a secas (ver CLAUDE_DETALLE.md).
(function () {
  "use strict";

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const ViajeEngine = {
    shuffle,
    esSimpleMode() {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const telefono = window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width:560px)").matches;
      const gsapListo = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
      return { simple: reduced || !gsapListo, telefono, gsapListo };
    },
    navOffset(root) {
      const nav = document.querySelector("nav");
      const catNav = root.closest("main")?.querySelector(".cat-nav-wrap") || document.querySelector(".cat-nav-wrap");
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      const catNavH = catNav ? catNav.getBoundingClientRect().height : 0;
      return Math.round(navH + catNavH);
    },
    forceFinalState(root) {
      root.classList.add("viaje-simple", "viaje-flujo");
      root.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
      root.querySelectorAll("[data-anim-final]").forEach((el) => {
        const prop = el.dataset.animProp, val = el.dataset.animFinal;
        if (prop === "width-pct") el.style.width = val + "%";
        else if (prop === "height-pct") el.style.height = val + "%";
        else el.setAttribute(prop, val);
      });
      root.querySelectorAll(".formula-msg-text").forEach((el) => { el.style.clipPath = "inset(0 0% 0 0)"; });
    },

    // ---- utilidades de lienzo compartidas por los viajes con transiciones entre escenas (Power BI, Ofimática) ----
    // posición/tamaño de un elemento en coordenadas del lienzo (offsetLeft/Top: ignoran transforms; wrap debe estar posicionado)
    rel(el, wrap) {
      let x = 0, y = 0, n = el;
      while (n && n !== wrap) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
    },
    cen(el, wrap) { const r = ViajeEngine.rel(el, wrap); return [r.x + r.w / 2, r.y + r.h / 2]; },
    // ---- ganchos de scroll compartidos por los héroes (Excel; Power BI tiene su copia, se unifica al replicar a los demás) ----
    // flecha "Sigue bajando": aparece sola tras 2.5 s sin mover el scroll durante el recorrido, se va al moverlo y no sale
    // en la última escena (el viaje pone est.fin = true). Devuelve el estado { fin }.
    flechaMas(mas) {
      const est = { fin: false }; let calma = null;
      const oculta = () => { mas.classList.remove("on"); clearTimeout(calma); calma = setTimeout(() => { if (!est.fin && mas.isConnected && document.body.classList.contains("bi-hoja")) mas.classList.add("on"); }, 2500); };
      window.addEventListener("scroll", oculta, { passive: true }); oculta();
      return est;
    },
    // auto-scroll del héroe: la barrita .hb-bar del botón se llena en 5 s y llama a irA(); una vez por visita, lo cancela
    // cualquier gesto (rueda, toque, tecla, clic) o ya haber hecho scroll; no corre con reducir-movimiento.
    autoBajar(root, irA) {
      const bar = root.querySelector(".hb-bar");
      if (!bar || window._hbAuto || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.scrollY > 40) return;
      const eventos = ["wheel", "touchstart", "keydown", "pointerdown"];
      let activo = true, tw = null;
      const limpia = () => { activo = false; eventos.forEach((e) => window.removeEventListener(e, cancela)); window.removeEventListener("scroll", alScroll); };
      const cancela = () => { if (!activo) return; limpia(); if (tw) tw.kill(); gsap.to(bar, { opacity: 0, duration: 0.3 }); };
      const alScroll = () => { if (window.scrollY > 40) cancela(); };
      tw = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 5, ease: "none", onComplete: () => { if (!activo || !root.isConnected) return; limpia(); window._hbAuto = true; gsap.to(bar, { opacity: 0, duration: 0.3 }); irA(); } });
      eventos.forEach((e) => window.addEventListener(e, cancela, { passive: true }));
      window.addEventListener("scroll", alScroll, { passive: true });
    },
    // mensaje que "se escribe" (clip-path de izquierda a derecha)
    tipea(tl, el, t, d) { return tl.to(el, { clipPath: "inset(0 0% 0 0)", duration: d, ease: "none" }, t); },
    // un objeto se vuelve otro: el contenido de "desde" se apaga, un marco fantasma (.viaje-ghost) viaja de su caja a la de
    // "hacia" (anima left/top/width/height reales: el texto nunca se deforma) y el contenido de "hacia" se enciende al llegar.
    // clonar=true: el marco lleva una copia del contenido de "desde" (recortada al encogerse) para que no viaje vacío.
    morph(tl, desde, hacia, canvas, t, d, clonar) {
      const rel = ViajeEngine.rel;
      const fantasma = document.createElement("div");
      fantasma.className = "viaje-ghost";
      if (clonar) {
        const copia = desde.cloneNode(true);
        copia.removeAttribute("id"); copia.classList.remove("reveal"); copia.style.cssText = "position:absolute;left:0;top:0;margin:0;opacity:1;width:" + desde.offsetWidth + "px;height:" + desde.offsetHeight + "px";
        copia.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
        // la copia se hace al construir (todo está oculto por .reveal): se muestra el contenido ya completo
        copia.querySelectorAll(".reveal").forEach((n) => { n.style.opacity = 1; });
        fantasma.appendChild(copia);
      }
      canvas.appendChild(fantasma);
      const caja = (el) => () => { const r = rel(el, canvas); return { left: r.x, top: r.y, width: r.w, height: r.h }; };
      const a = caja(desde), c = caja(hacia);
      tl.fromTo(fantasma, { left: () => a().left, top: () => a().top, width: () => a().width, height: () => a().height, opacity: 0 },
        { opacity: 1, duration: 1.5, ease: "none" }, t);
      tl.to(desde, { opacity: 0, duration: 4, ease: "none" }, t);
      tl.to(fantasma, { left: () => c().left, top: () => c().top, width: () => c().width, height: () => c().height, duration: d - 5, ease: "power2.inOut" }, t + 2);
      tl.fromTo(hacia, { opacity: 0 }, { opacity: 1, duration: 4, ease: "none" }, t + d - 5);
      tl.to(fantasma, { opacity: 0, duration: 2, ease: "none" }, t + d - 2);
    },
  };

  // el motor y el registro se exponen para que cada herramienta (viaje-xl.js, viaje-bi.js...) se enchufe sin tocar este archivo
  window.ViajeEngine = ViajeEngine;
  const VIAJE_SCENES = window.ViajeEscenas = {};   // cada viaje (viaje-xl.js, viaje-bi.js...) se registra aquí

  window.ViajeHerramienta = {
    tieneConfig(cat) { return !!VIAJE_SCENES[cat]; },
    html(cat) { return VIAJE_SCENES[cat] ? VIAJE_SCENES[cat].renderHtml() : ""; },
    iniciar(cat) { if (VIAJE_SCENES[cat]) VIAJE_SCENES[cat].iniciar(); },
    // al cambiar de herramienta el panel se reemplaza: hay que soltar los pins viejos
    destruir() { if (window.ScrollTrigger) ScrollTrigger.getAll().forEach((t) => t.kill()); document.body.classList.remove("viaje-on", "viaje-hoja", "bi-on", "bi-hoja"); if (window._viajeResize) { window.removeEventListener("resize", window._viajeResize); window._viajeResize = null; } },
  };
})();
