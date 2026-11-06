// Page 4: update a referral. Find it by reference, PRC number or email (no patient details come back),
// then send changes: brain death, GCS, ventilator, ward, expired, DNR, a note, or a pasted update that the
// offline reader turns into those fields.
(function () {
  'use strict';
  const { el, post } = window.Share;
  const $ = (id) => document.getElementById(id);
  const form = $('update-form');
  let chosen = null;      // reference being updated
  let identity = '';      // what the doctor typed to find it
  const pasted = [];

  /* ---------- Step 1: find ---------- */

  function renderFound(res) {
    const box = $('find-result');
    box.textContent = '';
    if (!res.ok) {
      // An older backend without the update actions answers "Unknown action."
      const text = res.error === 'Unknown action.'
        ? 'Updating referrals is being switched on. Please call or message the SHARE team for now.'
        : res.error || 'Not found.';
      box.appendChild(el('p', 'status-error', text));
      return;
    }
    const list = el('div', 'found-refs');
    list.setAttribute('role', 'radiogroup');
    list.setAttribute('aria-label', 'Your referrals');
    res.referrals.forEach((r) => {
      const label = el('label', 'ref-card');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'ref-pick';
      input.value = r.reference;
      const body = el('span', 'ref-body');
      body.append(el('b', null, r.reference), el('span', null, r.hospital), el('small', null, 'Sent ' + r.submittedAt + ' · ' + r.status));
      label.append(input, body);
      input.addEventListener('change', () => choose(r.reference));
      list.appendChild(label);
    });
    box.appendChild(list);
    if (res.referrals.length === 1) {
      list.querySelector('input').checked = true;
      choose(res.referrals[0].reference);
    } else {
      box.insertBefore(el('p', 'panel-sub', res.referrals.length + ' referrals found. Pick the one to update.'), list);
    }
  }

  function choose(ref) {
    chosen = ref;
    $('for-ref').textContent = ref;
    $('update-step').hidden = false;
    $('update-success').hidden = true;
    form.hidden = false;
    $('update-step').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function find(value) {
    const btn = $('find-btn');
    btn.disabled = true;
    $('find-result').textContent = 'Searching…';
    try {
      const res = await post({ action: 'find', identity: value });
      if (res.ok) identity = value;
      renderFound(res);
    } catch (err) {
      renderFound({ ok: false, error: 'Could not reach the server. Try again.' });
    } finally {
      btn.disabled = false;
    }
  }

  $('find-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const value = $('identity').value.trim();
    if (!value) { $('identity').focus(); return; }
    find(value);
  });

  const fromUrl = (new URLSearchParams(location.search).get('ref') || '').toUpperCase();
  if (/^SHR-[A-Z0-9]{6}$/.test(fromUrl)) {
    $('identity').value = fromUrl;
    find(fromUrl);
  }

  /* ---------- Step 2: changes ---------- */

  $('u-expired').addEventListener('change', () => { $('expired-time-field').hidden = !$('u-expired').checked; });

  function setRadio(name, value) {
    const input = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (!input) return false;
    input.checked = true;
    input.closest('.seg').classList.add('filled');
    return true;
  }

  function setValue(id, value) {
    const input = $(id);
    input.value = value;
    if (input.value !== value) { input.value = ''; return false; }
    input.classList.add('filled');
    return true;
  }

  $('read-update').addEventListener('click', async () => {
    const text = $('update-paste').value.trim();
    if (!text) { $('update-paste').focus(); return; }
    const state = $('read-state');
    state.textContent = 'Reading…';
    try {
      const { fields: f } = await window.ReferralReader.read(text);
      const got = [];
      if (f.brain_death === 'Yes' || f.brain_death === 'No') { setRadio('brain_death', f.brain_death); got.push('brain death'); }
      if (f.brain_death_datetime && setValue('u-bd-time', f.brain_death_datetime)) got.push('time declared');
      if (f.gcs && setValue('u-gcs', f.gcs)) got.push('GCS');
      if (f.ventilator === 'Yes' || f.ventilator === 'No') { setRadio('ventilator', f.ventilator); got.push('ventilator'); }
      if (f.ward && setValue('u-ward', f.ward)) got.push('ward');
      if (f.expired === 'Yes') {
        $('u-expired').checked = true;
        $('expired-time-field').hidden = false;
        got.push('expired');
        if (f.expired_datetime && setValue('u-expired-time', f.expired_datetime)) got.push('time of death');
      }
      if (f.dnr === 'Yes') { $('u-dnr').checked = true; got.push('DNR'); }
      pasted.push(text);
      state.textContent = got.length ? 'Found: ' + got.join(', ') + '. Check them below.' : 'No changes found. Pick them below or write a note.';
    } catch (err) {
      state.textContent = 'The reader could not start. Pick the changes below.';
    }
  });

  function radio(name) {
    const checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('update-msg');
    msg.textContent = '';
    if (!chosen) { msg.textContent = 'Find your referral first.'; return; }
    const update = {
      brain_death: radio('brain_death'),
      brain_death_datetime: $('u-bd-time').value,
      gcs: $('u-gcs').value,
      ventilator: radio('ventilator'),
      ward: $('u-ward').value.trim(),
      expired: $('u-expired').checked,
      expired_datetime: $('u-expired').checked ? $('u-expired-time').value : '',
      dnr: $('u-dnr').checked,
      note: $('u-note').value.trim(),
      raw_text: pasted.join('\n---\n').slice(0, 20000),
    };
    const btn = $('update-btn');
    btn.disabled = true;
    btn.classList.add('busy');
    btn.querySelector('.btn-label').textContent = 'Sending';
    try {
      const res = await post({ action: 'update', reference: chosen, identity, website: $('u-website').value, update });
      if (!res || !res.ok) {
        msg.textContent = (res && res.error) || 'The update was not saved. Please try again.';
        return;
      }
      $('ok-ref').textContent = res.reference || chosen;
      $('ok-status').href = 'status.html?ref=' + encodeURIComponent(chosen);
      $('ok-mail').textContent = res.doctorEmail === 'Sent'
        ? 'A confirmation is on its way to the email on file for this referral.'
        : 'The SHARE team has been told.';
      form.hidden = true;
      $('update-success').hidden = false;
      $('update-success').focus();
    } catch (err) {
      msg.textContent = 'Not sent. Check your signal and press Send update again. Your changes are still here.';
    } finally {
      btn.disabled = false;
      btn.classList.remove('busy');
      btn.querySelector('.btn-label').textContent = 'Send update';
    }
  });
})();
