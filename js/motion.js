// Anime.js 4.5.0 motion for the hero: title text split and reveal, a slow colour wave, chip fade-in, number count-up.
// Owns: .hero h1 characters, .glass opacity, [data-count] text. The 3D transforms stay with js/common.js and CSS.
(function () {
  'use strict';
  const A = window.anime;
  const hero = document.querySelector('[data-hero]');
  if (!A || !hero) return;
  const { animate, splitText, stagger } = A;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) return; // Static title, chips and numbers stay as written in the HTML.

  const title = hero.querySelector('h1');
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
})();
