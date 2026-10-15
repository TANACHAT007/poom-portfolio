// ===============================================================
//  Portfolio ภูมิ — Firebase initialization (shared across all pages)
//  Firebase v10 modular SDK from the official CDN (no bundler).
// ===============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  updateProfile, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, connectAuthEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase, ref, set, get, push, update, remove, onValue, query, orderByChild, equalTo,
  serverTimestamp, connectDatabaseEmulator,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ---------------------------------------------------------------
//  PASTE YOUR FIREBASE WEB CONFIG HERE
//  Firebase console → Project settings → General → Your apps → Web app → "Config".
//  Until the "__FIREBASE_…__" placeholders below are replaced, the app runs ONLY against the
//  local emulators (see EMULATOR) — zero setup on localhost.
//  The web apiKey is not a secret (it only identifies the project); security comes from
//  database.rules.json. Never put service-account keys or other secrets in this file.
// ---------------------------------------------------------------
const PROJECT_ID = "guyyapap-lab";

// Where this app's data lives in the Realtime Database.
//   ""            → own Firebase project: data at the database root (like PhysioAI)
//   "apps/<slug>" → shared Firebase project: every app gets its own branch; rules are merged
//                   centrally (web-studio scripts/merge-rules.mjs). Switch modes with web-studio
//                   scripts/firebase-mode.mjs — not by hand-editing only this line.
// Build EVERY database path with p(): ref(db, p(`items/${uid}`)) — never a bare "items/…".
export const APP_ROOT = "apps/poom-portfolio";
export const p = (path = "") => [APP_ROOT, String(path).replace(/^\/+|\/+$/g, "")].filter(Boolean).join("/");

const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  databaseURL: "https://guyyapap-lab-default-rtdb.asia-southeast1.firebasedatabase.app", // copy the exact URL (it includes the region) from the console
  projectId: PROJECT_ID,
  storageBucket: `${PROJECT_ID}.appspot.com`,
  messagingSenderId: "__FIREBASE_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__",
};

// Emulator ports — keep in sync with firebase.json "emulators".
const EMULATOR = { host: "127.0.0.1", auth: 9099, database: 9000 };

export const IS_PLACEHOLDER_CONFIG = firebaseConfig.apiKey.startsWith("__");
const isLocal = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Local testing against the Firebase emulators (never real data): open any page on localhost
// with ?emu=1 once; it sticks for the tab via sessionStorage (?emu=0 turns it off again).
// With the placeholder config there is no real project to talk to, so localhost always uses
// the emulators. Production hosts are never affected.
let USING_EMULATOR = false;
try {
  if (isLocal) {
    const q = new URLSearchParams(location.search).get("emu");
    if (q === "1") sessionStorage.setItem("poom-portfolio-emu", "1");
    if (q === "0") sessionStorage.removeItem("poom-portfolio-emu");
    if (IS_PLACEHOLDER_CONFIG || sessionStorage.getItem("poom-portfolio-emu") === "1") {
      connectAuthEmulator(auth, `http://${EMULATOR.host}:${EMULATOR.auth}`, { disableWarnings: true });
      connectDatabaseEmulator(db, EMULATOR.host, EMULATOR.database);
      USING_EMULATOR = true;
    }
  }
} catch (e) {}
if (IS_PLACEHOLDER_CONFIG && !USING_EMULATOR) {
  console.warn("[poom-portfolio] Firebase config still has placeholders — paste the real config into js/firebase.js.");
}

export {
  app, auth, db, USING_EMULATOR, PROJECT_ID,
  // auth
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  // database
  ref, set, get, push, update, remove, onValue, query, orderByChild, equalTo, serverTimestamp,
};
