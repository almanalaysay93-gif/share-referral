(function () {
  'use strict';
  const cfg = window.SHARE_CONFIG;
  const DEMO = !cfg.ENDPOINT;
  const $ = (id) => document.getElementById(id);

  const LABELS = {
    patient_name: 'Patient name', hrn: 'Record number', age: 'Age', sex: 'Sex', hospital: 'Hospital',
    ward: 'Ward / room', admission_date: 'Admission date', gcs: 'GCS', diagnosis: 'Diagnosis',
    brain_death: 'Brain death declared', brain_death_datetime: 'Time declared', ventilator: 'Ventilator',
    doctor_name: 'Your name', prc: 'PRC number', doctor_email: 'Email', contact_number: 'Contact number',
    notes: 'Notes',
  };
  const RADIOS = ['brain_death', 'ventilator'];
  const STATUSES = ['Received', 'Under review', 'Coordinator en route', 'Evaluated'];
  const TERMINAL = ['Not suitable', 'Closed'];
  const SAMPLE = 'Good evening SHARE, referral po:\n' +
    'Pt: Juan Dela Cruz, 45/M, ICU 3, Davao Doctors Hospital\n' +
    'Admitted 11/02/2026\n' +
    'Dx: Acute CVD bleed, left thalamoganglionic, hypertensive. GCS 3 (E1VTM1), intubated on MV\n' +
    'Declared brain dead 11/05/2026 3:40 PM, apnea test positive\n' +
    'Referred by Dr. Maria Santos, PRC 0123456, 0917 123 4567';

  const form = $('referral-form');
  const messages = $('messages');
  const paste = $('paste');
  const rawTexts = [];
  let usedChat = false;

  if (DEMO) $('demo-banner').hidden = false;

  /* ---------- Chat ---------- */

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function addMsg(role, parts, extraClass) {
    const box = el('div', 'msg msg-' + role + (extraClass ? ' ' + extraClass : ''));
    (Array.isArray(parts) ? parts : [parts]).forEach((p) => box.appendChild(typeof p === 'string' ? el('p', null, p) : p));
    messages.appendChild(box);
    messages.scrollTop = messages.scrollHeight;
    return box;
  }

  function typing() {
    const box = el('div', 'msg msg-bot');
    const dots = el('span', 'msg-typing');
    dots.setAttribute('aria-label', 'Reading');
    dots.append(el('i'), el('i'), el('i'));
    box.appendChild(dots);
    messages.appendChild(box);
    messages.scrollTop = messages.scrollHeight;
    return box;
  }

  function chips(names, cls) {
    const wrap = el('div', 'chips');
    names.forEach((n) => wrap.appendChild(el('span', 'chip' + (cls ? ' ' + cls : ''), LABELS[n] || n)));
    return wrap;
  }

  addMsg('bot', [
    'Good day, doctor. Thank you for thinking of SHARE.',
    'Paste the referral the way you would send it on Messenger. I will read it and fill in the form. Nothing is sent until you press Send referral.',
  ]);

  // Warm up the reader when the doctor starts to use the chat.
  paste.addEventListener('focus', () => {
    window.ReferralReader.start().catch(() => {});
  }, { once: true });

  $('sample-btn').addEventListener('click', () => {
    paste.value = SAMPLE;
    paste.focus();
  });

  paste.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      $('composer').requestSubmit();
    }
  });

  $('composer').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = paste.value.trim();
    if (!text) { paste.focus(); return; }
    const btn = $('read-btn');
    btn.disabled = true;
    addMsg('user', text);
    paste.value = '';
    const wait = typing();
    const slow = setTimeout(() => {
      $('reader-state').textContent = 'Starting the reader. The first time takes a few seconds.';
    }, 900);
    try {
      const result = await window.ReferralReader.read(text);
      wait.remove();
      rawTexts.push(text);
      usedChat = true;
      const filled = fillForm(result.fields);
      reply(result, filled);
    } catch (err) {
      wait.remove();
      addMsg('bot', [
        'I could not start the reader on this connection.',
        'Please type the details in the form. Your pasted text is kept below so you can copy from it.',
      ], 'msg-warn');
      paste.value = text;
    } finally {
      clearTimeout(slow);
      $('reader-state').textContent = 'Offline reader. No AI. Nothing is sent until you press Send referral.';
      btn.disabled = false;
    }
  });

  function reply(result, filled) {
    const parts = [];
    if (filled.length) {
      parts.push('I filled ' + filled.length + (filled.length === 1 ? ' field.' : ' fields.') + ' Please check them in the form.');
      parts.push(chips(filled));
    } else if (result.found.length) {
      parts.push('Those details are already in the form. I did not change anything you typed.');
    } else {
      parts.push('I could not find referral details in that text. You can paste more, or type in the form.');
    }
    const missing = result.missing.filter((n) => !getValue(n));
    if (missing.length) {
      parts.push('Still needed:');
      parts.push(chips(missing, 'chip-miss'));
    } else if (filled.length) {
      parts.push('Everything required is there. Press Send referral when ready.');
    }
    result.warnings.forEach((w) => parts.push(w));
    addMsg('bot', parts);
  }

  /* ---------- Form helpers ---------- */

  function getValue(name) {
    if (RADIOS.includes(name)) {
      const checked = form.querySelector('input[name="' + name + '"]:checked');
      return checked ? checked.value : '';
    }
    const input = form.elements[name];
    return input ? input.value.trim() : '';
  }

  function markFilled(node) {
    node.classList.remove('filled');
    void node.offsetWidth;
    node.classList.add('filled');
    node.dataset.auto = '1';
  }

  /** Fill empty fields, or fields the reader filled before. Never overwrite what the doctor typed. */
  function fillForm(fields) {
    const filled = [];
    Object.keys(fields).forEach((name) => {
      const value = fields[name];
      if (!value) return;
      if (RADIOS.includes(name)) {
        const group = form.querySelector('[aria-labelledby="l-' + name + '"]');
        const current = getValue(name);
        if (current && group.dataset.auto !== '1') return;
        const radio = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
        if (radio && current !== value) {
          radio.checked = true;
          markFilled(group);
          filled.push(name);
        }
        return;
      }
      const input = form.elements[name];
      if (!input) return;
      if (input.value.trim() && input.dataset.auto !== '1') return;
      if (input.value === value) return;
      input.value = value;
      if (input.value !== value) return; // value rejected by the control, for example a bad date
      markFilled(input);
      clearInvalid(name);
      filled.push(name);
    });
    return filled;
  }

  form.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.name) return;
    if (t.type === 'radio') {
      const group = t.closest('.seg');
      group.dataset.auto = '';
      group.classList.remove('filled');
    } else {
      t.dataset.auto = '';
      t.classList.remove('filled');
    }
    clearInvalid(t.name);
  });

  function setInvalid(name) {
    const input = form.elements[name];
    const field = input && (input.closest ? input.closest('.field') : null);
    if (field) field.classList.add('invalid');
    if (input && input.setAttribute) {
      input.setAttribute('aria-invalid', 'true');
      const err = $('e-' + name);
      if (err) input.setAttribute('aria-describedby', 'e-' + name);
    }
  }

  function clearInvalid(name) {
    const input = form.elements[name];
    const field = input && input.closest ? input.closest('.field') : null;
    if (field) field.classList.remove('invalid');
    if (input && input.removeAttribute) input.removeAttribute('aria-invalid');
  }

  function collect() {
    const data = {};
    Object.keys(LABELS).forEach((n) => { data[n] = getValue(n); });
    data.raw_text = rawTexts.join('\n---\n').slice(0, 6000);
    return data;
  }

  function validate(d) {
    const bad = [];
    if (!d.patient_name) bad.push('patient_name');
    if (!d.hospital) bad.push('hospital');
    if (!d.doctor_name) bad.push('doctor_name');
    if (d.age && !(/^\d{1,3}$/.test(d.age) && +d.age <= 120)) bad.push('age');
    if (d.prc && !/^\d{5,8}$/.test(d.prc)) bad.push('prc');
    if (d.doctor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.doctor_email)) bad.push('doctor_email');
    return bad;
  }

  /* ---------- Submit ---------- */

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('form-msg');
    msg.textContent = '';
    const data = collect();
    const bad = validate(data);
    if (bad.length) {
      bad.forEach(setInvalid);
      msg.textContent = 'Please complete the highlighted fields.';
      const first = form.elements[bad[0]];
      if (first && first.focus) first.focus();
      return;
    }
    const btn = $('submit-btn');
    btn.disabled = true;
    btn.classList.add('busy');
    btn.querySelector('.btn-label').textContent = 'Sending';
    try {
      const res = await post({
        action: 'submit',
        source: usedChat ? 'chat' : 'form',
        website: form.elements.website.value,
        referral: data,
      });
      if (!res || !res.ok) {
        (res && res.fields ? res.fields : []).forEach(setInvalid);
        msg.textContent = (res && res.error) || 'The referral was not saved. Please try again.';
        return;
      }
      showSuccess(data, res);
    } catch (err) {
      msg.textContent = 'Not sent. Check your signal and press Send referral again. Your details are still here.';
    } finally {
      btn.disabled = false;
      btn.classList.remove('busy');
      btn.querySelector('.btn-label').textContent = 'Send referral';
    }
  });

  function showSuccess(data, res) {
    $('ok-doctor').textContent = data.doctor_name;
    $('ok-ref').textContent = res.reference;
    $('ok-status-link').href = '#status?ref=' + encodeURIComponent(res.reference);
    $('ok-mail').textContent = data.doctor_email
      ? 'A thank-you note with this reference is on its way to ' + data.doctor_email + '.'
      : 'Keep this reference to check the status later.';
    form.hidden = true;
    $('success').hidden = false;
    $('success').focus();
    $('success').scrollIntoView({ block: 'center' });
    addMsg('bot', ['Sent. Reference ' + res.reference + '. Thank you, doctor.']);
  }

  $('copy-ref').addEventListener('click', async () => {
    const ref = $('ok-ref').textContent;
    const label = $('copy-ref').querySelector('span');
    try {
      await navigator.clipboard.writeText(ref);
      label.textContent = 'Copied';
    } catch (err) {
      label.textContent = 'Select and copy';
    }
    setTimeout(() => { label.textContent = 'Copy'; }, 1800);
  });

  $('new-referral').addEventListener('click', () => {
    form.reset();
    form.querySelectorAll('[data-auto]').forEach((n) => { n.dataset.auto = ''; n.classList.remove('filled'); });
    rawTexts.length = 0;
    usedChat = false;
    $('success').hidden = true;
    form.hidden = false;
    $('f-patient_name').focus();
  });

  /* ---------- Status ---------- */

  function renderStatus(res) {
    const box = $('status-result');
    box.textContent = '';
    if (!res.ok) {
      box.appendChild(el('p', 'status-error', res.error || 'Reference not found.'));
      return;
    }
    if (TERMINAL.includes(res.status)) {
      const note = el('div', 'status-note');
      note.appendChild(el('p', null, res.reference + ': ' + res.status + '.'));
      note.appendChild(el('p', 'status-meta', 'Thank you for referring. The SHARE team will contact you if they need anything else.'));
      box.appendChild(note);
    } else {
      const idx = Math.max(0, STATUSES.indexOf(res.status));
      const list = el('ol', 'steps');
      list.setAttribute('aria-label', 'Referral progress');
      STATUSES.forEach((s, i) => {
        const li = el('li', i < idx ? 'done' : i === idx ? 'now' : '', s);
        if (i === idx) li.setAttribute('aria-current', 'step');
        list.appendChild(li);
      });
      box.appendChild(list);
    }
    box.appendChild(el('p', 'status-meta', 'Received ' + res.submittedAt + '. Last update ' + res.updatedAt + '.'));
  }

  async function checkStatus(ref) {
    const btn = $('status-btn');
    btn.disabled = true;
    $('status-result').textContent = 'Checking…';
    try {
      renderStatus(await post({ action: 'status', reference: ref }));
    } catch (err) {
      renderStatus({ ok: false, error: 'Could not reach the server. Try again.' });
    } finally {
      btn.disabled = false;
    }
  }

  $('status-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const ref = $('status-ref').value.trim().toUpperCase();
    if (!ref) { $('status-ref').focus(); return; }
    checkStatus(ref);
  });

  function routeHash() {
    const m = /^#status\?ref=([A-Za-z0-9-]+)/.exec(location.hash);
    if (!m) return;
    $('status-ref').value = m[1].toUpperCase();
    document.getElementById('status').scrollIntoView();
    checkStatus(m[1].toUpperCase());
  }
  window.addEventListener('hashchange', routeHash);
  routeHash();

  /* ---------- Preview mode (no ENDPOINT) ---------- */

  function demoStore() {
    try { return JSON.parse(localStorage.getItem('share-demo-referrals') || '{}'); } catch (e) { return {}; }
  }

  function demoPost(body) {
    return new Promise((resolve) => setTimeout(() => {
      const store = demoStore();
      const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
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
})();
