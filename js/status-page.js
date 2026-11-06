// Page 3: status check. Shows the status only, never patient details.
(function () {
  'use strict';
  const { el, post } = window.Share;
  const $ = (id) => document.getElementById(id);
  const STATUSES = ['Received', 'Under review', 'Coordinator en route', 'Evaluated'];
  const TERMINAL = ['Not suitable', 'Closed'];
  const REF_RE = /^SHR-[A-Z0-9]{6}$/;

  function renderStatus(res) {
    const box = $('status-result');
    box.textContent = '';
    if (!res.ok) {
      box.appendChild(el('p', 'status-error', res.error || 'Reference not found.'));
      return;
    }
    const card = el('div', 'status-card');
    card.appendChild(el('p', 'status-ref', res.reference));
    card.appendChild(el('h2', 'status-now', res.status));
    if (TERMINAL.includes(res.status)) {
      card.appendChild(el('p', 'status-meta', 'Thank you for referring. The SHARE team will contact you if they need anything else.'));
    } else {
      const idx = Math.max(0, STATUSES.indexOf(res.status));
      const list = el('ol', 'steps');
      list.setAttribute('aria-label', 'Referral progress');
      STATUSES.forEach((s, i) => {
        const li = el('li', i < idx ? 'done' : i === idx ? 'now' : '', s);
        if (i === idx) li.setAttribute('aria-current', 'step');
        list.appendChild(li);
      });
      card.appendChild(list);
    }
    card.appendChild(el('p', 'status-meta', 'Received ' + res.submittedAt + '. Last update ' + res.updatedAt + '.'));
    const update = el('a', 'btn-ghost status-update', 'Something changed? Update this referral');
    update.href = 'update.html?ref=' + encodeURIComponent(res.reference);
    card.appendChild(update);
    box.appendChild(card);
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
    if (!REF_RE.test(ref)) {
      renderStatus({ ok: false, error: 'A reference looks like SHR-7K3Q9X.' });
      $('status-ref').focus();
      return;
    }
    history.replaceState(null, '', '?ref=' + encodeURIComponent(ref));
    checkStatus(ref);
  });

  const fromUrl = (new URLSearchParams(location.search).get('ref') || '').toUpperCase();
  if (REF_RE.test(fromUrl)) {
    $('status-ref').value = fromUrl;
    checkStatus(fromUrl);
  }
})();
