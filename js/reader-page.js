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
    let wanted = false;      // the doctor wants to keep listening
    let base = '';           // paste box text before this dictation segment
    let spoken = '';         // final speech text written so far in this segment
    let doneIndex = 0;       // results before this index are already in `spoken`
    let written = '';        // what this code last wrote into the box

    const setLive = (live) => {
      mic.classList.toggle('is-live', live);
      mic.setAttribute('aria-pressed', String(live));
      label.textContent = live ? 'Stop' : 'Speak';
    };

    // Start a recognition session. Chrome ends a session after a pause, so the session restarts while wanted.
    const begin = () => {
      rec = new Speech();
      rec.lang = 'en-PH';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      base = paste.value ? paste.value.replace(/\s*$/, '\n') : '';
      spoken = '';
      doneIndex = 0;
      written = paste.value;

      rec.onresult = (event) => {
        // If the doctor typed into the box since the last update, keep their text and start a new segment.
        if (paste.value !== written) {
          base = paste.value.replace(/\s*$/, '\n');
          spoken = '';
        }
        for (let i = doneIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            spoken += event.results[i][0].transcript.trim() + ' ';
            doneIndex = i + 1;
          }
        }
        let interim = '';
        for (let i = doneIndex; i < event.results.length; i++) {
          if (!event.results[i].isFinal) interim += event.results[i][0].transcript;
        }
        written = base + spoken + interim;
        paste.value = written;
      };

      rec.onerror = (event) => {
        if (event.error === 'aborted') return;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') wanted = false;
        const msg = event.error === 'not-allowed' ? 'Allow the microphone for this page to use Speak.'
          : event.error === 'network' ? 'Speak needs an internet connection to your browser\'s speech service.'
          : event.error === 'no-speech' ? 'I did not hear anything. Keep talking, or tap Speak again.'
          : 'Speak stopped (' + event.error + '). You can type or paste instead.';
        if (event.error !== 'no-speech') addMsg('bot', [msg], 'msg-warn');
      };

      rec.onend = () => {
        rec = null;
        if (wanted) {
          try { begin(); rec.start(); return; } catch (err) { wanted = false; }
        }
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
