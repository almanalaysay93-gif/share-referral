// Button click feedback: a particle burst (Anime.js) and a short soft chime (Web Audio, generated in code,
// no sound file). Owns: .burst elements and the shared AudioContext. Buttons keep their own press motion
// in js/motion.js. Links wait 170 ms before they open so the burst and chime can play.
(function () {
  'use strict';
  const A = window.anime;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SELECTOR = '.btn-primary, .btn-send, .btn-ghost, .stepnav a';
  let audio = null;

  function chime() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audio = audio || new Ctx();
      if (audio.state === 'suspended') audio.resume();
      const now = audio.currentTime;
      const out = audio.createGain();
      out.gain.setValueAtTime(0.0001, now);
      out.gain.exponentialRampToValueAtTime(0.06, now + 0.012);
      out.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      out.connect(audio.destination);
      // Two soft notes a fifth apart, gliding up, like a small "ping".
      [[523.25, 783.99, 'triangle'], [783.99, 1046.5, 'sine']].forEach(([from, to, type], i) => {
        const osc = audio.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(from, now + i * 0.04);
        osc.frequency.exponentialRampToValueAtTime(to, now + i * 0.04 + 0.09);
        const g = audio.createGain();
        g.gain.value = i ? 0.5 : 1;
        osc.connect(g).connect(out);
        osc.start(now + i * 0.04);
        osc.stop(now + 0.34);
      });
    } catch (err) { /* audio blocked or unsupported: stay silent */ }
  }

  function burst(x, y) {
    if (!A || still.matches) return;
    const host = document.createElement('span');
    host.className = 'burst';
    host.setAttribute('aria-hidden', 'true');
    host.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    const ring = document.createElement('i');
    ring.className = 'is-ring';
    host.appendChild(ring);
    const dots = [];
    const count = 14;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('i');
      if (i % 3 === 0) dot.className = 'is-sage';
      host.appendChild(dot);
      dots.push(dot);
    }
    document.body.appendChild(host);

    A.animate(ring, { scale: [0.4, 4.2], opacity: [0.9, 0], duration: 520, ease: 'out(3)' });
    dots.forEach((dot, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 34 + Math.random() * 34;
      A.animate(dot, {
        x: [0, Math.cos(angle) * dist],
        y: [0, Math.sin(angle) * dist + 10],
        scale: [1, 0],
        opacity: [1, 0],
        duration: 560 + Math.random() * 220,
        ease: 'out(3)',
      });
    });
    setTimeout(() => host.remove(), 900);
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest(SELECTOR);
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    // Keyboard clicks have no pointer position: burst from the button centre.
    const x = event.detail ? event.clientX : rect.left + rect.width / 2;
    const y = event.detail ? event.clientY : rect.top + rect.height / 2;
    burst(x, y);
    chime();

    const href = btn.tagName === 'A' ? btn.getAttribute('href') : null;
    const plain = !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (href && plain && !btn.target && !href.startsWith('#')) {
      event.preventDefault();
      setTimeout(() => { window.location.href = btn.href; }, 170);
    }
  });
})();
