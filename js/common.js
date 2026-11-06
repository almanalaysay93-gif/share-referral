// Shared helpers for the three pages: server calls, the reader-to-form draft, and the 3D hero.
(function () {
  'use strict';
  const cfg = window.SHARE_CONFIG;
  const DEMO = !cfg.ENDPOINT;
  const DRAFT_KEY = 'share-referral-draft';

  const LABELS = {
    patient_name: 'Patient name', hrn: 'Record number', age: 'Age', sex: 'Sex', hospital: 'Hospital',
    ward: 'Ward / room', admission_date: 'Admission date', gcs: 'GCS', diagnosis: 'Diagnosis',
    brain_death: 'Brain death declared', brain_death_datetime: 'Time declared', ventilator: 'Ventilator',
    doctor_name: 'Your name', prc: 'PRC number', doctor_email: 'Email', contact_number: 'Contact number',
    notes: 'Clinical notes',
  };

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- Server ---------- */

  async function post(body) {
    if (DEMO) return demoPost(body);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch(cfg.ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function demoStore() {
    try { return JSON.parse(localStorage.getItem('share-demo-referrals') || '{}'); } catch (e) { return {}; }
  }

  function demoPost(body) {
    return new Promise((resolve) => setTimeout(() => {
      const store = demoStore();
      const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
      if (body.action === 'find') {
        const refs = Object.keys(store).map((ref) => ({ reference: ref, hospital: 'Preview', submittedAt: store[ref], status: 'Received' }));
        resolve(refs.length ? { ok: true, identifiedBy: 'reference', referrals: refs.slice(-10).reverse() }
          : { ok: false, error: 'No preview referrals in this browser yet.' });
        return;
      }
      if (body.action === 'update') {
        resolve({ ok: true, reference: body.reference, status: 'Under review', changes: 1, doctorEmail: 'No email on file' });
        return;
      }
      if (body.action === 'status') {
        const row = store[body.reference];
        resolve(row ? { ok: true, reference: body.reference, status: 'Received', submittedAt: row, updatedAt: row }
          : { ok: false, error: 'Reference not found.' });
        return;
      }
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      let ref = 'SHR-';
      for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
      store[ref] = now;
      try { localStorage.setItem('share-demo-referrals', JSON.stringify(store)); } catch (e) { /* private mode */ }
      resolve({ ok: true, reference: ref, admissionId: 'PREVIEW', status: 'Received' });
    }, 700));
  }

  /* ---------- Draft: reader page to form page, this browser tab only ---------- */

  const draft = {
    load() {
      try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || null; } catch (e) { return null; }
    },
    save(value) {
      try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    clear() {
      try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* storage blocked */ }
    },
  };

  /* ---------- 3D parallax hero: one rAF loop owns --p, --tx and --ty ---------- */

  function hero() {
    const root = document.querySelector('[data-hero]');
    if (!root) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let target = { x: 0, y: 0 };
    let cur = { x: 0, y: 0 };
    let frame = 0;
    let visible = true;

    function tick() {
      frame = 0;
      const rect = root.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      // Spring-like settle toward the pointer target.
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      root.style.setProperty('--p', p.toFixed(4));
      root.style.setProperty('--tx', cur.x.toFixed(4));
      root.style.setProperty('--ty', cur.y.toFixed(4));
      if (visible && (Math.abs(target.x - cur.x) > 0.001 || Math.abs(target.y - cur.y) > 0.001)) request();
    }
    function request() { if (!frame && !still.matches) frame = requestAnimationFrame(tick); }

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    root.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = root.getBoundingClientRect();
      target = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 };
      request();
    });
    root.addEventListener('pointerleave', () => { target = { x: 0, y: 0 }; request(); });
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; if (visible) request(); }).observe(root);
    still.addEventListener('change', () => {
      if (still.matches) ['--p', '--tx', '--ty'].forEach((v) => root.style.setProperty(v, '0'));
      else request();
    });
    root.classList.add('is-live');
    request();
  }

  if (DEMO) document.documentElement.classList.add('is-demo');
  document.addEventListener('DOMContentLoaded', hero);

  window.Share = { cfg, DEMO, LABELS, el, post, draft };
})();
