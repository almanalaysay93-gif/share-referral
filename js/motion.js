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

  const hero = document.querySelector('[data-hero]');
  if (!hero || still) return; // Static title, chips and numbers stay as written in the HTML.

  const title = hero.querySelector('h1');

  // Landing title: spring word reveal, ribbon underline, heartbeat on "eight", then a slow colour sheen.
  if (document.body.classList.contains('page-landing')) {
    landingTitle(title);
    chipsAndCounts();
    return;
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
      color: ['#0d3b21', '#008037', '#0d3b21'],
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
        color: ['#0d3b21', '#008037', '#0d3b21'],
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
