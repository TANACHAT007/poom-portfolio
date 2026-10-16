# Changelog — Portfolio ภูมิ

Dates are Asia/Bangkok. Record: plan, decisions/assumptions, changes, and test results (real output).

## Plan
- Idea: พอร์ตโฟลิโอผลงานแรก: โครงงาน SolarAqua สถานีอากาศ + แกลเลอรี่วิดีโอ/รูปเก็บข้อมูล 3 วัน
- Users / roles: user, admin (UNKNOWN — confirm with the owner)
- Pages: index (landing), auth, dashboard, profile, manage (admin)
- Data: `users/$uid` profile · `items/$uid/$id` sample records (rename to the real domain) · `errors/$uid`

## Decisions & assumptions
- Started from the web-studio template. Firebase project not created yet → runs on local emulators
  (`demo-poom-portfolio`). Deploy only after the owner approves.

## Log
### Scaffolded
- Created from template. Not yet tested in this project — run `npm test`, `npm run test:rules`, and a
  browser check on `?emu=1`, then record the results here.

### Portfolio home (2026-10-15)
- index.html rewritten: hero + day-tabbed gallery + lightbox from assets/media/manifest.json (61 photos, 81 videos from Drive, converted by script: photos 1600px JPG, videos 720p first 20s, no audio; 185 MB total - curate before deploy).
- Verified: headless Edge screenshot of index.html (desktop) renders hero, counters and gallery. Not yet tested: phone width, dark mode, npm test, deploy.

### Public portfolio (2026-10-15)
- No login: auth/dashboard/profile/manage pages removed, nav = สรุปผลงาน / รูปกิจกรรม / คลิป.
- Days swapped (Drive folder 2 shown as day 3, folder 3 as day 2); duplicate uploads dropped; photos and clips separated; finished day-2 clip transcoded to 720p (61 MB).
- index.html = project summary from the live SolarAqua site text; gallery.html = photos + clips. Verified by headless Edge screenshots (desktop). Not tested: phone width, dark mode, deploy.

### Story-first rewrite (2026-10-15)
- index.html reordered: impact hero -> problem (P'Nong, Saraburi) -> before/after -> product v3 -> Day 1/2/3 story -> results (insects, loose wire/solar charge, rust) -> films. Story text is from the owner's own account.
- Day 2 now holds the new v3 install photos (20); Day 3 = repair photos (19); Day 1 = 42. Individual video shots dropped (73 clips removed from site).
- Films: Day 1 explainer built from takes 3066/3071/3040/3050 (113 s, original Thai audio + English WebVTT track, subtitles translated from Whisper transcripts - verify wording); Day 2 = owner's finished 3:36 clip with burned-in English subs.
- Verified (headless Edge, desktop): both videos load, 24 VTT cues parse, no console errors. Not re-tested: mobile/dark after rewrite, deploy.

## 2026-10-16
- Day 1 films re-rendered with a lighter vignette and a bit more saturation; Thai-voice film removed from clips.json (site targets foreign viewers).
- New tab per project: nav is now SolarAqua / SmartLung. Added `smartlung.html` (3 awards, 3D CAD, WICO Seoul photos; iCAN was online) + `assets/smartlung/`.
- Tested: no console errors, no horizontal scroll at 390px, light/dark, all 11 images load.
- Added capstone.html (volunteer project: school survey, LED lights, 100% solar CCTV) + assets/capstone/; nav now SolarAqua / SmartLung / Capstone. Omitted photos with children. Tested: no console errors, no h-scroll at 390px, light/dark.
- Added solaraqua-v1.html (TJWP 2026 top-30, build + booth photos) + assets/v1/; nav: SolarAqua V.3 / V.1 / SmartLung / Capstone. Tested: no console errors, no h-scroll at 390px, light/dark.
- Flexible masonry photo layout (no cropping) on all pages; added problem illustrations (assets/illus/*.svg) + "problem → why we built it" section on SmartLung, Capstone, V.1.
- Research-style structure on V.1/SmartLung/Capstone: Abstract (TH+EN) + objectives, problem, method (solution illustration + system steps), then results/photos.
- Wow pass: hero stat chips (count-up) + floating tilted photo trio, auto-scrolling photo marquee, scroll progress bar, timeline arrows (css/wow.css, js/wow.js) on all 4 project pages. Tested: no console errors, no h-scroll at 390px, light/dark.
- Curated photo layouts: bento grids (b11/b12/b22) with hand-picked photos per day/section instead of auto-picked masonry; hero trio + marquee keep natural aspect ratios; capstone/V.1/SmartLung sections re-laid out.
- Cinematic full-viewport hero (Ken Burns photo slideshow, glass stat chips, scroll cue) + parallax photo bands with giant numbers on all 4 pages; tile hover-zoom and staggered reveal. Tested: no console errors, no h-scroll at 390px, light/dark.
- Day 1 film now uses the real English takes of Poom (IMG_3045 main node, IMG_3055 gateway) instead of AI voice-over; captions re-timed from Whisper (en). Film is 1:56.
