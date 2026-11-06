// Page 1: the referral reader. Reads pasted text offline and keeps the result as a draft for the form page.
(function () {
  'use strict';
  const { LABELS, el, draft } = window.Share;
  const $ = (id) => document.getElementById(id);
  const REQUIRED = ['patient_name', 'hospital', 'doctor_name'];

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

  /* ---------- Upload: Word, Excel, CSV or text, read on this device ---------- */

  $('file-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const state = $('reader-state');
    state.textContent = 'Opening ' + file.name + '…';
    try {
      const res = await window.ReferralReader.extract(file);
      if (!res.ok) {
        addMsg('bot', [res.error], 'msg-warn');
        return;
      }
      if (!res.text.trim()) {
        addMsg('bot', ['That file has no text I can read. Paste the referral instead.'], 'msg-warn');
        return;
      }
      paste.value = res.text;
      addMsg('bot', ['I opened ' + file.name + '. Reading it now.']);
      $('composer').requestSubmit();
    } catch (err) {
      addMsg('bot', ['I could not open that file on this connection. Paste the referral instead.'], 'msg-warn');
    } finally {
      state.textContent = 'Offline reader. Paste, upload a file, or speak.';
    }
  });

  /* ---------- Speak: the browser's speech service turns the doctor's voice into text ---------- */

  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = $('mic-btn');
  if (Speech) {
    mic.hidden = false;
    $('mic-note').hidden = false;
    const label = mic.querySelector('span');
    let rec = null;
    let wanted = false;   // the doctor wants to keep listening
    let base = '';        // paste box text before this session's speech
    let offset = 0;       // final results of this session already kept in `base` (after a typed edit)
    let interim = '';     // unfinished words currently shown at the end of the box
    let written = '';     // what this code last wrote into the box
    let lastFinals = [];  // cleaned final phrases of the current session
    let carry = '';       // last final phrase of the previous session
    let dropCarry = false;

    const setLive = (live) => {
      mic.classList.toggle('is-live', live);
      mic.setAttribute('aria-pressed', String(live));
      label.textContent = live ? 'Stop' : 'Speak';
    };

    // Chrome ends a session after a pause, so a session restarts while the doctor wants to keep talking.
    const begin = () => {
      // Drop the unfinished words from the box: the new session will hear them again if they matter.
      if (interim && paste.value.endsWith(interim)) paste.value = paste.value.slice(0, paste.value.length - interim.length);
      base = paste.value ? paste.value.replace(/\s*$/, '\n') : '';
      offset = 0;
      interim = '';
      written = paste.value;
      rec = new Speech();
      rec.lang = 'en-PH';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        // Build the text from every result in this session, so a result is never counted twice.
        const raw = [];
        let pending = '';
        for (let i = 0; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript.trim();
          if (event.results[i].isFinal) raw.push(piece);
          else pending = piece;
        }
        // Chrome can resend the same words as results that grow ("hello", "hello doctors", ...) or repeat
        // ("possible", "possible"). Keep one copy: a longer version replaces the shorter one, a repeat is dropped.
        const finals = [];
        raw.forEach((s) => {
          if (!s) return;
          const last = finals.length ? finals[finals.length - 1] : null;
          if (last === null) { finals.push(s); return; }
          const a = last.toLowerCase();
          const b = s.toLowerCase();
          if (b === a || a.startsWith(b)) return;
          if (b.startsWith(a)) { finals[finals.length - 1] = s; return; }
          finals.push(s);
        });
        // A new session can hear the last words of the previous one again: drop that repeat once.
        if (dropCarry && finals.length) {
          if (carry && finals[0].toLowerCase() === carry.toLowerCase()) finals.shift();
          dropCarry = false;
        }
        lastFinals = finals;
        // The doctor typed into the box: keep their text and continue after the finals heard so far.
        if (paste.value !== written) {
          base = paste.value.replace(/\s*$/, '\n');
          offset = finals.length;
        }
        const spoken = finals.slice(offset).join(' ');
        interim = pending;
        written = base + spoken + (spoken && pending ? ' ' : '') + pending;
        paste.value = written;
      };

      rec.onerror = (event) => {
        if (event.error === 'aborted' || event.error === 'no-speech') return;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') wanted = false;
        const msg = event.error === 'not-allowed' ? 'Allow the microphone for this page to use Speak.'
          : event.error === 'network' ? 'Speak needs an internet connection to your browser\'s speech service.'
          : 'Speak stopped (' + event.error + '). You can type or paste instead.';
        addMsg('bot', [msg], 'msg-warn');
      };

      rec.onend = () => {
        rec = null;
        carry = lastFinals.length ? lastFinals[lastFinals.length - 1] : '';
        dropCarry = !!carry;
        lastFinals = [];
        if (wanted) {
          try { begin(); rec.start(); return; } catch (err) { wanted = false; }
        }
        interim = '';
        setLive(false);
        $('reader-state').textContent = 'Offline reader. Paste, upload a file, or speak.';
        if (paste.value.trim()) paste.focus();
      };
    };

    mic.addEventListener('click', () => {
      if (wanted) {
        wanted = false;
        if (rec) rec.stop();
        return;
      }
      try {
        wanted = true;
        begin();
        rec.start();
        setLive(true);
        $('reader-state').textContent = 'Listening… say the referral, then tap Stop and press Read.';
      } catch (err) {
        wanted = false;
        rec = null;
        setLive(false);
      }
    });
  }

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
      $('reader-state').textContent = 'Offline reader. Paste, upload a file, or speak.';
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
