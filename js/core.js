import { auth, provider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, D, C, getDoc, getDocs, setDoc, addDoc, query, where, limit, serverTimestamp, Timestamp } from "./fb.js";
import { h, openModal, field, run, toast, isPhone, rp, safeUrl, toMs, phoneSvg, icon, ICON, tone } from "./ui.js";

/* ---------- state ---------- */
export const S = { user: null, profile: null, role: null, store: null, ready: false };
const listeners = [];
export const onAuth = (fn) => listeners.push(fn);
export const isStaff = () => S.role === "owner" || S.role === "admin";
export const isOwner = () => S.role === "owner";
export const storeActive = () => !!(S.store && S.store.status === "approved" && toMs(S.store.subscriptionUntil) > Date.now());

export async function loadUser(u) {
  if (!u) { S.user = null; S.profile = null; S.role = null; S.store = null; }
  else {
    S.user = u;
    const [p, r, s] = await Promise.all([getDoc(D("users", u.uid)), getDoc(D("roles", u.uid)), getDoc(D("stores", u.uid))]);
    S.profile = p.exists() ? p.data() : null;
    S.role = r.exists() ? r.data().role : null;
    S.store = s.exists() ? { id: s.id, ...s.data() } : null;
  }
  S.ready = true;
  listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
}
export function initAuth() {
  getRedirectResult(auth).catch(() => {});
  onAuthStateChanged(auth, (u) => { loadUser(u).catch((e) => { console.error(e); S.ready = true; listeners.forEach((f) => f()); }); });
}
export async function signIn() {
  try {
    const r = await signInWithPopup(auth, provider);
    await loadUser(r.user);
  } catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") await signInWithRedirect(auth, provider);
    else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") throw e;
  }
}
export async function logout() { await signOut(auth); location.hash = "#/"; }

export const profileComplete = () => !!(S.profile && S.profile.phone && S.profile.termsAcceptedAt);

/* ---------- router ---------- */
const routes = [];
export function route(pattern, fn) {
  const keys = [...pattern.matchAll(/:([a-zA-Z]+)/g)].map((m) => m[1]);
  routes.push({ re: new RegExp("^" + pattern.replace(/:([a-zA-Z]+)/g, "([^/]+)") + "$"), keys, fn });
}
export const go = (path) => { location.hash = "#" + path; };
export function parseHash() {
  const raw = location.hash.slice(1) || "/";
  const [path, qs] = raw.split("?");
  return { path, q: Object.fromEntries(new URLSearchParams(qs || "")) };
}
let cleanup = [];
export const onLeave = (fn) => cleanup.push(fn);
export async function render() {
  cleanup.forEach((f) => { try { f(); } catch { /* abaikan */ } });
  cleanup = [];
  const { path, q } = parseHash();
  const app = document.getElementById("app");
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    app.replaceChildren(h("div", { class: "loading" }, "Memuat…"));
    try {
      const node = await r.fn(params, q);
      if (node) app.replaceChildren(node);
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      app.replaceChildren(h("div", { class: "card pad" }, "Terjadi kesalahan: " + (e.message || e)));
    }
    return;
  }
  app.replaceChildren(h("div", { class: "card pad" }, "Halaman tidak ditemukan."));
}

/* ---------- login & kelengkapan data ---------- */
export function loginModal() {
  return new Promise((res) => {
    openModal("Masuk ke Rxgadget", h("div", { class: "col" },
      h("p", { class: "mut" }, "Anda bebas melihat semua HP tanpa login. Login dibutuhkan hanya saat membeli, menjual, atau menawar."),
      h("button", { class: "btn pri full", onClick: async (e) => { await run(e.currentTarget, async () => { await signIn(); if (S.user) { document.querySelector(".ov")?.remove(); } }); } }, "Masuk dengan Google")
    ), null, () => res(!!S.user));
    const t = setInterval(() => { if (S.user || !document.querySelector(".ov")) { clearInterval(t); res(!!S.user); } }, 400);
  });
}
export function profileModal() {
  return new Promise((res) => {
    const name = h("input", { type: "text", value: S.profile?.name || S.user?.displayName || "", autocomplete: "name" });
    const phone = h("input", { type: "tel", value: S.profile?.phone || "", placeholder: "08xxxxxxxxxx", autocomplete: "tel" });
    const agree = h("input", { type: "checkbox" });
    let saved = false;
    openModal("Lengkapi data Anda", h("div", null,
      field("Nama lengkap", name),
      field("Nomor HP / WhatsApp", phone, "Dipakai untuk koordinasi transaksi."),
      h("label", { class: "chk" }, agree, h("span", null, "Saya menyetujui ", h("a", { href: "#/syarat", target: "_blank" }, "Syarat Layanan"), " dan ", h("a", { href: "#/privasi", target: "_blank" }, "Kebijakan Privasi"), " Rxgadget."))
    ), (close) => [
      h("button", { class: "btn pri", onClick: async (e) => {
        if (!name.value.trim()) return toast("Nama wajib diisi", "err");
        if (!isPhone(phone.value)) return toast("Nomor HP tidak valid", "err");
        if (!agree.checked && !S.profile?.termsAcceptedAt) return toast("Centang persetujuan dulu", "err");
        await run(e.currentTarget, async () => {
          const data = { name: name.value.trim(), email: S.user.email || "", phone: phone.value.replace(/[\s-]/g, ""), photo: S.user.photoURL || "", updatedAt: serverTimestamp() };
          if (!S.profile) data.createdAt = serverTimestamp();
          if (!S.profile?.termsAcceptedAt) data.termsAcceptedAt = serverTimestamp();
          await setDoc(D("users", S.user.uid), data, { merge: true });
          await loadUser(S.user);
          saved = true; close();
        });
      } }, "Simpan dan lanjut"),
      h("button", { class: "btn", onClick: () => close() }, "Batal")
    ], () => res(saved));
  });
}
export async function requireLogin() {
  if (!S.user) { await loginModal(); if (!S.user) return false; }
  if (!profileComplete()) return profileModal();
  return true;
}

/* ---------- utilitas data ---------- */
export async function notify(toUid, text, link) {
  if (!toUid || !S.user) return;
  try { await addDoc(C("notifications"), { toUid, fromUid: S.user.uid, text: String(text).slice(0, 190), link: link || "", read: false, createdAt: serverTimestamp() }); } catch { /* notifikasi bersifat opsional */ }
}
export async function audit(action, target, noteText) {
  if (!isStaff()) return;
  try { await addDoc(C("auditLogs"), { by: S.user.uid, byName: S.profile?.name || S.user.email || "", role: S.role, action, target: target || "", note: noteText || "", createdAt: serverTimestamp() }); } catch { /* abaikan */ }
}
export const logEntry = (text) => ({ t: Date.now(), by: S.profile?.name || S.user?.email || "sistem", text });
export const ts = (ms) => Timestamp.fromMillis(ms);

let settingsCache = null;
export async function getSettings(force) {
  if (!settingsCache || force) {
    let d = {};
    try { const s = await getDoc(D("settings", "public")); if (s.exists()) d = s.data(); } catch { /* pakai bawaan */ }
    settingsCache = { qrisImage: "assets/qris.png", rekeningInfo: "", subscriptionPrice: "", subscriptionInfo: "", trialDays: 30, productLimit: 50, adminWa: "", ...d };
  }
  return settingsCache;
}

export async function storeMap(force) {
  if (storeMap.cache && !force) return storeMap.cache;
  const snap = await getDocs(query(C("stores"), where("status", "==", "approved")));
  const m = {};
  snap.forEach((d) => { const s = d.data(); m[d.id] = { id: d.id, ...s, active: toMs(s.subscriptionUntil) > Date.now() }; });
  storeMap.cache = m;
  return m;
}
export async function loadProducts() {
  const [stores, snap] = await Promise.all([storeMap(), getDocs(query(C("products"), where("status", "==", "active"), limit(200)))]);
  const out = [];
  snap.forEach((d) => { const p = { id: d.id, ...d.data() }; if (stores[p.storeId]?.active) out.push(p); });
  out.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  return out;
}
export const sellerInc = (p) => (p < 1000000 ? 5000 : p <= 5000000 ? 10000 : 25000);

export function productCard(p) {
  const thumb = safeUrl(p.photos?.[0]);
  const t = tone(p.grade);
  const spec = [p.storage, p.health?.battery ? p.health.battery + "%" : null].filter(Boolean).join(" · ");
  return h("a", { class: "pc", href: "#/produk/" + p.id },
    h("div", { class: "pc-img", style: thumb ? {} : { background: `radial-gradient(80px 80px at 50% 55%, ${t.glow}, rgba(255,255,255,0) 75%)` } },
      thumb ? h("img", { src: thumb, alt: "", loading: "lazy" }) : phoneSvg(p.grade),
      h("span", { class: "gpill", style: { background: t.tint } }, p.grade || "-"),
      p.reviewedByRx ? h("span", { class: "chk-c", title: "Direview Rxgadget" }, icon(ICON.check, 10, "#08826D", 3)) : null),
    h("div", { class: "pc-b" },
      h("div", { class: "pc-t" }, p.title),
      h("div", { class: "pc-s" }, spec),
      h("div", { class: "pc-p" }, rp(p.price)),
      h("div", { class: "pc-s" }, p.storeName)));
}
