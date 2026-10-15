#!/usr/bin/env node
// Build the Realtime Database rules of the SHARED Firebase project from each app's fragment.
//
// Every web-studio app keeps its own app-relative rules in <app>/database.rules.json
// ({"rules": {"users": …, "items": …}}), written exactly as for an own project. In the shared
// project the app's data lives under apps/<slug>, so this script nests each fragment there and
// rewrites root.child('x…') → root.child('apps/<slug>/x…'). Isolation: nothing is granted at /
// or /apps, and every grant inside apps/<slug> can only look at apps/<slug> — so roles and
// data of one app never open another app's branch.
//
//   node merge-rules.mjs --app <dir> [--app <dir2> …] --out <file>     merge these apps
//   node merge-rules.mjs --root <dir> --project <id> --out <file>       every shared-mode app under <dir>
//   node merge-rules.mjs --root <dir> --project <id> --list             just list them
//   node merge-rules.mjs --guard   (used as a database predeploy hook inside shared-mode apps:
//                                   refuses `firebase deploy` of ONE app's rules, which would wipe
//                                   every other app's rules — deploy via web-studio deploy.ps1)
// Exit 1 with a message on any problem; never writes a partial file.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const all = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const die = (msg) => { console.error("merge-rules: " + msg); process.exit(1); };

if (args.includes("--guard")) {
  die("this app uses the SHARED Firebase project. Deploying its database rules alone would replace "
    + "the rules of every other app. Use: web-studio scripts/deploy.ps1 -Project <dir> -Target firebase "
    + "(merges all apps' rules), or deploy hosting only: firebase deploy --only hosting:<site>.");
}

/** Read an app folder → { dir, slug, projectId, root, rules } (throws on anything odd). */
export function readApp(dir) {
  dir = resolve(dir);
  const fbjs = join(dir, "js", "firebase.js");
  const rulesFile = join(dir, "database.rules.json");
  if (!existsSync(fbjs)) throw new Error(`${dir}: no js/firebase.js`);
  if (!existsSync(rulesFile)) throw new Error(`${dir}: no database.rules.json`);
  const src = readFileSync(fbjs, "utf8");
  const projectId = (src.match(/const PROJECT_ID = "([^"]*)"/) || [])[1];
  const root = (src.match(/export const APP_ROOT = "([^"]*)"/) || [])[1];
  if (projectId === undefined || root === undefined) throw new Error(`${dir}: js/firebase.js has no PROJECT_ID / APP_ROOT`);
  let rules;
  try { rules = JSON.parse(readFileSync(rulesFile, "utf8").replace(/^﻿/, "")); }
  catch (e) { throw new Error(`${rulesFile}: not valid JSON (${e.message})`); }
  if (!rules || typeof rules.rules !== "object") throw new Error(`${rulesFile}: missing top-level "rules" object`);
  return { dir, slug: root.startsWith("apps/") ? root.slice(5) : "", projectId, root, rules: rules.rules };
}

/** Nest one app-relative rules tree under apps/<slug>, rewriting root references. */
export function rewriteFragment(slug, tree, where = []) {
  const out = Array.isArray(tree) ? [] : {};
  for (const [key, val] of Object.entries(tree)) {
    const path = [...where, key];
    if (val && typeof val === "object") { out[key] = rewriteFragment(slug, val, path); continue; }
    if (typeof val !== "string" || !key.startsWith(".") || key === ".indexOn") { out[key] = val; continue; }
    // root may only be used as root.child('<literal path>') — anything else could reach outside the app
    const bad = val.match(/\broot\b(?!\.child\(\s*['"])/);
    if (bad) throw new Error(`apps/${slug}/${where.join("/")}/${key}: "root" must be used as root.child('<literal>') (found: ${val})`);
    // data.parent() chains must not climb above the app branch
    const depth = where.length; // number of path segments between apps/<slug> and this rule
    for (const m of val.matchAll(/(?:(?:\.parent\(\))\s*)+/g)) {
      const ups = (m[0].match(/parent\(\)/g) || []).length;
      if (ups > depth) throw new Error(`apps/${slug}/${where.join("/")}/${key}: .parent() climbs above the app branch (${ups} > ${depth})`);
    }
    out[key] = val.replace(/\broot\.child\(\s*(['"])/g, `root.child($1apps/${slug}/`);
  }
  return out;
}

/** Merge apps → full rules object for the shared project. */
export function mergeApps(apps) {
  const seen = new Set();
  const branches = {};
  for (const a of apps) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(a.slug)) throw new Error(`${a.dir}: APP_ROOT must be "apps/<kebab-slug>" (got "${a.root}") — is this app in shared mode?`);
    if (seen.has(a.slug)) throw new Error(`two apps use the same slug "${a.slug}"`);
    seen.add(a.slug);
    const frag = a.rules;
    if (Object.keys(frag).some((k) => k.startsWith("$"))) throw new Error(`${a.slug}: top-level wildcard keys ($x) are not allowed in an app fragment`);
    branches[a.slug] = rewriteFragment(a.slug, frag);
  }
  // nothing granted at "/" or "/apps": each app's own rules decide inside its branch only
  return { rules: { apps: branches } };
}

/** Shared-mode apps directly under <root> that belong to <projectId>. */
export function discover(root, projectId) {
  const found = [];
  for (const name of readdirSync(root)) {
    if (/^[._]/.test(name)) continue;
    const dir = join(root, name);
    try { if (!statSync(dir).isDirectory()) continue; } catch { continue; }
    if (!existsSync(join(dir, "js", "firebase.js")) || !existsSync(join(dir, "database.rules.json"))) continue;
    let a;
    try { a = readApp(dir); } catch (e) { console.error("skip " + name + ": " + e.message); continue; }
    if (a.root.startsWith("apps/") && a.projectId === projectId) found.push(a);
  }
  return found;
}

// ---- CLI ----
if (process.argv[1] && basename(process.argv[1]) === "merge-rules.mjs") {
  try {
    let apps = all("--app").map(readApp);
    const root = opt("--root");
    if (root) {
      const project = opt("--project");
      if (!project) die("--root needs --project <shared project id>");
      apps = apps.concat(discover(resolve(root), project).filter((d) => !apps.some((a) => a.dir === d.dir)));
    }
    if (!apps.length) die("no apps (use --app <dir> or --root <dir> --project <id>)");
    if (args.includes("--list")) { for (const a of apps) console.log(`${a.slug}\t${a.dir}`); process.exit(0); }
    const merged = mergeApps(apps);
    const out = opt("--out");
    if (!out) die("--out <file> is required");
    writeFileSync(out, JSON.stringify(merged, null, 2) + "\n");
    console.log(`merged ${apps.length} app(s) → ${out}: ${apps.map((a) => a.slug).join(", ")}`);
  } catch (e) { die(e.message); }
}
