// Page 2: check and send. Loads the reader draft, never overwrites what the doctor types, and submits.
(function () {
  'use strict';
  const { LABELS, post, draft } = window.Share;
  const $ = (id) => document.getElementById(id);
  const RADIOS = ['brain_death', 'ventilator'];
  const form = $('referral-form');
  const saved = draft.load();
  const rawTexts = saved && saved.raw ? saved.raw.slice() : [];
  const usedReader = rawTexts.length > 0;

  function getValue(name) {
    if (RADIOS.includes(name)) {
      const checked = form.querySelector('input[name="' + name + '"]:checked');
      return checked ? checked.value : '';
    }
    const input = form.elements[name];
    return input ? input.value.trim() : '';
  }

  function markFilled(node) {
    node.classList.add('filled');
    node.dataset.auto = '1';
  }

  function fillForm(fields) {
    let count = 0;
    Object.keys(fields).forEach((name) => {
      const value = fields[name];
      if (!value) return;
      if (RADIOS.includes(name)) {
        const radio = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
        if (radio) { radio.checked = true; markFilled(radio.closest('.seg')); count++; }
        return;
      }
      const input = form.elements[name];
      if (!input) return;
      input.value = value;
      if (input.value !== value) { input.value = ''; return; } // control rejected the value, for example a bad date
      markFilled(input);
      count++;
    });
    return count;
  }

  if (saved && saved.fields) {
    const n = fillForm(saved.fields);
    if (n) {
      $('filled-note').hidden = false;
      $('filled-count').textContent = n + (n === 1 ? ' field' : ' fields');
    }
  }

  form.addEventListener('input', (e) => {
    const t = e.target;
    if (!t.name) return;
    const node = t.type === 'radio' ? t.closest('.seg') : t;
    node.dataset.auto = '';
    node.classList.remove('filled');
    clearInvalid(t.name);
  });

  function setInvalid(name) {
    const input = form.elements[name];
    const field = input && input.closest ? input.closest('.field') : null;
    if (field) field.classList.add('invalid');
    if (input && input.setAttribute) {
      input.setAttribute('aria-invalid', 'true');
      if ($('e-' + name)) input.setAttribute('aria-describedby', 'e-' + name);
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
    data.raw_text = rawTexts.join('\n---\n').slice(0, 20000);
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
      const res = await post({ action: 'submit', source: usedReader ? 'chat' : 'form', website: form.elements.website.value, referral: data });
      if (!res || !res.ok) {
        (res && res.fields ? res.fields : []).forEach(setInvalid);
        msg.textContent = (res && res.error) || 'The referral was not saved. Please try again.';
        return;
      }
      draft.clear();
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
    $('ok-status-link').href = 'status.html?ref=' + encodeURIComponent(res.reference);
    $('ok-mail').textContent = data.doctor_email
      ? 'A thank-you note with this reference is on its way to ' + data.doctor_email + '.'
      : 'Keep this reference to check the status later.';
    form.hidden = true;
    $('filled-note').hidden = true;
    $('success').hidden = false;
    $('success').focus();
    $('success').scrollIntoView({ block: 'center' });
  }

  $('copy-ref').addEventListener('click', async () => {
    const label = $('copy-ref').querySelector('span');
    try {
      await navigator.clipboard.writeText($('ok-ref').textContent);
      label.textContent = 'Copied';
    } catch (err) {
      label.textContent = 'Select and copy';
    }
    setTimeout(() => { label.textContent = 'Copy'; }, 1800);
  });
})();
