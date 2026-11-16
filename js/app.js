import { configured, C, getDocs, query, where, limit } from "./fb.js";
import { h, svg } from "./ui.js";
import { S, onAuth, isStaff, render, parseHash, requireLogin, initAuth, logout } from "./core.js";
import "./pages/public.js";
import "./pages/account.js";
import "./pages/store.js";
import "./pages/sell.js";
import "./pages/admin.js";

let unread = 0, pendingStores = 0, menuOpen = false;

const R_LOGO = '<svg width="22" height="22" viewBox="0 0 30 30" aria-hidden="true"><rect x="1" y="1" width="28" height="28" rx="8" fill="none" stroke="#08826D" stroke-width="2"/><path d="M9 21V9h6a3.5 3.5 0 0 1 0 7H9m6 0 5 5" fill="none" stroke="#08826D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const BELL = "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.9 1.9 0 0 0 3.4 0";

function drawHeader() {
  const top = document.getElementById("top");
  const initial = ((S.profile?.name || S.user?.displayName || "A").trim()[0] || "A").toUpperCase();
  const bar = h("div", { class: "bar" },
    h("a", { class: "logo", href: "#/" }, svg(R_LOGO), h("span", null, h("span", { class: "ac" }, "Rx"), "gadget")),
    h("div", { class: "row", style: { gap: "6px", flexWrap: "nowrap" } },
      S.store?.status === "pending" ? h("a", { class: "stpill", href: "#/toko-saya" }, "Menunggu persetujuan") : null,
      isStaff() && pendingStores ? h("a", { class: "stpill", href: "#/admin" }, pendingStores + " toko menunggu") : null,
      S.user ? h("a", { class: "ibtn", href: "#/notifikasi", "aria-label": "Notifikasi" }, svg('<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="' + BELL + '" fill="none" stroke="#1F2430" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'), unread ? h("span", { class: "dot" }, String(unread)) : null) : null,
      S.user
        ? h("button", { class: "avt", "aria-label": "Menu akun", onClick: () => { menuOpen = !menuOpen; drawHeader(); } }, initial)
        : [h("button", { class: "btn sm out", onClick: async () => { await requireLogin(); } }, "Masuk"), h("a", { class: "btn sm pri", href: "#/daftar-toko" }, "Daftar Toko")]));
  top.replaceChildren(bar);
  if (menuOpen && S.user) {
    const close = () => { menuOpen = false; drawHeader(); };
    const L = (t, href) => h("a", { href, onClick: close }, t);
    top.append(h("div", { class: "menu" },
      h("div", { class: "mut xs", style: { padding: "6px 12px" } }, S.profile?.name || S.user.email || ""),
      L("Profil & rekening", "#/profil"), L("Pesanan saya", "#/pesanan"), L("Pengajuan jual saya", "#/pengajuan"),
      S.store ? L(S.store.status === "pending" ? "Toko saya (menunggu persetujuan)" : "Toko saya", "#/toko-saya") : L("Daftar sebagai toko", "#/daftar-toko"),
      S.store ? L("HP masuk (lelang)", "#/lelang") : null,
      isStaff() ? L("Panel " + S.role + (pendingStores ? " (" + pendingStores + " toko menunggu)" : ""), "#/admin") : L("Masuk sebagai admin", "#/admin-masuk"),
      h("button", { onClick: () => { close(); logout(); } }, "Keluar")));
  }
}

function drawChips() {
  const { path } = parseHash();
  const toReview = () => setTimeout(() => document.getElementById("review")?.scrollIntoView({ behavior: "smooth" }), 250);
  const items = [["Beranda", "/", "#/"], ["Beli HP", "/katalog", "#/katalog"], ["Jual / Tukar", "/jual", "#/jual"], ["Lelang", "/lelang", "#/lelang"], ["Review", null, "#/", toReview], [S.store ? "Toko saya" : "Untuk Toko", S.store ? "/toko-saya" : "/daftar-toko", S.store ? "#/toko-saya" : "#/daftar-toko"]];
  const on = (p) => p && (p === "/" ? path === "/" : path.startsWith(p));
  document.getElementById("chips").replaceChildren(h("div", { class: "nl" }, items.map(([t, p, href, fn]) => h("a", { href, class: on(p) ? "on" : "", onClick: fn }, t))));
}

function drawFooter() {
  document.getElementById("foot").replaceChildren(h("div", { class: "fwrap" }, h("span", null, "Rxgadget · HP second yang jelas kondisinya"), h("span", { class: "flinks" }, h("a", { href: "#/syarat" }, "Syarat"), h("a", { href: "#/privasi" }, "Privasi"))));
}

async function loadUnread() {
  unread = 0;
  if (!S.user) return drawHeader();
  try {
    const s = await getDocs(query(C("notifications"), where("toUid", "==", S.user.uid), limit(100)));
    s.forEach((d) => { if (!d.data().read) unread++; });
  } catch { /* abaikan */ }
  pendingStores = 0;
  if (isStaff()) { try { const ps = await getDocs(query(C("stores"), where("status", "==", "pending"), limit(50))); pendingStores = ps.size; } catch { /* abaikan */ } }
  drawHeader();
}

function configWarning() {
  const app = document.getElementById("app");
  app.replaceChildren(h("div", { class: "card pad col" }, h("h2", null, "Firebase belum dihubungkan"),
    h("p", null, "Buka berkas firebase-config.js di repositori GitHub, ganti semua tulisan \"ISI\" dengan data dari Firebase (Project settings > Your apps > Web app). Lalu muat ulang halaman ini."),
    h("p", { class: "mut sm" }, "Langkah lengkap ada di README.md.")));
}

drawHeader(); drawChips(); drawFooter();
if (!configured) { configWarning(); }
else {
  let first = true;
  onAuth(() => { drawChips(); loadUnread(); if (first) { first = false; render(); } else if (location.hash.startsWith("#/")) render(); });
  initAuth();
  window.addEventListener("hashchange", () => { menuOpen = false; drawHeader(); drawChips(); if (S.ready) render(); });
  window.addEventListener("hashchange", () => { if (S.user) loadUnread(); });
}
