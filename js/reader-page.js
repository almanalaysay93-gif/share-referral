// Page 1: the referral reader. Reads pasted text offline and keeps the result as a draft for the form page.
(function () {
  'use strict';
  const { LABELS, el, draft } = window.Share;
  const $ = (id) => document.getElementById(id);
  const REQUIRED = ['patient_name', 'hospital', 'doctor_name'];
  const SAMPLE = 'Good evening SHARE, referral po:\n' +
    'Pt: Juan Dela Cruz, 45/M, ICU 3, Davao Doctors Hospital\n' +
    'Admitted 11/02/2026\n' +
    'Dx: Acute CVD bleed, left thalamoganglionic, hypertensive. GCS 3 (E1VTM1), intubated on MV\n' +
    'Declared brain dead 11/05/2026 3:40 PM, apnea test positive\n' +
    'Referred by Dr. Maria Santos, PRC 0123456, 0917 123 4567';

  const messages = $('messages');
  const paste = $('paste');
  let state = draft.load() || { fields: {}, raw: [] };

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

  /** Dates come from the reader as ISO text. Show them the way a doctor writes them. */
  function show(name, value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
    if (!m) return value;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    const day = d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
    return m[4] ? day + ', ' + d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : day;
  }

  /** Summary of what the reader found, shown beside the chat. */
  function renderSummary() {
    const list = $('found-list');
    list.textContent = '';
    const names = Object.keys(LABELS).filter((n) => state.fields[n]);
    names.forEach((n) => {
      const long = n === 'notes' || n === 'diagnosis';
      const row = el('div', 'found-row' + (long ? ' is-long' : ''));
      row.append(el('dt', null, LABELS[n]), el('dd', null, show(n, state.fields[n])));
      list.appendChild(row);
    });
    $('found-empty').hidden = names.length > 0;
    const missing = REQUIRED.filter((n) => !state.fields[n]);
    const miss = $('found-missing');
    miss.textContent = '';
    if (names.length && missing.length) {
      miss.append(el('p', null, 'You can add these on the next page:'), chips(missing, 'chip-miss'));
    }
    $('continue-label').textContent = names.length ? 'Check and send' : 'Type it in the form instead';
    $('clear-btn').hidden = !names.length;
  }

  addMsg('bot', [
    'Good day, doctor. Thank you for thinking of SHARE.',
    'Paste the referral the way you would send it on Messenger. I will read it here on your phone, then you check it on the next page. Nothing is sent until you press Send referral.',
  ]);
  if (Object.keys(state.fields).length) {
    addMsg('bot', 'Your last reading is still here. Paste more to add to it, or continue.');
  }
  renderSummary();

  paste.addEventListener('focus', () => { window.ReferralReader.start().catch(() => {}); }, { once: true });

  $('sample-btn').addEventListener('click', () => { paste.value = SAMPLE; paste.focus(); });

  paste.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('composer').requestSubmit(); }
  });

  $('clear-btn').addEventListener('click', () => {
    state = { fields: {}, raw: [] };
    draft.clear();
    renderSummary();
    addMsg('bot', 'Cleared. Paste a new referral.');
    paste.focus();
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
      const added = [];
      Object.keys(result.fields).forEach((n) => {
        const v = result.fields[n];
        if (v && state.fields[n] !== v) { state.fields[n] = v; added.push(n); }
      });
      state.raw.push(text);
      draft.save(state);
      renderSummary();
      reply(result, added);
    } catch (err) {
      wait.remove();
      addMsg('bot', [
        'I could not start the reader on this connection.',
        'Please continue to the form and type the details. Your pasted text is back in the box so you can copy from it.',
      ], 'msg-warn');
      paste.value = text;
    } finally {
      clearTimeout(slow);
      $('reader-state').textContent = 'Offline reader. No AI. Nothing is sent from this page.';
      btn.disabled = false;
    }
  });

  function reply(result, added) {
    const parts = [];
    if (added.length) {
      parts.push('I found ' + added.length + (added.length === 1 ? ' detail.' : ' details.'));
      parts.push(chips(added));
    } else if (result.found.length) {
      parts.push('I already had those details.');
    } else {
      parts.push('I could not find referral details in that text. Paste more, or type them in the form.');
    }
    const missing = REQUIRED.filter((n) => !state.fields[n]);
    if (Object.keys(state.fields).length) {
      parts.push(missing.length ? 'Press Check and send to review. You can fill the rest there.'
        : 'Everything required is there. Press Check and send to review.');
    }
    result.warnings.forEach((w) => parts.push(w));
    addMsg('bot', parts);
  }
})();
