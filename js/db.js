import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion,
  collection, addDoc, deleteDoc, onSnapshot, query, orderBy, limit,
  serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);

let currentUid = null;

export function ready() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUid = user.uid;
        resolve(user.uid);
      } else {
        signInAnonymously(auth).catch((err) => console.error("Auth error", err));
      }
    });
  });
}

export function getUid() {
  return currentUid;
}

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createFamily(name) {
  const uid = getUid();
  let code, familyRef, snap;
  for (let i = 0; i < 5; i++) {
    code = randomCode();
    familyRef = doc(db, "families", code);
    snap = await getDoc(familyRef);
    if (!snap.exists()) break;
  }
  await setDoc(familyRef, {
    name,
    code,
    memberUids: [uid],
    createdAt: serverTimestamp(),
  });
  return code;
}

export async function joinFamily(code) {
  const uid = getUid();
  const familyRef = doc(db, "families", code.toUpperCase());
  const snap = await getDoc(familyRef);
  if (!snap.exists()) {
    throw new Error("No family found with that code.");
  }
  await updateDoc(familyRef, {
    memberUids: arrayUnion(uid),
  });
  return snap.data();
}

export async function getFamily(code) {
  const familyRef = doc(db, "families", code.toUpperCase());
  const snap = await getDoc(familyRef);
  return snap.exists() ? snap.data() : null;
}

// --- Sleep sessions ---
export function subscribeSleep(code, cb) {
  const q = query(collection(db, "families", code, "sleepSessions"), orderBy("startTime", "desc"), limit(30));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function startSleep(code) {
  await addDoc(collection(db, "families", code, "sleepSessions"), {
    startTime: Timestamp.now(),
    endTime: null,
    loggedBy: getUid(),
  });
}
export async function endSleep(code, sessionId) {
  await updateDoc(doc(db, "families", code, "sleepSessions", sessionId), {
    endTime: Timestamp.now(),
  });
}
export async function deleteSleep(code, sessionId) {
  await deleteDoc(doc(db, "families", code, "sleepSessions", sessionId));
}

// --- Feeds ---
export function subscribeFeeds(code, cb) {
  const q = query(collection(db, "families", code, "feeds"), orderBy("time", "desc"), limit(30));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function addFeed(code, time, amountOz) {
  await addDoc(collection(db, "families", code, "feeds"), {
    time: Timestamp.fromDate(time),
    amountOz,
    loggedBy: getUid(),
  });
}
export async function deleteFeed(code, id) {
  await deleteDoc(doc(db, "families", code, "feeds", id));
}

// --- Solids ---
export function subscribeSolids(code, cb) {
  const q = query(collection(db, "families", code, "solids"), orderBy("time", "desc"), limit(30));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function addSolid(code, time, food) {
  await addDoc(collection(db, "families", code, "solids"), {
    time: Timestamp.fromDate(time),
    food,
    loggedBy: getUid(),
  });
}
export async function deleteSolid(code, id) {
  await deleteDoc(doc(db, "families", code, "solids", id));
}
