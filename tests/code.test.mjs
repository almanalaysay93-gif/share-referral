// Runs apps-script/Code.gs in a Node VM against an in-memory spreadsheet.
// Run: node --test tests/code.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const isDate = (v) => Object.prototype.toString.call(v) === '[object Date]';
const CODE = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');

function makeSheet(name, rows) {
  const data = rows.map((r) => r.slice());
  const sheet = {
    name, data, validation: null, frozen: 0,
    getName: () => name,
    getLastRow: () => {
      for (let i = data.length - 1; i >= 0; i--) if (data[i].some((c) => c !== '' && c != null)) return i + 1;
      return 0;
    },
    getRange(row, col, numRows = 1, numCols = 1) {
      const range = {
        getValues: () => Array.from({ length: numRows }, (_, i) =>
          Array.from({ length: numCols }, (_, j) => (data[row - 1 + i] || [])[col - 1 + j] ?? '')),
        setValues(values) {
          values.forEach((r, i) => r.forEach((v, j) => {
            while (data.length < row + i) data.push([]);
            data[row - 1 + i][col - 1 + j] = v;
          }));
          return range;
        },
        setValue(v) { return range.setValues(Array.from({ length: numRows }, () => Array(numCols).fill(v))); },
        setFontWeight: () => range,
        setDataValidation(rule) { sheet.validation = rule; return range; },
        getSheet: () => sheet, getColumn: () => col, getRow: () => row, getNumRows: () => numRows,
      };
      return range;
    },
    appendRow(r) { data.splice(sheet.getLastRow(), 0, r.slice()); },
    setFrozenRows(n) { sheet.frozen = n; },
  };
  return sheet;
}

const MASTER_HEADER = ['Admission ID', 'Patient name', 'Hospital record number', 'Age at referral', 'Sex',
  'ER / hospital admission date', 'Referral date', 'Hospital end date', 'Hospital stay (days)', 'Days to referral',
  'Ward / room', 'Referring staff / doctor', 'GCS at referral', 'Diagnosis', 'Hospital outcome',
  'Brain death declared', 'Brain death date / time', 'Family approached', 'DNR decision', 'Donation consent',
  'Organs retrieved', 'Retrieval date', 'Recipient hospital', 'Non-donation reason', 'Case notes', 'Data checks'];

function setup({ masterRows = 3, formulaRows = 5, mailFails = false } = {}) {
  const rows = [MASTER_HEADER];
  for (let i = 1; i <= masterRows; i++) {
    const r = Array(26).fill('');
    r[0] = 'PMOD-2026-' + String(i * 2).padStart(4, '0');
    r[1] = 'Existing ' + i; r[8] = '=FORMULA'; r[9] = '=FORMULA'; r[25] = '=CHECK';
    rows.push(r);
  }
  for (let i = 0; i < formulaRows; i++) {
    const r = Array(26).fill(''); r[8] = '=FORMULA'; r[9] = '=FORMULA'; r[25] = '=CHECK'; rows.push(r);
  }
  const master = makeSheet('Master 2026', rows);
  const sheets = { 'Master 2026': master };
  const mails = [];
  const book = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = makeSheet(n, [])),
    getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST/edit',
  };
  const rule = { list: null };
  const ctx = {
    console: { error() {}, log() {} },
    Logger: { log() {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => book, openById: () => book, flush() {},
      newDataValidation: () => ({ requireValueInList(l) { rule.list = l; return this; }, setAllowInvalid() { return this; }, build: () => rule }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'SITE_URL' ? 'https://example.org/referral/' : null) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: {
      sendEmail(o) { if (mailFails) throw new Error('quota'); mails.push(o); },
      getRemainingDailyQuota: () => 100,
    },
    Utilities: { formatDate: (d) => d.toISOString() },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType: () => ({ body: JSON.parse(s) }) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  const post = (body) => ctx.doPost({ postData: { contents: JSON.stringify(body) } }).body;
  return { ctx, master, sheets, mails, post };
}

const VALID = {
  patient_name: 'Juan Dela Cruz', hrn: '0012345', age: '45', sex: 'Male', hospital: 'Davao Doctors Hospital',
  ward: 'ICU 3', admission_date: '2026-11-02', gcs: '3', diagnosis: 'Acute CVD bleed',
  brain_death: 'Yes', brain_death_datetime: '2026-11-05T15:40', ventilator: 'Yes',
  doctor_name: 'Dr. Maria Santos', prc: '0123456', doctor_email: 'MSantos@Example.com',
  contact_number: '0917 123 4567', notes: '', raw_text: 'Name: Juan',
};

test('submit writes first empty row, next ID, and leaves formula columns alone', () => {
  const { master, sheets, post } = setup();
  const res = post({ action: 'submit', source: 'chat', referral: VALID });
  assert.equal(res.ok, true);
  assert.equal(res.admissionId, 'PMOD-2026-0007');
  assert.match(res.reference, /^SHR-[A-Z0-9]{6}$/);
  const row = master.data[4];
  assert.equal(row[0], 'PMOD-2026-0007');
  assert.equal(row[1], 'Juan Dela Cruz');
  assert.equal(row[2], "'0012345");
  assert.equal(row[3], 45);
  assert.equal(row[4], 'Male');
  assert.ok(isDate(row[5]));
  assert.equal(row[8], '=FORMULA');
  assert.equal(row[9], '=FORMULA');
  assert.equal(row[25], '=CHECK');
  assert.equal(row[11], 'Dr. Maria Santos (PRC 0123456)');
  assert.equal(row[12], 3);
  assert.equal(row[14], 'Needs review');
  assert.equal(row[15], 'Yes');
  assert.equal(row[16].getHours(), 15);
  assert.equal(row[17], 'Unknown');
  assert.match(row[24], /Web referral SHR-.*chat reader/);
  assert.match(row[24], /Referring hospital: Davao Doctors Hospital/);
  assert.equal(master.data.length, 9, 'no row appended below formula rows');
  const web = sheets['Web Referrals'];
  assert.equal(web.data[1][0], res.reference);
  assert.equal(web.data[1][10], 'Received');
  assert.equal(web.data[1][12], 'Sent');
  assert.equal(web.data[1][13], 'Sent');
});

test('team email carries the transcribed row and doctor gets a thank-you', () => {
  const { post, mails } = setup();
  const res = post({ action: 'submit', referral: VALID });
  assert.equal(mails.length, 2);
  const team = mails[0];
  assert.equal(team.to, 'almanalaysay93@gmail.com,share@spmcdvo.net');
  assert.match(team.subject, /DECLARED BRAIN DEATH/);
  assert.match(team.htmlBody, /Patient name \(B\)/);
  assert.match(team.htmlBody, /Juan Dela Cruz/);
  assert.match(team.htmlBody, /Needs review/);
  const thanks = mails[1];
  assert.equal(thanks.to, 'msantos@example.com');
  assert.match(thanks.htmlBody, /Thank you, Dr\. Maria Santos/);
  assert.match(thanks.htmlBody, /We received your referral/);
  assert.match(thanks.htmlBody, /Davao Doctors Hospital/);
  assert.ok(!thanks.htmlBody.includes('Today that doctor was you'));
  assert.ok(thanks.htmlBody.includes('https://example.org/referral/status.html?ref=' + res.reference));
});

test('no doctor email means no thank-you email', () => {
  const { post, mails } = setup();
  const res = post({ action: 'submit', referral: { ...VALID, doctor_email: '' } });
  assert.equal(res.ok, true);
  assert.equal(res.thankYouEmail, 'Not requested');
  assert.equal(mails.length, 1);
});

test('missing required fields and bad values are refused without writing', () => {
  const { master, post } = setup();
  const before = JSON.stringify(master.data);
  const res = post({ action: 'submit', referral: { ...VALID, patient_name: '', doctor_name: ' ', gcs: '22', doctor_email: 'nope' } });
  assert.equal(res.ok, false);
  assert.deepEqual(res.fields.sort(), ['doctor_email', 'doctor_name', 'gcs', 'patient_name']);
  assert.equal(JSON.stringify(master.data), before);
});

test('impossible dates are refused', () => {
  const { post } = setup();
  assert.equal(post({ action: 'submit', referral: { ...VALID, admission_date: '2026-02-30' } }).ok, false);
});

test('HTML in fields is escaped in emails', () => {
  const { post, mails } = setup();
  post({ action: 'submit', referral: { ...VALID, diagnosis: '<script>x</script>' } });
  assert.ok(!mails[0].htmlBody.includes('<script>'));
  assert.ok(mails[0].htmlBody.includes('&lt;script&gt;'));
});

test('mail failure still saves the referral and records Failed', () => {
  const { post, sheets } = setup({ mailFails: true });
  const res = post({ action: 'submit', referral: VALID });
  assert.equal(res.ok, true);
  assert.equal(sheets['Web Referrals'].data[1][12], 'Failed');
});

test('status lookup returns status only, never patient data', () => {
  const { post, sheets } = setup();
  const res = post({ action: 'submit', referral: VALID });
  sheets['Web Referrals'].data[1][10] = 'Coordinator en route';
  const st = post({ action: 'status', reference: res.reference.toLowerCase() });
  assert.equal(st.ok, true);
  assert.equal(st.status, 'Coordinator en route');
  assert.ok(!JSON.stringify(st).includes('Juan'));
  assert.equal(post({ action: 'status', reference: 'SHR-ZZZZZZ' }).ok, false);
  assert.equal(post({ action: 'status', reference: 'bad' }).ok, false);
});

test('second referral gets the next ID and the next empty row', () => {
  const { master, post } = setup();
  post({ action: 'submit', referral: VALID });
  const res = post({ action: 'submit', referral: { ...VALID, patient_name: 'Second' } });
  assert.equal(res.admissionId, 'PMOD-2026-0008');
  assert.equal(master.data[5][1], 'Second');
});

test('honeypot submit writes nothing', () => {
  const { master, post, mails } = setup();
  const before = JSON.stringify(master.data);
  assert.equal(post({ action: 'submit', website: 'spam', referral: VALID }).ok, true);
  assert.equal(JSON.stringify(master.data), before);
  assert.equal(mails.length, 0);
});

test('onEdit stamps status time only for the status column', () => {
  const { ctx, post, sheets } = setup();
  post({ action: 'submit', referral: VALID });
  const web = sheets['Web Referrals'];
  web.data[1][11] = 'old';
  ctx.onEdit({ range: web.getRange(2, 11) });
  assert.ok(isDate(web.data[1][11]));
  web.data[1][11] = 'old';
  ctx.onEdit({ range: web.getRange(2, 3) });
  assert.equal(web.data[1][11], 'old');
});
