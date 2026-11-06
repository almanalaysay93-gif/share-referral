// Button click feedback: a particle burst (Anime.js) and a short soft chime (Web Audio, generated in code,
// no sound file). Owns: .burst elements and the shared AudioContext. Buttons keep their own press motion
// in js/motion.js. Links wait 170 ms before they open so the burst and chime can play.
(function () {
  'use strict';
  const A = window.anime;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Every button, every button-styled link, the step links and the logo link.
  const SELECTOR = 'button, [role="button"], .btn-primary, .btn-send, .btn-ghost, .stepnav a, .brand, .seg label';
  let audio = null;
  let lastFx = -1000;

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
    const rings = [0, 1].map((n) => {
      const ring = document.createElement('i');
      ring.className = 'is-ring' + (n ? ' is-sage' : '');
      host.appendChild(ring);
      return ring;
    });
    const dots = [];
    const count = 32;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('i');
      // Mix of green dots, sage dots and small sparks.
      dot.className = i % 4 === 0 ? 'is-sage' : i % 5 === 0 ? 'is-spark' : '';
      host.appendChild(dot);
      dots.push(dot);
    }
    document.body.appendChild(host);

    rings.forEach((ring, n) => {
      A.animate(ring, { scale: [0.4, n ? 6 : 4.2], opacity: [0.9, 0], duration: n ? 760 : 520, delay: n * 60, ease: 'out(3)' });
    });
    dots.forEach((dot, i) => {
      // Two shells: an inner fast ring of particles and an outer slower one.
      const outer = i % 2 === 1;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = (outer ? 60 : 30) + Math.random() * (outer ? 50 : 26);
      A.animate(dot, {
        x: [0, Math.cos(angle) * dist],
        y: [0, Math.sin(angle) * dist + (outer ? 22 : 8)],
        scale: [outer ? 0.8 : 1.15, 0],
        opacity: [1, 0],
        rotate: [0, (Math.random() - 0.5) * 360],
        duration: (outer ? 760 : 520) + Math.random() * 240,
        delay: outer ? 40 : 0,
        ease: 'out(3)',
      });
    });
    setTimeout(() => host.remove(), 1200);
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest(SELECTOR);
    if (!btn || btn.disabled) return;
    // A click on a label also fires a click on its radio. Play the effect once.
    if (event.timeStamp - lastFx < 60) return;
    lastFx = event.timeStamp;
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
