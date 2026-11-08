// Anime.js 4.5.0. Owns translateY on .btn-primary, .btn-send and .btn-ghost.
// Also owns the hero title split, colour wave, chip fade and number count when a hero is present.
// CSS owns button shadows. The 3D hero transforms stay with js/common.js and CSS.
(function () {
  'use strict';
  const A = window.anime;
  if (!A) return;
  const { animate, splitText, stagger } = A;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Anime owns translateY on the clay buttons. CSS owns the shadow lip.
  if (!still) {
    document.querySelectorAll('.btn-primary, .btn-send, .btn-ghost').forEach((btn) => {
      let running = null;
      let pressed = false;
      const move = (y, duration) => {
        if (running && typeof running.revert === 'function') {
          try { running.revert(); } catch (err) { /* the tween already ended */ }
        }
        running = animate(btn, { y: y, duration: duration, ease: 'out(3)' });
      };
      const down = () => {
        if (btn.disabled || pressed) return;
        pressed = true;
        move('4px', 90);
      };
      const up = () => {
        if (!pressed) return;
        pressed = false;
        move('0px', 220);
      };
      btn.addEventListener('pointerdown', (event) => {
        if (btn.disabled) return;
        if (typeof btn.setPointerCapture === 'function') {
          try { btn.setPointerCapture(event.pointerId); } catch (err) { /* already captured */ }
        }
        down();
      });
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
      btn.addEventListener('keydown', (event) => {
        if (event.repeat) return;
        const space = event.key === ' ' && btn.tagName === 'BUTTON';
        if (event.key === 'Enter' || space) down();
      });
      btn.addEventListener('keyup', (event) => {
        const space = event.key === ' ' && btn.tagName === 'BUTTON';
        if (event.key === 'Enter' || space) up();
      });
    });
  }

  if (!still) brandMotion();

  // Header brand: the SPMC logo then the SHARE logo spring in, the SHARE letters rise, and the subtitle
  // slides in. The full intro plays once per browser tab; later pages only get the idle heartbeat.
  // Every 9 s the SHARE logo beats twice; hovering the brand tilts both logos.
  function brandMotion() {
    const brand = document.querySelector('.brand');
    if (!brand) return;
    const spmc = brand.querySelector('.brand-spmc');
    const share = brand.querySelector('.brand-share');
    const word = brand.querySelector('.brand-text b');
    const sub = brand.querySelector('.brand-text small');
    let first = true;
    try { first = !sessionStorage.getItem('share-brand-intro'); sessionStorage.setItem('share-brand-intro', '1'); } catch (e) { /* storage blocked */ }

    if (first) {
      const spring = A.spring({ bounce: 0.38, duration: 900 });
      const tl = A.createTimeline({ defaults: { ease: spring } });
      [spmc, share].forEach((logo, i) => {
        if (logo) tl.add(logo, { scale: [0.3, 1], rotate: [i ? 14 : -14, 0], opacity: [0, 1] }, i * 140);
      });
      if (word && word.offsetParent) {
        const split = splitText(word, { chars: true });
        tl.add(split.chars, { y: ['110%', '0%'], opacity: [0, 1], delay: stagger(45) }, 220);
      }
      if (sub && sub.offsetParent) tl.add(sub, { x: [-12, 0], opacity: [0, 1], duration: 600, ease: 'out(3)' }, 560);
    }

    if (share) {
      setInterval(() => {
        if (document.hidden) return;
        A.animate(share, { scale: [1, 1.12, 1, 1.06, 1], duration: 900, ease: 'out(2)' });
      }, 9000);
    }
    brand.addEventListener('mouseenter', () => {
      if (spmc) A.animate(spmc, { rotate: -6, scale: 1.06, duration: 420, ease: A.spring({ bounce: 0.4, duration: 420 }) });
      if (share) A.animate(share, { rotate: 6, scale: 1.06, duration: 420, ease: A.spring({ bounce: 0.4, duration: 420 }) });
    });
    brand.addEventListener('mouseleave', () => {
      [spmc, share].forEach((logo) => { if (logo) A.animate(logo, { rotate: 0, scale: 1, duration: 420, ease: 'out(3)' }); });
    });
  }

  const hero = document.querySelector('[data-hero]');
  if (!hero || still) return; // Static title, chips and numbers stay as written in the HTML.

  const title = hero.querySelector('h1');

  // Landing title: spring word reveal, ribbon underline, heartbeat on "eight", then a slow colour sheen.
  if (document.body.classList.contains('page-landing')) {
    landingTitle(title);
    chipsAndCounts();
    sectionTitles();
    organMorph();
    return;
  }

  // Landing hero: the organ morphs from one organ to the next. An SVG turbulence distortion swells and
  // settles (Anime.js tweens its scale) while the two images cross-fade, so the shapes seem to melt into
  // each other. The disease chip follows the organ. Pauses when the hero is off screen or the tab is hidden.
  function organMorph() {
    const stack = hero.querySelector('[data-morph]');
    const map = document.getElementById('organ-morph-map');
    const label = hero.querySelector('[data-organ-label]');
    if (!stack || !map) return;
    const imgs = Array.from(stack.querySelectorAll('img'));
    let index = 0;
    let visible = true;
    let busy = false;
    const HOLD = 2600;

    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(hero);

    function next() {
      if (busy || !visible || document.hidden) { setTimeout(next, 800); return; }
      busy = true;
      const from = imgs[index];
      index = (index + 1) % imgs.length;
      const to = imgs[index];
      const distort = { s: 0 };
      stack.classList.add('is-morphing');
      const tl = A.createTimeline({ onComplete: () => {
        stack.classList.remove('is-morphing');
        from.classList.remove('is-on');
        to.classList.add('is-on');
        busy = false;
        setTimeout(next, HOLD);
      } });
      // Melt: distortion rises while the old organ shrinks and fades.
      tl.add(distort, { s: 70, duration: 520, ease: 'in(2)', onUpdate: () => map.setAttribute('scale', distort.s.toFixed(1)) }, 0);
      tl.add(from, { opacity: [1, 0], scale: [1, 0.86], duration: 620, ease: 'in(2)' }, 0);
      // Form: the new organ grows out of the distortion, which settles back to zero.
      tl.add(to, { opacity: [0, 1], scale: [1.12, 1], duration: 760, ease: A.spring({ bounce: 0.2, duration: 760 }) }, 300);
      tl.add(distort, { s: 0, duration: 620, ease: 'out(3)', onUpdate: () => map.setAttribute('scale', distort.s.toFixed(1)) }, 520);
      if (label) {
        tl.add(label, { opacity: [1, 0], y: [0, -6], duration: 220, ease: 'in(2)',
          onComplete: () => { label.textContent = to.dataset.label || ''; } }, 160);
        tl.add(label, { opacity: [0, 1], y: [6, 0], duration: 320, ease: 'out(3)' }, 420);
      }
    }
    setTimeout(next, 3200);
  }

  // Landing section headings: letters rise on a spring when the heading scrolls into view, the small
  // kicker above settles from wide letter spacing, then a green sheen runs once through the words.
  function sectionTitles() {
    const heads = Array.from(document.querySelectorAll('main section:not(.hero) h2'));
    if (!heads.length || !('IntersectionObserver' in window)) return;
    const splits = new Map();
    heads.forEach((h) => {
      const split = splitText(h, { words: { wrap: 'clip' }, chars: true });
      split.chars.forEach((c) => { c.style.opacity = '0'; });
      splits.set(h, split);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        play(entry.target, splits.get(entry.target));
      });
    }, { threshold: 0.4 });
    heads.forEach((h) => io.observe(h));

    function play(h, split) {
      const kicker = h.previousElementSibling && h.previousElementSibling.classList.contains('kicker')
        ? h.previousElementSibling : null;
      const tl = A.createTimeline();
      if (kicker) {
        tl.add(kicker, { letterSpacing: ['0.42em', '0.12em'], opacity: [0, 1], duration: 700, ease: 'out(4)' });
      }
      tl.add(split.chars, {
        y: ['105%', '0%'],
        rotate: [10, 0],
        opacity: [0, 1],
        ease: A.spring({ bounce: 0.28, duration: 680 }),
        delay: stagger(16),
      }, kicker ? '-=520' : 0);
      tl.add(split.words, {
        color: ['#00211E', '#00211E', '#00211E'],
        duration: 900,
        ease: 'inOut(2)',
        delay: stagger(70),
      }, '-=200');
    }
  }

  const split = splitText(title, { words: { wrap: 'clip' }, chars: true });
  hero.classList.add('is-split');

  // 1. Reveal: each character rises out of its word clip.
  animate(split.chars, {
    y: { from: '105%' },
    rotate: { from: 8 },
    opacity: { from: 0 },
    duration: 820,
    ease: 'out(4)',
    delay: stagger(18),
    onComplete: wave,
  });

  // 2. A slow green wave runs through the title every few seconds.
  function wave() {
    animate(split.chars, {
      color: ['#00211E', '#00211E', '#00211E'],
      duration: 900,
      ease: 'inOut(2)',
      delay: stagger(28),
      loop: true,
      loopDelay: 4200,
    });
  }

  chipsAndCounts();

  function landingTitle(h1) {
    const split = splitText(h1, { words: true });
    // splitText rebuilds the title, so find the underline only after the split.
    const line = h1.querySelector('.hl-line path');
    hero.classList.add('is-split');
    const words = split.words;
    const eight = words.find((w) => /^eight$/i.test(w.textContent.trim()));
    const spring = A.spring({ bounce: 0.32, duration: 760 });
    if (line) line.style.strokeDashoffset = '1';

    const tl = A.createTimeline({ defaults: { ease: spring } });
    tl.add(words, {
      y: { from: '0.55em' },
      opacity: { from: 0 },
      filter: { from: 'blur(10px)', to: 'blur(0px)' },
      delay: stagger(70),
    });
    if (line) {
      tl.add(line, { strokeDashoffset: [1, 0], duration: 900, ease: 'inOut(3)' }, '-=380');
    }
    if (eight) {
      // Two quick beats, like a pulse.
      tl.add(eight, { scale: [1, 1.14, 1, 1.08, 1], duration: 900, ease: 'out(2)' }, '-=520');
    }
    tl.then(() => {
      animate(words, {
        color: ['#00211E', '#00211E', '#00211E'],
        duration: 1100,
        ease: 'inOut(2)',
        delay: stagger(60),
        loop: true,
        loopDelay: 5200,
      });
    });
  }

  function chipsAndCounts() {
  // 3. Chips fade in after the title, one after another.
  animate(hero.querySelectorAll('.glass'), {
    opacity: { from: 0 },
    filter: { from: 'blur(6px)', to: 'blur(0px)' },
    duration: 700,
    ease: 'out(3)',
    delay: stagger(180, { start: 600 }),
  });

  // 4. Numbers count up to the value written in the HTML.
  hero.querySelectorAll('[data-count]').forEach((node) => {
    const target = Number(node.dataset.count);
    const counter = { value: 0 };
    node.textContent = '0';
    animate(counter, {
      value: target,
      modifier: Math.round,
      duration: 1600,
      delay: 900,
      ease: 'out(3)',
      onUpdate: () => { node.textContent = String(counter.value); },
    });
  });
  }
})();
