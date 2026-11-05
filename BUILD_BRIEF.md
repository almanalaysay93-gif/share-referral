# Build Brief: SHARE Brain Death Referral Portal

Status: draft for user approval.
Date: 2026-11-06.

## Product

Doctors refer patients with suspected or declared brain death to the SHARE team.
The web app writes each referral into the PMOD Referral Master 2026 Google Sheet.
A chatbox reads a pasted free-text referral with an offline Python parser and fills the referral form.
The user or the doctor reviews the filled form and then submits it.

## Backend

- Sheet: PMOD Referral Master 2026. The sheet ID stays out of this repository.
- Target tab: `Master 2026` (gid `229268793`), 26 columns `A` to `Z`, 157 rows on 2026-11-06.
- Admission ID format: `PMOD-2026-0001`. The next ID is the highest number plus one.
- Formula columns `I`, `J` and `Z` are not written by the app.
- The app writes the new row in the first row where column `A` is empty, because formulas can fill rows to 2,000.
- New tab `Web Referrals` holds the web reference, the doctor name, the PRC number, the doctor email, the status and the Admission ID.
- Apps Script web app (Execute as Me, access Anyone) receives the referral as JSON over `text/plain`.

## Columns written in Master 2026

| Col | Header | Source |
|---|---|---|
| A | Admission ID | generated |
| B | Patient name | form |
| C | Hospital record number | form |
| D | Age at referral | form |
| E | Sex | form: Male, Female, Unknown |
| F | ER / hospital admission date | form |
| G | Referral date | submit time, Asia/Manila |
| H | Hospital end date | blank |
| K | Ward / room | form |
| L | Referring staff / doctor | doctor name and PRC number |
| M | GCS at referral | form: 3 to 15 |
| N | Diagnosis | form |
| O | Hospital outcome | `Needs review` |
| P | Brain death declared | form: Yes, No, Unknown |
| Q | Brain death date / time | form |
| R to X | Family, DNR, consent, retrieval fields | `Unknown` or blank, the coordinator fills them |
| Y | Case notes | hospital, ventilator status, contact number, web reference, raw pasted text |

## Surfaces

1. Referral form for doctors: doctor name, PRC number, email and contact number are required.
2. Chatbox in the same page: paste a referral text, the Python parser fills the form fields, and the user confirms.
3. Status check: web reference plus PRC number shows the current status.
4. Emails: the doctor gets a thank-you email with the reference. `almanalaysay93@gmail.com` and `share@spmcdvo.net` get an alert.

## Parser

- Pure hard-coded Python with regular expressions and keyword tables. No AI model and no network call.
- It runs in the browser through Pyodide, and the same file runs under plain `python` for tests.
- Assumption: Pyodide loads once from the jsDelivr CDN (about 10 MB) and the browser caches it.

## Statuses

`Received`, `Under review`, `Coordinator en route`, `Evaluated`, `Not suitable`, `Closed`.
The coordinator changes the status in the `Web Referrals` tab.

## Hosting and look

- Static site on GitHub Pages, the same stack as the SHARE organ donor sign-up page.
- Theme: SHARE green `#008037`, sage `#cdd8be` and white.
- The site is noindex, because it carries patient data.

## Agent activation

| Agent | Role | Decision |
|---|---|---|
| 0 | Orchestrator | active, inline |
| 1 to 4 | Design, tokens, taste, UX states | active, inline |
| 5 | Motion | light: chat message and status transitions only |
| 6 | llms.txt | not applicable: private clinical tool, noindex |
| 7, 8, 10 | Quality gates | active |
| 9 | Copy | active |
| 11, 15 | Research | not applicable: internal tool, the stack copies the user's earlier SHARE apps |
| 12 | Snapshots | active at build end |
| 13 | Monitor | after deployment only |
| 14 | ADK agent | not applicable: the user chose a pure Python parser with no AI |

## Acceptance evidence

- Python parser unit tests pass with sample referrals.
- `Code.gs` tests run in a Node VM against an in-memory sheet.
- Browser checks at 1440 px and 390 px show no overflow and no console errors.
- One live test referral reaches the sheet and both emails arrive, then the user deletes the test row.
