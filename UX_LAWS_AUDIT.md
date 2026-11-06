# UX Laws Audit: three-page referral portal

Date: 2026-11-06.
Scope: `index.html` (reader), `form.html` (check and send), `status.html` (status).
Evidence: Chrome at 1440 x 900 and 390 x 844 (mobile, touch), Lighthouse mobile on all three pages, reduced-motion emulation.

| Law | Result | Evidence |
|---|---|---|
| 1 Fitts | Compliant | Every button and nav link is at least 44 px high. The main action on each page is a full-width or large green button. |
| 2 Hick | Compliant | Each page has one job and one main action: Read, Send referral, Check. |
| 3 Jakob | Compliant | The chat looks like Messenger. The step nav uses the common numbered-steps pattern. |
| 4 Miller | Compliant | The form keeps three groups: Patient, Clinical, Referring doctor. |
| 5 Tesler | Compliant | The offline reader does the data entry. The doctor only checks the green fields. |
| 6 Aesthetic-usability | Compliant | SHARE green theme with a 3D organ hero per page. Text stays above the art and readable. |
| 7 Doherty | Partial | The reader and page changes respond at once. A submit or status check waits for Apps Script (about 2 to 6 s). A spinner and "Sending" or "Checking" text cover the wait. The server time is outside the page's control. |
| 8 Peak-end | Compliant | The thank-you screen names the doctor, shows the reference with a Copy button, and links to the status page. |
| 9 Serial position | Compliant | Step 1 Read is first in the nav. The send button is last in the form. |
| 10 Von Restorff | Compliant | The current step is the only filled green pill. Reader-filled fields are green. Missing required fields are red chips. |
| 11 Pareto | Compliant | Only three fields are required. The rest are optional. |
| 12 Occam | Compliant | No accounts, no sign-in, no extra steps. |
| 13 Postel | Compliant | The reader accepts free text, military time and several date formats. Old `#status?ref=` email links redirect to the status page. |
| 14 Zeigarnik | Compliant | The step nav shows progress 1 to 3. The reader keeps its draft in the browser tab when the doctor goes back. |

## Fixes made during the audit

1. On phones the brand text collided with the step nav. The brand text is now hidden below 720 px and the logos stay.
2. On phones the hero art was taller than its stage. The organ, ring and leaves now scale down below 720 px.
3. The status steps showed a box inside a box. The inner border was removed.
4. The leaf images had hard square edges. A radial mask now softens them.
5. The reader summary showed ISO dates. It now shows dates such as "5 Nov 2026, 3:40 pm".

## Other checks

- Lighthouse mobile: accessibility 100 and best practices 100 on all three pages. SEO 63 is the intended `noindex` tag.
- No console errors or warnings.
- Horizontal overflow: none at 390 px and 1440 px.
- Scroll parallax moves the hero layers forward and back with the scroll position.
- With reduced motion, the hero is static and the copy stays fully visible.
