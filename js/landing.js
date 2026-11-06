// Landing page scroll story. One rAF loop owns section progress, the demo typing, field fills, organ lighting
// and the tally numbers. Anime.js (window.anime) tweens the tally numbers and reveals the path steps.
// Without JS, on small screens, or with reduced motion, every section shows its finished state.
(function () {
  'use strict';
  const A = window.anime;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const roomy = window.matchMedia('(min-width: 1001px) and (min-height: 701px)');
  const root = document.documentElement;

  const demo = document.querySelector('[data-scrub="demo"]');
  const donor = document.querySelector('[data-scrub="donor"]');
  const typeBox = demo.querySelector('[data-type]');
  const fullText = typeBox.textContent;
  const fields = Array.from(demo.querySelectorAll('[data-field]'));
  const done = demo.querySelector('.demo-done');
  const filledCount = demo.querySelector('[data-filled]');

  // Organs light in this order: organs that save lives first, tissue last.
  const ORDER = ['o-heart', 'o-lungs', 'o-liver', 'o-kidneys', 'o-pancreas', 'o-intestine', 'o-eyes', 'o-skin', 'o-bones'];
  const organs = ORDER.map((cls) => donor.querySelector('.' + cls));
  const tissueCount = organs.filter((o) => o.dataset.kind === 'tissue').length;
  const livesBox = donor.querySelector('[data-lives]');
  const tissueBox = donor.querySelector('[data-tissue]');
  const shown = { lives: 8, tissue: 75 };

  function tweenNumber(key, box, value) {
    if (shown[key] === value) return;
    const from = { v: shown[key] };
    shown[key] = value;
    if (!A || still.matches) { box.textContent = String(value); return; }
    A.animate(from, { v: value, duration: 420, ease: 'out(3)', modifier: Math.round,
      onUpdate: () => { box.textContent = String(from.v); } });
  }

  function progress(section) {
    const rect = section.getBoundingClientRect();
    const travel = rect.height - window.innerHeight + 68;
    return Math.min(1, Math.max(0, -rect.top / Math.max(1, travel)));
  }

  function renderDemo(p) {
    const chars = Math.round(fullText.length * Math.min(1, p / 0.5));
    typeBox.textContent = fullText.slice(0, chars);
    typeBox.classList.toggle('is-typing', chars < fullText.length);
    let on = 0;
    fields.forEach((field, i) => {
      const lit = p > 0.42 + i * (0.46 / fields.length);
      field.classList.toggle('is-on', lit);
      if (lit) on++;
    });
    filledCount.textContent = String(on);
    done.classList.toggle('is-on', on === fields.length);
    demo.style.setProperty('--p', p.toFixed(3));
  }

  function renderDonor(p) {
    let lives = 0;
    let tissue = 0;
    organs.forEach((organ, i) => {
      const lit = p > 0.06 + i * 0.09;
      organ.classList.toggle('is-on', lit);
      if (!lit) return;
      if (organ.dataset.kind === 'tissue') tissue++;
      else lives += Number(organ.dataset.lives || 0);
    });
    tweenNumber('lives', livesBox, lives);
    tweenNumber('tissue', tissueBox, Math.round((75 * tissue) / tissueCount));
  }

  function finished() {
    root.classList.remove('is-scrub');
    typeBox.textContent = fullText;
    typeBox.classList.remove('is-typing');
    fields.forEach((f) => f.classList.add('is-on'));
    organs.forEach((o) => o.classList.add('is-on'));
    filledCount.textContent = String(fields.length);
    done.classList.add('is-on');
    shown.lives = 8; shown.tissue = 75;
    livesBox.textContent = '8';
    tissueBox.textContent = '75';
  }

  let frame = 0;
  function tick() {
    frame = 0;
    renderDemo(progress(demo));
    renderDonor(progress(donor));
  }
  function request() { if (!frame && root.classList.contains('is-scrub')) frame = requestAnimationFrame(tick); }

  function setMode() {
    if (roomy.matches && !still.matches) {
      root.classList.add('is-scrub');
      tick();
    } else {
      finished();
    }
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request, { passive: true });
  roomy.addEventListener('change', setMode);
  still.addEventListener('change', setMode);
  setMode();

  // Path steps rise in once when they enter the screen.
  const steps = document.querySelectorAll('[data-step]');
  if (A && !still.matches && 'IntersectionObserver' in window) {
    steps.forEach((s) => { s.style.opacity = '0'; });
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      A.animate(steps, { opacity: [0, 1], y: [24, 0], duration: 700, ease: 'out(4)', delay: A.stagger(120) });
    }, { threshold: 0.25 });
    io.observe(document.querySelector('.path-steps'));
  }
})();
