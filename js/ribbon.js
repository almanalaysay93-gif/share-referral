// Flowing ribbon background shared by every page. One fixed SVG sits behind the content.
// Owns: the ribbon SVG and its path shapes. Inputs: time, page scroll, and on the landing page
// window.SHARE_STORY.demo / .donor (0..1) from js/landing.js. The wave phase is kept in sessionStorage
// so the ribbon carries on where it was when the doctor moves to the next page.
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const KEY = 'share-ribbon-phase';
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const landing = document.body.classList.contains('page-landing');

  // Three bands: wide sage, mid green, thin deep green thread.
  const BANDS = [
    { width: 120, color: 'url(#rb-sage)', opacity: 0.55, amp: 0.16, freq: 1.1, speed: 0.18, lift: 0.0 },
    { width: 46, color: 'url(#rb-green)', opacity: 0.38, amp: 0.12, freq: 1.6, speed: 0.26, lift: 0.05 },
    { width: 6, color: '#FB039E', opacity: 0.45, amp: 0.1, freq: 2.2, speed: 0.34, lift: -0.04 },
  ];
  const POINTS = 64;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'ribbon-bg' + (landing ? ' is-landing' : ''));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML =
    '<defs>' +
    '<linearGradient id="rb-sage" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#FD91CC" stop-opacity="0"/>' +
    '<stop offset=".3" stop-color="#FD91CC"/><stop offset=".7" stop-color="#FFB8DE"/><stop offset="1" stop-color="#FD91CC" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="rb-green" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#00211E" stop-opacity="0"/>' +
    '<stop offset=".25" stop-color="#00211E"/><stop offset=".75" stop-color="#FB039E"/><stop offset="1" stop-color="#00211E" stop-opacity="0"/></linearGradient>' +
    '</defs>';
  const paths = BANDS.map((band) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', band.color);
    p.setAttribute('stroke-width', band.width);
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('opacity', band.opacity);
    p.setAttribute('pathLength', '1');
    p.style.strokeDasharray = '1 1';
    svg.appendChild(p);
    return p;
  });
  document.body.prepend(svg);

  let phase = 0;
  try { phase = Number(sessionStorage.getItem(KEY)) || 0; } catch (e) { /* storage blocked */ }
  let last = performance.now();
  let frame = 0;
  let running = true;

  function pageProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  // Landing page: two braided ribbons run down the whole document. Scrolling draws them downward, and
  // the tip leads at 70 percent of the screen height. Particles ride along the drawn part and a glowing
  // head dot marks the tip.
  // group 0 sways one way, group 1 the opposite way, so the two ribbons cross like a braid.
  const STRANDS = [
    { group: 0, width: 64, color: 'url(#rb-sage)', opacity: 0.5, offset: -22, ripple: 0.012 },
    { group: 0, width: 26, color: 'url(#rb-green)', opacity: 0.4, offset: 0, ripple: 0.014 },
    { group: 0, width: 5, color: '#FB039E', opacity: 0.5, offset: 22, ripple: 0.018 },
    { group: 0, width: 2, color: '#00211E', opacity: 0.45, offset: 44, ripple: 0.024 },
    { group: 1, width: 38, color: 'url(#rb-sage)', opacity: 0.42, offset: -14, ripple: 0.016 },
    { group: 1, width: 12, color: 'url(#rb-green)', opacity: 0.35, offset: 8, ripple: 0.02 },
    { group: 1, width: 2, color: '#FB039E', opacity: 0.4, offset: 26, ripple: 0.028 },
  ];
  const PARTICLES = 26;
  const LONG_POINTS = 180;
  const strandPaths = [];
  const dots = [];
  const head = landing ? document.createElementNS(NS, 'circle') : null;
  if (landing) {
    paths.forEach((p) => p.remove());
    STRANDS.forEach((strand) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', strand.color);
      p.setAttribute('stroke-width', strand.width);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('opacity', strand.opacity);
      p.setAttribute('pathLength', '1');
      svg.appendChild(p);
      strandPaths.push(p);
    });
    for (let i = 0; i < PARTICLES; i++) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('class', 'ribbon-dot' + (i % 3 === 0 ? ' is-sage' : ''));
      svg.appendChild(c);
      // Each particle has its own lane, speed, size and starting point along the ribbon.
      dots.push({ el: c, lane: (i % 7) - 3, speed: 0.012 + (i % 5) * 0.004, size: 2.6 + (i % 4) * 1.3, seed: i / PARTICLES });
    }
    head.setAttribute('r', '9');
    head.setAttribute('class', 'ribbon-head');
    svg.appendChild(head);
  }

  function drawLanding() {
    const w = document.documentElement.clientWidth;
    const docH = document.documentElement.scrollHeight;
    const footer = document.querySelector('.footer');
    const endY = docH - (footer ? footer.offsetHeight : 0) - 40;
    const startY = 90;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + docH);
    svg.style.height = docH + 'px';
    const story = window.SHARE_STORY || { demo: 0, donor: 0 };
    const turns = Math.max(2, (endY - startY) / (window.innerHeight * 1.25));
    const tipY = still.matches ? endY : window.scrollY + window.innerHeight * 0.7;
    const swell = 1 + story.donor * 0.25;
    const centre = [[], []];
    let tipFrac = 1;

    STRANDS.forEach((strand, i) => {
      const dir = strand.group === 0 ? 1 : -1;
      const amp = strand.group === 0 ? 0.34 : 0.27;
      const pts = [];
      let total = 0;
      let tipLen = 0;
      for (let k = 0; k <= LONG_POINTS; k++) {
        const t = k / LONG_POINTS;
        const y = startY + t * (endY - startY);
        const sway = Math.sin(t * Math.PI * turns + Math.PI / 2 + phase * 0.22) * dir;
        const ripple = Math.sin(t * Math.PI * turns * 3 + phase * (0.9 + i * 0.15) + i) * strand.ripple;
        const x = w * (0.5 + amp * sway * swell + ripple) + strand.offset;
        if (k) {
          total += Math.hypot(x - pts[k - 1][0], y - pts[k - 1][1]);
          if (y <= tipY) tipLen = total;
        }
        pts.push([x, y]);
      }
      strandPaths[i].setAttribute('d', 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L'));
      const drawn = Math.min(1, Math.max(0.04, tipLen / total));
      strandPaths[i].style.strokeDasharray = drawn.toFixed(4) + ' 1';
      if (strand.offset === 0 || (strand.group === 1 && strand.offset === 8)) centre[strand.group] = pts;
    });

    // The tip: last centre point above the tip line.
    const main = centre[0];
    let tipIndex = 0;
    for (let k = 0; k < main.length; k++) if (main[k][1] <= tipY) tipIndex = k;
    tipFrac = tipIndex / LONG_POINTS;
    head.setAttribute('cx', main[tipIndex][0].toFixed(1));
    head.setAttribute('cy', main[tipIndex][1].toFixed(1));

    // Particles stream down the drawn part of either ribbon and fade at both ends.
    dots.forEach((d, i) => {
      const lane = centre[i % 2];
      const along = ((d.seed + phase * d.speed) % 1) * tipFrac;
      const k = Math.min(LONG_POINTS, Math.round(along * LONG_POINTS));
      const p = lane[k];
      const fade = tipFrac > 0 ? Math.min(1, along / 0.03, (tipFrac - along) / 0.06) : 0;
      d.el.setAttribute('cx', (p[0] + d.lane * 9 + Math.sin(phase * 2 + i) * 6).toFixed(1));
      d.el.setAttribute('cy', p[1].toFixed(1));
      d.el.setAttribute('r', d.size.toFixed(1));
      d.el.setAttribute('opacity', Math.max(0, fade * 0.85).toFixed(2));
    });
  }

  function draw(now) {
    if (landing) {
      drawLanding();
      if (!still.matches && running) {
        phase += Math.min(64, now - last) / 1000;
        last = now;
        frame = requestAnimationFrame(draw);
      } else {
        frame = 0;
      }
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    const scroll = still.matches ? 0.35 : pageProgress();
    const story = window.SHARE_STORY || { demo: 0, donor: 0 };
    // The landing story swells the ribbon: the demo lifts it, the donor map widens its waves.
    const swell = 1 + story.donor * 0.7;
    const lift = story.demo * 0.12;

    paths.forEach((path, i) => {
      const band = BANDS[i];
      // The ribbon travels from upper left to lower right as the page scrolls.
      const base = h * (0.22 + scroll * 0.56 + band.lift - lift);
      let d = '';
      for (let k = 0; k <= POINTS; k++) {
        const t = k / POINTS;
        const x = -w * 0.1 + t * w * 1.2;
        const y = base + (t - 0.5) * h * 0.35
          + Math.sin(t * Math.PI * 2 * band.freq + phase * band.speed * 6 + scroll * 5) * h * band.amp * swell;
        d += (k ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      path.setAttribute('d', d);
      // Scrolling draws the ribbon further along; it is never shorter than 55 percent.
      const visible = landing ? 0.55 + scroll * 0.45 : 0.85;
      path.style.strokeDasharray = visible.toFixed(3) + ' 1';
    });

    if (!still.matches && running) {
      phase += Math.min(64, now - last) / 1000;
      last = now;
      frame = requestAnimationFrame(draw);
    } else {
      frame = 0;
    }
  }

  function start() {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(draw);
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) start();
  });
  window.addEventListener('pagehide', () => {
    try { sessionStorage.setItem(KEY, String(phase)); } catch (e) { /* storage blocked */ }
  });
  window.addEventListener('scroll', () => { if (still.matches) draw(performance.now()); }, { passive: true });
  window.addEventListener('resize', () => draw(performance.now()), { passive: true });
  still.addEventListener('change', start);
  start();
})();
