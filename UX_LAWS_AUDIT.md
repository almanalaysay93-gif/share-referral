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
| 6 Aesthetic-usability | Compliant | SHARE green theme with a 3D organ hero per page: heartbeat line, orbit dots and glass chips that state facts about the step. Text stays above the art and readable. |
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
4. On 2026-11-06 the leaves were replaced by a heartbeat line, orbit dots and glass chips. Chip text states facts only, never a fake status. On phones only one chip and the pulse stay.
5. The reader summary showed ISO dates. It now shows dates such as "5 Nov 2026, 3:40 pm".

## Other checks

- Lighthouse mobile: accessibility 100 and best practices 100 on all three pages. SEO 63 is the intended `noindex` tag.
- No console errors or warnings.
- Horizontal overflow: none at 390 px and 1440 px.
- Scroll parallax moves the hero layers forward and back with the scroll position.
- With reduced motion, the hero is static and the copy stays fully visible.

## Change on 2026-11-06: motivational chips and Anime.js titles

- The hero chips now show donation facts: "1 donor can save up to 8 lives", "Tissue can help 75+ more", and organ-specific diseases (heart failure, kidney disease and dialysis, liver failure, cirrhosis, biliary atresia).
- The figures come from the general public figures on organdonor.gov (HRSA). They have no SHARE clinical sign-off.
- `js/motion.js` uses Anime.js 4.5.0 (MIT, self-hosted in `js/vendor/`) to split each page title into characters, reveal them, and run a slow green colour wave. It also fades in the chips and counts up the numbers.
- Screen readers get the full title from the hidden accessible copy that `splitText` adds.
- With reduced motion, `js/motion.js` does nothing, and the title, chips and numbers stay static.
- Lighthouse mobile accessibility stayed at 100 on the reader page. No console errors. No overflow at 390 px.

## Change on 2026-11-06: clay panels and button press

The reader page, the form page, and the status page keep the same layout.
Each panel is a matte clay slab with an outer shadow and a light inner rim.
Field groups, the found-field list, the reference box, and the status steps sit in inset trays.
An empty found-field list stays plain text.
Primary buttons, the send button, and ghost buttons use the same clay and a solid lip shadow.
Anime.js moves a pressed button down by 4 px in 90 ms.
The button returns in 220 ms.
CSS owns the shadow.
Reduced motion keeps the clay and skips the press.
The hero, the type, and the SHARE green stay the same.

| Law | Result | Evidence |
|---|---|---|
| 1 Fitts | Compliant | Visible buttons measured at least 44 px high at 1440 px and 390 px. |
| 2 Hick | Compliant | Each page still has one job and one main action. |
| 3 Jakob | Compliant | The chat, the step nav, and the form layout stay the same. |
| 4 Miller | Compliant | The form still has three groups. |
| 5 Tesler | Compliant | The reader still fills the form. |
| 6 Aesthetic-usability | Compliant | Clay uses the SHARE green. White text on the button face is at least 5.07 to 1. |
| 7 Doherty | Partial | The press returns in 220 ms. A send or a status check still waits on Apps Script. |
| 8 Peak-end | Compliant | The thank-you screen content did not change. |
| 9 Serial position | Compliant | Read stays first. Send stays at the end of the form. |
| 10 Von Restorff | Compliant | The primary button stays green. The ghost button stays light. |
| 11 Pareto | Compliant | Three fields stay required. |
| 12 Occam | Compliant | No new step was added. |
| 13 Postel | Compliant | The reader rules and the old status links did not change. |
| 14 Zeigarnik | Compliant | The step nav still shows progress from 1 to 3. |

## Checks for the clay change

Headless Chromium loaded the local pages on 2026-11-06.
The pages requested `styles.css?v=9` and `motion.js?v=3`.
Horizontal overflow was 0 at 1440 x 900 and at 390 x 844 on all three pages.
A send button, a ghost button, and the main form link moved to 4 px and then returned to 0.
A second press during the return still ended at 0.
With reduced motion, the press left the transform at none.
The first Tab stop showed a 3 px green outline.
No page exception was recorded.
The ui-ux-pro-max search was not run.
The web animation skill pack was not installed.
Chrome DevTools could not open its locked profile, so these checks used headless Chromium.
The live GitHub Pages site was not updated.

## Change on 2026-11-06: landing page

The main address now opens a landing page.
The reader moved to `read.html`.
Old `#status?ref=` links on the main address still open the status page.

The landing page has five parts:

1. A hero with the 3D heart, "One referral can save up to eight lives", and the Refer and Check buttons.
2. A pinned transcription demo, where a de-identified referral types in and eight form fields fill as the page scrolls.
3. A pinned donor body map, where nine organ and tissue tiles light in turn, with the counts climbing to 8 lives and 75+ people.
4. Four steps from referral to recipients.
5. A final call to action.

`js/landing.js` owns one scroll loop for both pinned sections.
Anime.js tweens the counts and reveals the four steps.
Below 1000 px wide, below 700 px high, with reduced motion, or without JavaScript, the sections are not pinned and show their finished state.

| Law | Result | Evidence |
|---|---|---|
| 1 Fitts | Compliant | Refer a patient is a large green button in the hero and at the end. |
| 2 Hick | Compliant | Two actions only: Refer a patient and Check a referral. |
| 3 Jakob | Compliant | Normal landing order: hero, feature, benefit, steps, call to action. |
| 4 Miller | Compliant | Three facts in the demo, four steps, nine tiles in three groups of three on phones. |
| 5 Tesler | Compliant | The demo shows the reader doing the typing. |
| 6 Aesthetic-usability | Compliant | Same SHARE green, clay panels and organ art as the app. |
| 7 Doherty | Compliant | Scroll updates run in one animation frame. Count tweens take 420 ms. |
| 8 Peak-end | Compliant | The page ends on "It starts with your referral" with the Refer button. |
| 9 Serial position | Compliant | The main action is first in the hero and last on the page. |
| 10 Von Restorff | Compliant | Organ tiles light in green, tissue tiles in gold. |
| 11 Pareto | Compliant | The demo shows the fields that matter most to the coordinator. |
| 12 Occam | Compliant | No new form or account. The landing only links into the existing three steps. |
| 13 Postel | Compliant | Old links still work. The page works without JavaScript. |
| 14 Zeigarnik | Compliant | The counters and the field count show progress while scrolling. |

## Checks for the landing page

- Chrome at 1440 x 900: the demo had 132, 321 and 321 characters typed and 0, 3 and 8 fields filled at 25, 60 and 95 percent of its scroll.
- The donor map had 2, 5 and 9 tiles lit and showed 3, 7 and 8 lives and 0, 0 and 75 tissue at 20, 50 and 95 percent.
- At 390 x 844 the sections were not pinned, all tiles and fields showed, and horizontal overflow was 0.
- With reduced motion the sections were not pinned and showed their finished state.
- Lighthouse mobile on the landing page: accessibility 100 after the GI badge colour fix, best practices 100.
- `read.html` read the sample and showed 15 found fields, and its Continue link goes to `form.html`.
- No console errors or warnings.
- The figures 8 and 75+ come from organdonor.gov and have no SHARE clinical sign-off.

## Change on 2026-11-06: flowing ribbon and landing title

- `js/ribbon.js` draws one fixed SVG ribbon behind every page: a wide sage band, a green band and a thin deep-green thread.
- The ribbon waves over time, travels from the top left to the bottom right as the page scrolls, and draws further along as the doctor scrolls the landing page.
- On the landing page it lifts with the transcription demo and widens its waves with the donor body map, through `window.SHARE_STORY` from `js/landing.js`.
- The wave phase is kept in `sessionStorage`, so the ribbon continues where it was on the next page.
- On the Read, Send and Status pages the ribbon is at 45 percent opacity behind the panels, so the form stays easy to read.
- The landing title uses Anime.js 4.5.0 `splitText`, `createTimeline` and `spring`: the words rise and unblur with a stagger, a green underline draws under "eight lives", "eight" beats twice, and a slow green colour sheen repeats every few seconds.
- Reduced motion: the ribbon stays still, the title is not split, and the underline shows in full.

Checks:

- Chrome at 1440 x 900: the underline offset went from 1 to 0 between 1.5 s and 2.6 s, "eight" reached scale 1.05, and the ribbon centre moved from y 82 to y 453 at the donor section.
- The page ran at about 100 frames per second on this PC during a 2-second count. This is not a phone measurement.
- At 390 x 844 there was no horizontal overflow.
- Lighthouse mobile on the landing page: accessibility 100, best practices 100.
- No console errors or warnings.

## Change on 2026-11-06: ribbon flows down the landing page

- On the landing page the ribbon is one long SVG ribbon that runs down the whole document, from behind the hero heart to the final call to action.
- Scrolling draws it downward. Its tip leads at 70 percent of the screen height, and a glowing green head dot marks the tip.
- The three strands sway together as one ribbon and ripple a little on their own. The donor map widens the sway.
- The Read, Send and Status pages keep the faint fixed ribbon.
- Reduced motion: the whole ribbon shows, still, with no head dot.

Checks:

- Chrome at 1440 x 900: the drawn length was 9, 36, 62 and 93 percent at 0, 30, 60 and 95 percent of the page scroll, and the head dot sat 10 to 16 px above the target tip line each time.
- About 101 frames per second, slowest frame 10 ms, on this PC.
- At 390 x 844 with the CPU slowed 4 times: about 88 frames per second, slowest frame 20 ms, and no horizontal overflow.
- No console errors or warnings.

## Change on 2026-11-06: braided ribbons, particles and section titles

- The landing ribbon is now two braided ribbons with seven strands. One ribbon sways left while the other sways right, so they cross on the way down.
- 26 glowing particles stream down the drawn part of the ribbons and fade at both ends.
- Each landing section heading (transcription, donor, how it works, final call) animates with Anime.js when it scrolls into view: the kicker settles from wide letter spacing, the letters rise on a spring with a stagger, then a green sheen runs once through the words.
- Reduced motion: headings are not split or hidden, particles and the head dot are hidden, and the ribbons show still and in full.

Checks:

- Chrome at 1440 x 900: 7 strands and 26 particles rendered, all particles visible on the drawn part, and the demo heading went from opacity 0 to 1 within 1.8 s of scrolling in.
- About 100 frames per second, slowest frame 20 ms, on this PC.
- At 390 x 844 with the CPU slowed 4 times: about 49 frames per second, slowest frame 30 ms, no horizontal overflow.
- No console errors or warnings.

## Change on 2026-11-06: buttons without white, click burst and chime

- Primary and send buttons are solid SHARE green with no white top highlight.
- Ghost buttons are sage clay (#dde8d2) with dark green text, no white face.
- `js/clickfx.js` adds a burst of 14 green and sage particles and a ring at the click point on every button and step link, animated with Anime.js.
- A soft two-note chime plays on click. It is generated with Web Audio in code, with no sound file, at a low volume.
- Links wait 170 ms before they open so the burst and chime can play. Form buttons do not wait.
- Keyboard clicks burst from the button centre.
- Reduced motion: no burst. The chime still plays.

Checks:

- Chrome at 1440 x 900: a click on Check a referral made a burst with 15 elements, the page stayed for 120 ms, then opened `status.html`.
- Burst particles moved about 45 px out and shrank to scale 0.04 within 450 ms, then the burst element was removed.
- Lighthouse mobile on `read.html`: accessibility 100, best practices 100.
- No console errors or warnings.
- The chime was not heard in this test, because the browser test has no sound output.

## Change on 2026-11-06: burst on every button, more particles

- The click burst now runs on every button, every button-styled link, the step links, the logo link and the Yes / No / Unknown choices.
- Each burst has 32 particles in two shells (a fast inner shell and a slower outer shell), green and sage dots plus small dark-green sparks, and two rings.
- A label click also fires a click on its radio, so the effect is guarded to play once per click.
- Check: a click on a Brain death choice made 1 burst with 34 pieces and still selected the radio. No console errors.

## Change on 2026-11-06: update a referral (step 4)

- New page `update.html`, linked as step 4 in the step nav, from the landing hero and from every status result.
- Step 1 finds referrals by reference, PRC number or email. Only reference, hospital, date and status are shown.
- Step 2 accepts a pasted update, which the offline reader turns into fields, or manual choices: brain death and time, GCS, ventilator, ward, patient expired and time of death, family opted for DNR, and a note.
- Risk accepted by the user: anyone who knows a doctor's PRC number or email can send an update for that doctor's referrals. Every update is logged and emailed to the team with old and new values, and no patient details are shown.

Checks:

- 16 Code.gs tests pass, including find, update and refusal tests. A mutation that skipped the identity check and one that wrote DNR to the wrong column were both caught.
- 20 reader tests pass, including expired, time of death, DNR and "not for DNR".
- Preview-mode browser run: the `?ref=` link found the referral, a pasted update filled brain death, time, GCS, ventilator, expired, time of death and DNR, and the update was sent.
- At 390 x 844 the four-step nav fits with no horizontal overflow. Lighthouse mobile accessibility 100. No console errors.
- The live Apps Script still runs the old code and answers "Unknown action." until it is redeployed.

## Change on 2026-11-06: hero organ morph

- The landing hero organ now cycles heart, lungs, liver, kidneys, pancreas and corneas.
- Each change is a liquid morph: an SVG turbulence displacement filter swells to about 60 and settles to 0 (Anime.js tweens its scale) while the old organ shrinks and fades and the new organ grows in on a spring.
- The first chip names the organ and the disease it treats, and changes with the organ.
- The loop pauses while the hero is off screen or the tab is hidden. With reduced motion the heart stays still.
- Check: in Chrome over 10.5 s the sequence ran heart, lungs, liver, kidneys, the distortion peaked at 61.9, and the chip read "2 kidneys: free 2 people from dialysis". No console errors.

## Change on 2026-11-06: bigger animated header brand

- The SPMC logo now comes first and the SHARE logo second on every page.
- Desktop: logos 56 px high, "SHARE" 28 px, subtitle 0.92 rem, header 84 px. Phones keep 44 px logos and a 68 px header so the four-step nav still fits.
- The header height is one CSS variable (`--topbar-h`), used by the scroll padding, the sticky reader panel and the pinned landing sections; `js/landing.js` reads the real header height.
- Anime.js intro, once per browser tab: the SPMC logo then the SHARE logo spring in from 30 percent scale with a small turn, the SHARE letters rise, and the subtitle slides in. Every 9 s the SHARE logo beats twice. Hovering the brand tilts both logos.
- Reduced motion: no intro, no heartbeat, no tilt.
- Checks: Chrome at 1440 x 900 showed SPMC then SHARE at 56 px, the logos settled to scale 1 by 1.5 s, no console errors. At 390 x 844 the logos were 44 px, the brand ended at 105 px and the nav started at 133 px, no horizontal overflow.

## Change on 2026-11-06: upload files and speak on the Read page

- "Try a sample" is removed.
- "Upload file" reads Word (.docx), Excel (.xlsx), CSV and text files with the Python reader in the browser (standard library `zipfile`, `xml.etree` and `csv` in Pyodide). The file is not uploaded. A two-column table becomes "Label: value" lines, and a header row over data rows becomes "Header: value" lines. Old .doc and .xls files, PDFs and broken files get a clear message.
- "Speak" uses the browser speech service (SpeechRecognition, `en-PH`, continuous with live text) and fills the paste box. A notice says the voice goes to the browser's speech service (Google in Chrome, Apple in Safari). The button is hidden where the browser has no speech service, for example Brave.
- User decision: browser speech, not on-device Whisper, for voice. Uploaded audio files are not possible with browser speech and are not built.
- The landing fact now says pasted text and files are read offline and voice uses the browser speech service.

Checks:

- 25 reader tests pass, including Word label tables, Excel label columns, Excel header rows, CSV, text and refused formats. Two mutations were caught.
- In Chrome, uploading a test .docx filled 9 details: name, age, sex, hospital, ward, GCS, ventilator, doctor and brainstem notes. No console errors.
- The Speak button showed in Chrome. Speech itself was not tested, because the test browser has no microphone.

## Change on 2026-11-06: Speak fixes

- Typed edits during dictation are kept. Before, each speech update rebuilt the box and erased them.
- Listening restarts when Chrome ends a session after a pause, until the doctor taps Stop. Before, the page stopped and the doctor had to tap again.
- Checked in Chrome with a stand-in speech engine: typed text survived, a restart kept the button live, and later speech was added after the typed text.
- Not checked: real speech accuracy, which needs a microphone and Chrome on the phone.

## Change on 2026-11-06: Speak repeats

- The text is now rebuilt from all results in the current session, not from a saved position. Unfinished words are removed from the box before a restart.
- Not reproduced: a single spoken "hello" repeating. The stand-in engine repeats a word only when the test asks it to, so the real cause is not confirmed. Needs a test on the phone.

## Change on 2026-11-06: Speak growing repeats

- Chrome resends speech as growing phrases ("hello", "hello doctors", ...) and repeated words ("possible possible"). A longer copy now replaces the shorter one, an exact repeat is dropped, and a new session drops a repeat of the previous session's last phrase.
- Checked in Chrome with a stand-in engine: the growing sequence ended as "hello doctors referring patient maria santos", and a repeated phrase after a restart was dropped.
- Trade-off: a doctor who truly says a word twice in a row, such as "no no", may get it once. Check the text before pressing Read.
- Not checked on a real phone.

## Change on 2026-11-09: new colour scheme

- Palette: deep blue #00211E for text, headings, buttons and structure. Bubblegum pink #FB039E for accents, ribbons, dots, underlines and focus glows. Blush peach #FD91CC and pink tints for soft surfaces and sage areas.
- Primary buttons are deep blue with white text (contrast well above 4.5:1). Light buttons are blush pink with deep blue text.
- The organ artwork (PNG images) keeps its green. It is a picture, not a colour token. Recolouring it needs a separate decision.
- Checks: hero renders in the new palette, primary button computes to rgb(0, 33, 30), no horizontal overflow at 1440 px.

## Change on 2026-11-09: all green replaced

- Organ art (heart, lungs, liver, kidneys, pancreas, corneas, skin, bones) and the ribbon background images are recoloured to a deep blue ramp from #001226 to #26689F. Alpha is kept, so the cut-out edges stay as they were.
- Ribbons, glows, dots, sparks, underlines and the colour wave in the title use bubblegum pink #FB039E or blush peach #FD91CC.
- Shadows and lips use deep blue or pink tints. No green colour remains in the CSS or JS (checked by scan).
- Chrome caches the old images under the same file names. A hard reload (Ctrl + Shift + R) shows the blue organs.

## Change on 2026-11-09: gold glow to pink, intestine art

- Gold glows and tile borders (landing body map and the waiting-status dot) are now bubblegum pink.
- The intestine tile uses a new deep blue line drawing, `assets/art/intestine.svg`, in place of the GI placeholder. It is a simple drawn illustration, not a medical reference image. Replace it with a licensed anatomical image if you have one.
- Warning text and the demo-mode banner keep their yellow-brown, because they are warnings, not decoration.

## Change on 2026-11-09: intestine engraving

- Replaced the simple SVG with an engraving-style intestine (`assets/art/intestine.webp`, 560 x 560, transparent). It uses the same deep blue ink as the other organ art.
- Drawn in code (Python imaging). The `/hyperframes` skill is built for video, so it was not used to draw the still image. A medical or licensed anatomy image would still be better for a clinical audience.

## Change on 2026-11-09: intestine from the reference photo (first pass)

- Source reference: `D:\Downloads\small_intestine_2.jpg` (stomach, duodenal loop, coiled small bowel).
- Built as a procedural Three.js model (`tools/intestine/render.html`): a tube along a control path with haustral-style radius variation, a stomach pouch, and deep blue material. Rendered in headless Chrome at 1120 px and saved to `assets/art/intestine.png` and `.webp` (560 px).
- Not done: the full img2threejs staged gates (state init, sculpt spec, pass reviews, comparison sheets). This is a first pass.
- Known defects: small flaps where the tube bends, and no haustral folds. Next pass: fix the frame twist at bends, and add folds and the duodenum's C-curve.
