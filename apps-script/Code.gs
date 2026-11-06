/**
 * SHARE Brain Death Referral Portal - Apps Script web app.
 *
 * Deploy from share@spmcdvo.net: Execute as Me, access Anyone.
 * The script writes into the "Master 2026" tab of PMOD Referral Master 2026
 * and keeps a "Web Referrals" tab for reference numbers and status.
 *
 * Script properties:
 *   SHEET_ID      (optional) spreadsheet ID. Leave empty when the script is bound to the sheet.
 *   ALERT_EMAILS  (optional) comma-separated team addresses. Default below.
 *   SITE_URL      (optional) public page address, used in the thank-you email.
 *
 * Columns I, J and Z of Master 2026 hold formulas. This script never writes them.
 */

var MASTER_TAB = 'Master 2026';
var WEB_TAB = 'Web Referrals';
var ID_PREFIX = 'PMOD-2026-';
var DEFAULT_ALERT_EMAILS = 'almanalaysay93@gmail.com,share@spmcdvo.net';
var TIMEZONE = 'Asia/Manila';
var STATUSES = ['Received', 'Under review', 'Coordinator en route', 'Evaluated', 'Not suitable', 'Closed'];
var WEB_HEADERS = [
  'Reference', 'Submitted at', 'Admission ID', 'Patient name', 'Hospital', 'Doctor name',
  'PRC number', 'Doctor email', 'Contact number', 'Source', 'Status', 'Status updated',
  'Team email', 'Thank-you email'
];

var LIMITS = {
  patient_name: 120, hrn: 60, hospital: 160, ward: 120, diagnosis: 2000, doctor_name: 120,
  prc: 12, doctor_email: 120, contact_number: 20, notes: 2000, raw_text: 20000
};

/* ---------- HTTP ---------- */

function doGet() {
  return json_({ ok: true, service: 'share-referral', time: new Date().toISOString() });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Bad request.' });
  }
  try {
    if (body.action === 'status') return json_(checkStatus_(body));
    if (body.action === 'submit') return json_(submitReferral_(body));
    if (body.action === 'find') return json_(findReferrals_(body));
    if (body.action === 'update') return json_(updateReferral_(body));
    return json_({ ok: false, error: 'Unknown action.' });
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'The referral could not be saved. Please call the SHARE team.' });
  }
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Submit ---------- */

function submitReferral_(body) {
  if (body.website) return { ok: true, reference: 'SHR-000000' }; // honeypot
  var input = cleanInput_(body.referral || {});
  var errors = validate_(input);
  if (errors.length) return { ok: false, error: 'Please check the form.', fields: errors };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var saved;
  try {
    var book = book_();
    var master = book.getSheetByName(MASTER_TAB);
    if (!master) throw new Error('Tab not found: ' + MASTER_TAB);
    var web = webSheet_(book);
    var now = new Date();
    var admissionId = nextAdmissionId_(master);
    var reference = newReference_(web);
    var row = firstEmptyRow_(master);
    var record = buildRecord_(input, admissionId, reference, now, body.source);

    master.getRange(row, 1, 1, 7).setValues([record.aToG]);
    master.getRange(row, 11, 1, 15).setValues([record.kToY]);

    web.appendRow([
      reference, now, admissionId, input.patient_name, input.hospital, input.doctor_name,
      input.prc ? "'" + input.prc : '', input.doctor_email,
      input.contact_number ? "'" + input.contact_number : '',
      body.source === 'chat' ? 'Chat reader' : 'Form', STATUSES[0], now, '', ''
    ]);
    var webRow = web.getLastRow();
    SpreadsheetApp.flush();
    saved = { reference: reference, admissionId: admissionId, row: row, webRow: webRow, record: record, now: now };
  } finally {
    lock.releaseLock();
  }

  var web2 = webSheet_(book_());
  var teamSent = sendTeamEmail_(input, saved);
  web2.getRange(saved.webRow, 13).setValue(teamSent ? 'Sent' : 'Failed');
  var thanks = '';
  if (input.doctor_email) {
    thanks = sendThankYou_(input, saved) ? 'Sent' : 'Failed';
    web2.getRange(saved.webRow, 14).setValue(thanks);
  }

  return {
    ok: true,
    reference: saved.reference,
    admissionId: saved.admissionId,
    status: STATUSES[0],
    thankYouEmail: thanks || 'Not requested'
  };
}

function cleanInput_(raw) {
  var out = {};
  Object.keys(LIMITS).forEach(function (key) {
    var value = raw[key] == null ? '' : String(raw[key]);
    value = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    out[key] = value.slice(0, LIMITS[key]);
  });
  ['age', 'sex', 'admission_date', 'gcs', 'brain_death', 'brain_death_datetime', 'ventilator'].forEach(function (key) {
    out[key] = raw[key] == null ? '' : String(raw[key]).trim().slice(0, 30);
  });
  out.doctor_email = out.doctor_email.toLowerCase();
  out.prc = out.prc.replace(/\D/g, '');
  out.contact_number = out.contact_number.replace(/[^\d+]/g, '');
  return out;
}

function validate_(v) {
  var errors = [];
  if (!v.patient_name) errors.push('patient_name');
  if (!v.hospital) errors.push('hospital');
  if (!v.doctor_name) errors.push('doctor_name');
  if (v.age && !(/^\d{1,3}$/.test(v.age) && Number(v.age) <= 120)) errors.push('age');
  if (v.sex && ['Male', 'Female', 'Unknown'].indexOf(v.sex) < 0) errors.push('sex');
  if (v.gcs && !(/^\d{1,2}$/.test(v.gcs) && Number(v.gcs) >= 3 && Number(v.gcs) <= 15)) errors.push('gcs');
  if (v.brain_death && ['Yes', 'No', 'Unknown'].indexOf(v.brain_death) < 0) errors.push('brain_death');
  if (v.ventilator && ['Yes', 'No', 'Unknown'].indexOf(v.ventilator) < 0) errors.push('ventilator');
  if (v.admission_date && !parseDate_(v.admission_date)) errors.push('admission_date');
  if (v.brain_death_datetime && !parseDate_(v.brain_death_datetime)) errors.push('brain_death_datetime');
  if (v.doctor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.doctor_email)) errors.push('doctor_email');
  if (v.prc && !/^\d{5,8}$/.test(v.prc)) errors.push('prc');
  return errors;
}

/** Accept 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'. Return a Date in Manila time or null. */
function parseDate_(value) {
  var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value || '');
  if (!m) return null;
  var y = +m[1], mo = +m[2], d = +m[3], h = m[4] ? +m[4] : 0, mi = m[5] ? +m[5] : 0;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  var date = new Date(y, mo - 1, d, h, mi);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

function buildRecord_(v, admissionId, reference, now, source) {
  var referrer = v.doctor_name + (v.prc ? ' (PRC ' + v.prc + ')' : '');
  var notes = [
    'Web referral ' + reference + (source === 'chat' ? ' (chat reader)' : ' (form)'),
    'Referring hospital: ' + v.hospital,
    v.ventilator ? 'On ventilator: ' + v.ventilator : '',
    v.contact_number ? 'Contact: ' + v.contact_number : '',
    v.doctor_email ? 'Doctor email: ' + v.doctor_email : '',
    v.notes ? 'Notes: ' + v.notes : '',
    v.raw_text ? 'Pasted referral: ' + v.raw_text : ''
  ].filter(String).join('\n');

  return {
    // A..G: Admission ID, Patient name, HRN, Age, Sex, Admission date, Referral date
    aToG: [
      admissionId, v.patient_name, v.hrn ? "'" + v.hrn : '', v.age ? Number(v.age) : '',
      v.sex || 'Unknown', parseDate_(v.admission_date) || '', now
    ],
    // K..Y: Ward, Referrer, GCS, Diagnosis, Outcome, BD declared, BD date/time,
    //       Family approached, DNR, Consent, Organs, Retrieval date, Recipient hospital,
    //       Non-donation reason, Case notes
    kToY: [
      v.ward, referrer, v.gcs ? Number(v.gcs) : '', v.diagnosis, 'Needs review',
      v.brain_death || 'Unknown', parseDate_(v.brain_death_datetime) || '',
      'Unknown', 'Unknown', 'Unknown', '', '', '', '', notes
    ]
  };
}

/* ---------- Sheet helpers ---------- */

function book_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function webSheet_(book) {
  var sheet = book.getSheetByName(WEB_TAB);
  if (!sheet) {
    sheet = book.insertSheet(WEB_TAB);
    sheet.getRange(1, 1, 1, WEB_HEADERS.length).setValues([WEB_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build();
    sheet.getRange(2, 11, 1999, 1).setDataValidation(rule);
  }
  return sheet;
}

function nextAdmissionId_(master) {
  var last = master.getLastRow();
  var max = 0;
  if (last >= 2) {
    master.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) {
      var m = /^PMOD-\d{4}-(\d+)$/.exec(String(r[0]).trim());
      if (m) max = Math.max(max, Number(m[1]));
    });
  }
  return ID_PREFIX + ('0000' + (max + 1)).slice(-4);
}

/** First row at or after row 2 whose column A is empty. Formula rows below the data stay in place. */
function firstEmptyRow_(master) {
  var last = Math.max(master.getLastRow(), 1);
  var values = last >= 2 ? master.getRange(2, 1, last - 1, 1).getValues() : [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === '') return i + 2;
  }
  return last + 1;
}

function newReference_(web) {
  var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var existing = {};
  var last = web.getLastRow();
  if (last >= 2) web.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { existing[r[0]] = true; });
  for (var attempt = 0; attempt < 20; attempt++) {
    var code = 'SHR-';
    for (var i = 0; i < 6; i++) code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    if (!existing[code]) return code;
  }
  throw new Error('Could not make a unique reference.');
}

/* ---------- Status ---------- */

function checkStatus_(body) {
  var ref = String(body.reference || '').trim().toUpperCase();
  if (!/^SHR-[A-Z0-9]{6}$/.test(ref)) return { ok: false, error: 'Enter a reference like SHR-7K3Q9X.' };
  var web = webSheet_(book_());
  var last = web.getLastRow();
  if (last < 2) return { ok: false, error: 'Reference not found.' };
  var rows = web.getRange(2, 1, last - 1, 12).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toUpperCase() === ref) {
      return {
        ok: true,
        reference: ref,
        status: rows[i][10] || STATUSES[0],
        submittedAt: fmt_(rows[i][1]),
        updatedAt: fmt_(rows[i][11] || rows[i][1])
      };
    }
  }
  return { ok: false, error: 'Reference not found.' };
}

/* ---------- Update ---------- */

var UPDATES_TAB = 'Referral Updates';
var UPDATE_HEADERS = ['Time', 'Reference', 'Admission ID', 'Identified by', 'Changes', 'Note', 'Team email', 'Doctor email'];

/** What the doctor typed to find a referral: a reference, a PRC number or an email address. */
function identityKind_(value) {
  var v = String(value || '').trim();
  if (/^SHR-[A-Z0-9]{6}$/i.test(v)) return { kind: 'reference', value: v.toUpperCase() };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { kind: 'email', value: v.toLowerCase() };
  var digits = v.replace(/\D/g, '');
  if (/^\d{5,8}$/.test(digits) && /^[\d\s-]+$/.test(v)) return { kind: 'PRC', value: digits };
  return null;
}

function rowMatches_(row, id) {
  if (id.kind === 'reference') return String(row[0]).toUpperCase() === id.value;
  if (id.kind === 'email') return String(row[7]).trim().toLowerCase() === id.value;
  return String(row[6]).replace(/\D/g, '') === id.value;
}

/** Referrals that match a reference, PRC or email. Returns no patient details. */
function findReferrals_(body) {
  var id = identityKind_(body.identity);
  if (!id) return { ok: false, error: 'Enter a reference (SHR-7K3Q9X), your PRC number or your email.' };
  var web = webSheet_(book_());
  var last = web.getLastRow();
  var found = [];
  if (last >= 2) {
    web.getRange(2, 1, last - 1, 12).getValues().forEach(function (row) {
      if (row[0] && rowMatches_(row, id)) {
        found.push({ reference: String(row[0]), hospital: String(row[4]), submittedAt: fmt_(row[1]),
          status: row[10] || STATUSES[0], when: row[1] instanceof Date ? row[1].getTime() : 0 });
      }
    });
  }
  found.sort(function (a, b) { return b.when - a.when; });
  found = found.slice(0, 10).map(function (f) { delete f.when; return f; });
  if (!found.length) return { ok: false, error: 'No referral matches that ' + (id.kind === 'reference' ? 'reference' : id.kind) + '.' };
  return { ok: true, identifiedBy: id.kind, referrals: found };
}

function cleanUpdate_(raw) {
  var c = {};
  var text = function (key, max) { return raw[key] == null ? '' : String(raw[key]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max); };
  c.ward = text('ward', 120);
  c.gcs = text('gcs', 2);
  c.ventilator = text('ventilator', 10);
  c.brain_death = text('brain_death', 10);
  c.brain_death_datetime = text('brain_death_datetime', 20);
  c.expired = raw.expired === true || raw.expired === 'Yes';
  c.expired_datetime = text('expired_datetime', 20);
  c.dnr = raw.dnr === true || raw.dnr === 'Yes';
  c.note = text('note', 2000);
  c.raw_text = text('raw_text', 20000);
  return c;
}

function validateUpdate_(c) {
  var errors = [];
  if (c.gcs && !(/^\d{1,2}$/.test(c.gcs) && Number(c.gcs) >= 3 && Number(c.gcs) <= 15)) errors.push('gcs');
  if (c.ventilator && ['Yes', 'No', 'Unknown'].indexOf(c.ventilator) < 0) errors.push('ventilator');
  if (c.brain_death && ['Yes', 'No', 'Unknown'].indexOf(c.brain_death) < 0) errors.push('brain_death');
  if (c.brain_death_datetime && !parseDate_(c.brain_death_datetime)) errors.push('brain_death_datetime');
  if (c.expired_datetime && !parseDate_(c.expired_datetime)) errors.push('expired_datetime');
  var any = c.ward || c.gcs || c.ventilator || c.brain_death || c.brain_death_datetime || c.expired || c.dnr || c.note || c.raw_text;
  if (!any) errors.push('nothing');
  return errors;
}

function updatesSheet_(book) {
  var sheet = book.getSheetByName(UPDATES_TAB);
  if (!sheet) {
    sheet = book.insertSheet(UPDATES_TAB);
    sheet.getRange(1, 1, 1, UPDATE_HEADERS.length).setValues([UPDATE_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function updateReferral_(body) {
  if (body.website) return { ok: true }; // honeypot
  var ref = String(body.reference || '').trim().toUpperCase();
  var id = identityKind_(body.identity);
  if (!/^SHR-[A-Z0-9]{6}$/.test(ref) || !id) return { ok: false, error: 'Find your referral first.' };
  var c = cleanUpdate_(body.update || {});
  var errors = validateUpdate_(c);
  if (errors.indexOf('nothing') >= 0) return { ok: false, error: 'Add at least one change or a note.', fields: ['nothing'] };
  if (errors.length) return { ok: false, error: 'Please check the highlighted fields.', fields: errors };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var result;
  try {
    var book = book_();
    var web = webSheet_(book);
    var last = web.getLastRow();
    var rows = last >= 2 ? web.getRange(2, 1, last - 1, 14).getValues() : [];
    var webIndex = -1;
    for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).toUpperCase() === ref) webIndex = i;
    // The reference must exist and the identity must belong to that same referral.
    if (webIndex < 0 || !rowMatches_(rows[webIndex], id)) {
      return { ok: false, error: 'That reference does not match the PRC number or email you used.' };
    }
    var webRow = rows[webIndex];
    var webRowNumber = webIndex + 2;
    var admissionId = String(webRow[2]);

    var master = book.getSheetByName(MASTER_TAB);
    var mLast = master.getLastRow();
    var ids = master.getRange(2, 1, mLast - 1, 1).getValues();
    var mRow = -1;
    for (var k = 0; k < ids.length; k++) if (String(ids[k][0]).trim() === admissionId) mRow = k + 2;
    if (mRow < 0) return { ok: false, error: 'The SHARE sheet row for this referral was moved. Please call the SHARE team.' };

    var now = new Date();
    var current = master.getRange(mRow, 1, 1, 25).getValues()[0];
    var changes = [];
    var write = function (col, label, value, shown) {
      var before = current[col - 1];
      master.getRange(mRow, col).setValue(value);
      changes.push([label, fmt_(before) || '(blank)', shown == null ? fmt_(value) : shown]);
    };
    if (c.ward) write(11, 'Ward / room (K)', c.ward);
    if (c.gcs) write(13, 'GCS (M)', Number(c.gcs), c.gcs);
    if (c.brain_death) write(16, 'Brain death declared (P)', c.brain_death);
    if (c.brain_death_datetime) write(17, 'Brain death date / time (Q)', parseDate_(c.brain_death_datetime));
    if (c.expired) {
      write(15, 'Hospital outcome (O)', 'Expired');
      if (c.expired_datetime) write(8, 'Hospital end date (H)', parseDate_(c.expired_datetime));
    }
    if (c.dnr) write(19, 'DNR decision (S)', 'Yes');
    if (c.ventilator) changes.push(['On ventilator', '', c.ventilator]);

    var stamp = Utilities.formatDate(now, TIMEZONE, 'dd MMM yyyy HH:mm');
    var lines = ['Update ' + stamp + ' (web, identified by ' + id.kind + ')'];
    changes.forEach(function (ch) { lines.push(ch[0] + ': ' + ch[2]); });
    if (c.note) lines.push('Note: ' + c.note);
    if (c.raw_text) lines.push('Pasted update: ' + c.raw_text);
    var notes = String(current[24] || '');
    master.getRange(mRow, 25).setValue((notes ? notes + '\n\n' : '') + lines.join('\n'));

    var status = webRow[10] || STATUSES[0];
    if (status === STATUSES[0]) {
      status = STATUSES[1];
      web.getRange(webRowNumber, 11).setValue(status);
    }
    web.getRange(webRowNumber, 12).setValue(now);

    var log = updatesSheet_(book);
    log.appendRow([now, ref, admissionId, id.kind,
      changes.map(function (ch) { return ch[0] + ': ' + ch[1] + ' -> ' + ch[2]; }).join('\n'), c.note, '', '']);
    var logRow = log.getLastRow();
    SpreadsheetApp.flush();
    result = {
      ref: ref, admissionId: admissionId, status: status, changes: changes, now: now, logRow: logRow,
      hospital: String(webRow[4]), doctorName: String(webRow[5]), doctorEmail: String(webRow[7] || '')
    };
  } finally {
    lock.releaseLock();
  }

  var team = sendUpdateTeamEmail_(c, result);
  var doctor = '';
  if (result.doctorEmail) doctor = sendUpdateDoctorEmail_(c, result) ? 'Sent' : 'Failed';
  var log2 = updatesSheet_(book_());
  log2.getRange(result.logRow, 7, 1, 2).setValues([[team ? 'Sent' : 'Failed', doctor || 'No email on file']]);

  return { ok: true, reference: result.ref, status: result.status, changes: result.changes.length,
    doctorEmail: doctor || 'No email on file' };
}

function updateSections_(c) {
  var head = 'margin:18px 0 6px;font-weight:bold;color:#0d3b21';
  var box = 'margin:0;padding:12px 14px;background:#ffffff;border:1px solid #d9e2cf;border-radius:10px;' +
    'white-space:pre-wrap;word-break:break-word;font:13px/1.5 Consolas,Menlo,monospace;color:#16261b';
  var html = '', text = '';
  if (c.note) { html += '<p style="' + head + '">Update note</p><pre style="' + box + '">' + esc_(c.note) + '</pre>'; text += '\n\nUpdate note\n' + c.note; }
  if (c.raw_text) { html += '<p style="' + head + '">Update as sent</p><pre style="' + box + '">' + esc_(c.raw_text) + '</pre>'; text += '\n\nUpdate as sent\n' + c.raw_text; }
  return { html: html, text: text };
}

function sendUpdateTeamEmail_(c, r) {
  try {
    var flag = c.expired ? 'PATIENT EXPIRED' : c.brain_death === 'Yes' ? 'BRAIN DEATH DECLARED' : 'Referral update';
    var rows = [['Reference', r.ref], ['Admission ID', r.admissionId], ['Hospital', r.hospital], ['Status', r.status]];
    var changeRows = r.changes.map(function (ch) { return [ch[0], ch[1] + '  →  ' + ch[2]]; });
    var extra = updateSections_(c);
    var html = '<div style="font:14px Arial,sans-serif;color:#16261b;max-width:680px">' +
      '<h2 style="color:#008037;margin:0 0 6px">Referral updated by the referring doctor</h2>' +
      '<p style="margin:0 0 14px">Received ' + esc_(fmt_(r.now)) + '. The sheet row was changed as shown below.</p>' +
      table_(rows) + (changeRows.length ? '<p style="margin:18px 0 6px;font-weight:bold;color:#0d3b21">Changes (old → new)</p>' + table_(changeRows) : '') +
      extra.html + '</div>';
    var text = 'Referral ' + r.ref + ' (' + r.admissionId + ') updated ' + fmt_(r.now) + '.\n\n' +
      changeRows.map(function (x) { return x[0] + ': ' + x[1]; }).join('\n') + extra.text;
    MailApp.sendEmail({ to: alertEmails_(), subject: '[SHARE referral] UPDATE - ' + flag + ' - ' + r.hospital + ' - ' + r.admissionId,
      body: text, htmlBody: html, name: 'SHARE Referral Portal' });
    return true;
  } catch (err) {
    console.error('Update team email failed: ' + err);
    return false;
  }
}

function sendUpdateDoctorEmail_(c, r) {
  try {
    var changeRows = r.changes.map(function (ch) { return [ch[0], ch[2]]; });
    var extra = updateSections_(c);
    var html = '<div style="font:15px Arial,sans-serif;color:#16261b;max-width:600px;line-height:1.55">' +
      '<div style="background:#008037;color:#fff;padding:22px 24px;border-radius:14px 14px 0 0">' +
      '<div style="font-size:24px;font-weight:bold">Thank you, ' + esc_(r.doctorName) + '.</div></div>' +
      '<div style="background:#f4f8ef;padding:22px 24px;border-radius:0 0 14px 14px">' +
      '<p style="margin:0 0 12px"><b>We received your update to referral ' + esc_(r.ref) + '.</b> The SHARE coordinator has been told.</p>' +
      (changeRows.length ? table_(changeRows) : '') + extra.html +
      '<p style="margin:16px 0 0">With gratitude,<br><b>The SHARE Team</b></p></div></div>';
    var text = 'Thank you, ' + r.doctorName + '.\n\nWe received your update to referral ' + r.ref + '.\n\n' +
      changeRows.map(function (x) { return x[0] + ': ' + x[1]; }).join('\n') + extra.text + '\n\nThe SHARE Team';
    MailApp.sendEmail({ to: r.doctorEmail, subject: 'Update received (' + r.ref + ')', body: text, htmlBody: html,
      name: 'SHARE Team', replyTo: 'share@spmcdvo.net' });
    return true;
  } catch (err) {
    console.error('Update doctor email failed: ' + err);
    return false;
  }
}

/** Simple trigger: stamp "Status updated" when the team changes a status. */
function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== WEB_TAB || e.range.getColumn() !== 11 || e.range.getRow() < 2) return;
  sheet.getRange(e.range.getRow(), 12, e.range.getNumRows(), 1).setValue(new Date());
}

/* ---------- Email ---------- */

function alertEmails_() {
  return PropertiesService.getScriptProperties().getProperty('ALERT_EMAILS') || DEFAULT_ALERT_EMAILS;
}

function fmt_(value, withTime) {
  if (!(value instanceof Date)) return value == null ? '' : String(value);
  return Utilities.formatDate(value, TIMEZONE, withTime === false ? 'dd MMM yyyy' : 'dd MMM yyyy HH:mm');
}

function esc_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Rows of [label, value] exactly as written to Master 2026. */
function transcribedRows_(saved) {
  var a = saved.record.aToG, k = saved.record.kToY;
  return [
    ['Admission ID (A)', a[0]], ['Patient name (B)', a[1]], ['Hospital record number (C)', String(a[2]).replace(/^'/, '')],
    ['Age at referral (D)', a[3]], ['Sex (E)', a[4]], ['ER / hospital admission date (F)', fmt_(a[5], false)],
    ['Referral date (G)', fmt_(a[6])], ['Ward / room (K)', k[0]], ['Referring staff / doctor (L)', k[1]],
    ['GCS at referral (M)', k[2]], ['Diagnosis (N)', k[3]], ['Hospital outcome (O)', k[4]],
    ['Brain death declared (P)', k[5]], ['Brain death date / time (Q)', fmt_(k[6])],
    ['Family approached (R)', k[7]], ['DNR decision (S)', k[8]], ['Donation consent (T)', k[9]],
    ['Case notes (Y)', k[14]]
  ];
}

function table_(rows) {
  return '<table style="border-collapse:collapse;width:100%;font:14px Arial,sans-serif">' +
    rows.map(function (r) {
      return '<tr><th style="text-align:left;vertical-align:top;padding:6px 10px;border-bottom:1px solid #d9e2cf;color:#0d3b21;width:38%">' +
        esc_(r[0]) + '</th><td style="padding:6px 10px;border-bottom:1px solid #d9e2cf;white-space:pre-wrap">' +
        (r[1] === '' || r[1] == null ? '<span style="color:#888">(blank)</span>' : esc_(r[1])) + '</td></tr>';
    }).join('') + '</table>';
}

/** Clinical notes and the referral text exactly as the doctor sent it, for both emails. */
function referralSections_(input) {
  var box = 'margin:0;padding:12px 14px;background:#ffffff;border:1px solid #d9e2cf;border-radius:10px;' +
    'white-space:pre-wrap;word-break:break-word;font:13px/1.5 Consolas,Menlo,monospace;color:#16261b';
  var head = 'margin:18px 0 6px;font-weight:bold;color:#0d3b21';
  var html = '', text = '';
  if (input.notes) {
    html += '<p style="' + head + '">Clinical notes</p><pre style="' + box + '">' + esc_(input.notes) + '</pre>';
    text += '\n\nClinical notes\n' + input.notes;
  }
  if (input.raw_text) {
    html += '<p style="' + head + '">Referral as sent</p><pre style="' + box + '">' + esc_(input.raw_text) + '</pre>';
    text += '\n\nReferral as sent\n' + input.raw_text;
  }
  return { html: html, text: text };
}

function sendTeamEmail_(input, saved) {
  try {
    // Case notes (Y) repeats the clinical notes and the pasted text, so the email shows those once, below.
    var rows = transcribedRows_(saved).filter(function (r) { return r[0] !== 'Case notes (Y)'; });
    var extra = referralSections_(input);
    var bd =input.brain_death === 'Yes' ? 'DECLARED BRAIN DEATH' : 'Brain death referral';
    var subject = '[SHARE referral] ' + bd + ' - ' + input.hospital + ' - ' + saved.admissionId;
    var sheetUrl = book_().getUrl();
    var html =
      '<div style="font:14px Arial,sans-serif;color:#16261b;max-width:680px">' +
      '<h2 style="color:#008037;margin:0 0 6px">New referral transcribed to the sheet</h2>' +
      '<p style="margin:0 0 14px">Reference <b>' + esc_(saved.reference) + '</b>, written to <b>' + MASTER_TAB +
      '</b> row ' + saved.row + ' at ' + esc_(fmt_(saved.now)) + '.</p>' +
      '<p style="margin:0 0 14px">Referring doctor: <b>' + esc_(input.doctor_name) + '</b>' +
      (input.contact_number ? ' &middot; ' + esc_(input.contact_number) : '') +
      (input.doctor_email ? ' &middot; ' + esc_(input.doctor_email) : '') + '</p>' +
      table_(rows) + extra.html +
      '<p style="margin:16px 0 0"><a href="' + esc_(sheetUrl) + '" style="color:#008037">Open the sheet</a>. ' +
      'Set the status in the ' + WEB_TAB + ' tab so the doctor can follow the case.</p></div>';
    var text = 'New referral ' + saved.reference + ' written to ' + MASTER_TAB + ' row ' + saved.row + '.\n\n' +
      rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') + extra.text + '\n\n' + sheetUrl;
    MailApp.sendEmail({ to: alertEmails_(), subject: subject, body: text, htmlBody: html, name: 'SHARE Referral Portal' });
    return true;
  } catch (err) {
    console.error('Team email failed: ' + err);
    return false;
  }
}

function sendThankYou_(input, saved) {
  try {
    var site = PropertiesService.getScriptProperties().getProperty('SITE_URL') || '';
    var statusLink = site ? site.replace(/#.*$/, '').replace(/[^/]*$/, '') + 'status.html?ref=' + encodeURIComponent(saved.reference) : '';
    var summary = [
      ['Reference', saved.reference], ['Patient', input.patient_name], ['Hospital', input.hospital],
      ['Ward / room', input.ward], ['GCS', input.gcs], ['Diagnosis', input.diagnosis],
      ['Brain death declared', input.brain_death || 'Unknown'], ['On ventilator', input.ventilator],
      ['Received', fmt_(saved.now)]
    ].filter(function (r) { return r[1] !== '' && r[1] != null; });
    var extra = referralSections_(input);
    var html =
      '<div style="font:15px Arial,sans-serif;color:#16261b;max-width:600px;line-height:1.55">' +
      '<div style="background:#008037;color:#fff;padding:22px 24px;border-radius:14px 14px 0 0">' +
      '<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.85">SHARE &middot; Southern Philippines Medical Center</div>' +
      '<div style="font-size:24px;font-weight:bold;margin-top:6px">Thank you, ' + esc_(input.doctor_name) + '.</div></div>' +
      '<div style="background:#f4f8ef;padding:22px 24px;border-radius:0 0 14px 14px">' +
      '<p style="margin:0 0 12px"><b>We received your referral.</b> Thank you for referring this patient to SHARE. ' +
      'A coordinator is reviewing it and will contact your team.</p>' +
      '<p style="margin:0 0 8px;font-weight:bold;color:#0d3b21">Your referral</p>' +
      table_(summary) + extra.html +
      (statusLink ? '<p style="margin:16px 0 0">Follow the case: <a href="' + esc_(statusLink) + '" style="color:#008037;font-weight:bold">check status for ' + esc_(saved.reference) + '</a></p>' : '') +
      '<p style="margin:16px 0 0">With gratitude,<br><b>The SHARE Team</b><br>Southern Philippines Medical Center Human Advocate and Retrieval Effort</p>' +
      '</div></div>';
    var text = 'Thank you, ' + input.doctor_name + '.\n\nWe received your referral ' + saved.reference +
      '. Thank you for referring this patient to SHARE. A coordinator is reviewing it and will contact your team.\n\n' +
      'Your referral\n' +
      summary.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') + extra.text +
      (statusLink ? '\n\nCheck status: ' + statusLink : '') + '\n\nWith gratitude,\nThe SHARE Team';
    MailApp.sendEmail({
      to: input.doctor_email,
      subject: 'Thank you for your referral (' + saved.reference + ')',
      body: text, htmlBody: html, name: 'SHARE Team', replyTo: 'share@spmcdvo.net'
    });
    return true;
  } catch (err) {
    console.error('Thank-you email failed: ' + err);
    return false;
  }
}

/* ---------- Editor helpers ---------- */

/** Run once from the editor: makes the Web Referrals tab and asks for mail permission. */
function setup() {
  var book = book_();
  if (!book.getSheetByName(MASTER_TAB)) throw new Error('Tab not found: ' + MASTER_TAB);
  webSheet_(book);
  Logger.log('Ready. Next Admission ID: ' + nextAdmissionId_(book.getSheetByName(MASTER_TAB)) +
    ', next empty row: ' + firstEmptyRow_(book.getSheetByName(MASTER_TAB)) +
    ', mail quota left: ' + MailApp.getRemainingDailyQuota());
}
