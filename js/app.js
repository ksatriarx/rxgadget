import { configured, C, getDocs, query, where, limit } from "./fb.js";
import { h } from "./ui.js";
import { S, onAuth, isStaff, render, parseHash, requireLogin, initAuth, logout } from "./core.js";
import "./pages/public.js";
import "./pages/account.js";
import "./pages/store.js";
import "./pages/sell.js";
import "./pages/admin.js";

let unread = 0, menuOpen = false;

function drawHeader() {
  const top = document.getElementById("top");
  const bar = h("div", { class: "bar" },
    h("a", { class: "logo", href: "#/" }, "Rx", h("b", null, "gadget")),
    h("div", { class: "row" },
      S.user ? h("a", { class: "btn sm out", href: "#/notifikasi", "aria-label": "Notifikasi" }, "Notifikasi" + (unread ? " (" + unread + ")" : "")) : null,
      S.user
        ? h("button", { class: "btn sm out", onClick: () => { menuOpen = !menuOpen; drawHeader(); } }, (S.profile?.name || S.user.displayName || "Akun").split(" ")[0] + " ▾")
        : h("button", { class: "btn sm pri", onClick: async () => { await requireLogin(); } }, "Masuk")));
  top.replaceChildren(bar);
  if (menuOpen && S.user) {
    const close = () => { menuOpen = false; drawHeader(); };
    const L = (t, href) => h("a", { href, onClick: close }, t);
    top.append(h("div", { class: "menu" },
      L("Profil & rekening", "#/profil"), L("Pesanan saya", "#/pesanan"), L("Pengajuan jual saya", "#/pengajuan"),
      S.store ? L("Toko saya", "#/toko-saya") : L("Daftar sebagai toko", "#/daftar-toko"),
      S.store ? L("HP masuk (lelang)", "#/lelang") : null,
      isStaff() ? L("Panel " + S.role, "#/admin") : L("Masuk sebagai admin", "#/admin-masuk"),
      h("button", { onClick: () => { close(); logout(); } }, "Keluar")));
  }
}

function drawChips() {
  const { path } = parseHash();
  const items = [["Beranda", "/"], ["Katalog", "/katalog"], ["Jual / Tukar", "/jual"], ["Lelang", "/lelang"]];
  document.getElementById("chips").replaceChildren(...items.map(([t, p]) => h("a", { href: "#" + p, class: path === p || (p !== "/" && path.startsWith(p)) ? "on" : "" }, t)));
}

function drawFooter() {
  document.getElementById("foot").replaceChildren(h("div", null, h("a", { href: "#/syarat" }, "Syarat Layanan"), h("a", { href: "#/privasi" }, "Kebijakan Privasi")), h("div", { style: { marginTop: "6px" } }, "© Rxgadget · Dana transaksi ditahan penengah"));
}

async function loadUnread() {
  unread = 0;
  if (!S.user) return drawHeader();
  try {
    const s = await getDocs(query(C("notifications"), where("toUid", "==", S.user.uid), limit(100)));
    s.forEach((d) => { if (!d.data().read) unread++; });
  } catch { /* abaikan */ }
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
  onAuth(() => { loadUnread(); if (first) { first = false; render(); } else if (location.hash.startsWith("#/")) render(); });
  initAuth();
  window.addEventListener("hashchange", () => { menuOpen = false; drawHeader(); drawChips(); if (S.ready) render(); });
  window.addEventListener("hashchange", () => { if (S.user) loadUnread(); });
}
