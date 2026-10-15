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
