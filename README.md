# SHARE Brain Death Referral Portal

Doctors use this page to refer a patient with brain death to SHARE, Southern Philippines Medical Center.
Each referral goes into the `Master 2026` tab of the PMOD Referral Master 2026 Google Sheet.

## Parts

| Part | File | Job |
|---|---|---|
| Landing page | `index.html`, `css/landing.css`, `js/landing.js` | Scroll story: transcription demo, fully utilized donor, referral path |
| Reader page | `read.html`, `js/reader-page.js` | Step 1: paste a referral, the offline reader finds the details |
| Form page | `form.html`, `js/form-page.js` | Step 2: check the details and send the referral |
| Status page | `status.html`, `js/status-page.js` | Step 3: show the status of a reference |
| Shared | `css/styles.css`, `js/common.js` | Theme, server calls, reader-to-form draft, 3D parallax hero |
| Reader | `py/referral_parser.py`, `js/reader.js` | Offline Python that reads a pasted referral |
| Backend | `apps-script/Code.gs` | Writes the sheet row, sends the team email and the thank-you email |
| Settings | `js/config.js` | Apps Script `/exec` address |

## Reader

The reader page keeps what it found in `sessionStorage` for the open browser tab only.
The form page reads that draft and clears it after a successful send.


The reader is hard-coded Python with regular expressions and keyword tables.
It uses no AI model and sends no text over the network.
The browser runs it with Pyodide 0.26.4, which loads one time from the jsDelivr CDN.
The same file runs under plain Python:

```
echo "Pt: Juan Dela Cruz, 45/M, ICU 3" | python py/referral_parser.py
```

## Sheet rules

- The script writes a new row in the first row of `Master 2026` where column `A` is empty.
- The script never writes columns `I`, `J` and `Z`, because they hold formulas.
- The next Admission ID is the highest `PMOD-2026-NNNN` number plus one.
- `Hospital outcome` is set to `Needs review`. Family, DNR and consent are set to `Unknown`.
- Hospital, ventilator status, contact number, the web reference and the pasted text go into `Case notes`.
- The `Web Referrals` tab holds the reference, the doctor and the status.
- Change the status in column `K` of `Web Referrals`. The `Status updated` time fills in by itself.

## Emails

- Team alert to `almanalaysay93@gmail.com` and `share@spmcdvo.net` with every value written to the sheet.
- Thank-you email to the doctor when the doctor gives an email address.
- Emails go out from the account that deploys the script.

## Deploy the backend

1. Sign in to Chrome as `share@spmcdvo.net`.
2. Open the sheet, then open Extensions, Apps Script.
3. Paste `apps-script/Code.gs` into `Code.gs` and save.
4. Turn on "Show appsscript.json" in Project Settings and paste `apps-script/appsscript.json`.
5. In Project Settings, add the script property `SITE_URL` with the public page address.
6. Run `setup` one time and accept the permissions.
7. Deploy, New deployment, Web app, Execute as Me, access Anyone.
8. Put the `/exec` address in `ENDPOINT` in `js/config.js`.

With an empty `ENDPOINT`, the page runs in preview mode and sends nothing.

## Tests

```
python -I -m unittest discover -s tests -p "test_*.py"
node --test tests/code.test.mjs
```
