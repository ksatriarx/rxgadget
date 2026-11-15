import { D, C, getDoc, getDocs, setDoc, addDoc, updateDoc, query, limit, writeBatch, db, serverTimestamp } from "../fb.js";
import { h, rp, field, run, toast, confirmBox, kv, note, fmtDate, toMs, safeUrl, statusTag, ORDER_STATUS, SELL_STATUS } from "../ui.js";
import { S, route, go, isStaff, isOwner, requireLogin, notify, audit, getSettings, ts, loadUser } from "../core.js";

const DAY = 86400000;
const list = async (name, n = 200) => { const s = await getDocs(query(C(name), limit(n))); const r = []; s.forEach((d) => r.push({ id: d.id, ...d.data() })); return r; };

/* ---------- Masuk sebagai admin (kode undangan) ---------- */
route("/admin-masuk", async () => {
  if (!S.user) { await requireLogin(); if (!S.user) return h("div", { class: "card pad" }, "Silakan masuk dulu."); }
  if (isStaff()) return h("div", { class: "card pad col" }, h("p", null, "Anda sudah terdaftar sebagai " + S.role + "."), h("a", { class: "btn pri", href: "#/admin" }, "Buka panel"));
  const code = h("input", { type: "text", placeholder: "Kode undangan", autocapitalize: "off" });
  const uname = h("input", { type: "text", placeholder: "Username" });
  return h("div", { class: "col" }, h("h1", null, "Masuk sebagai Admin"), note("Masukkan kode undangan dari owner dan username yang tercantum pada undangan."),
    field("Kode undangan", code), field("Username", uname),
    h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
      const c = code.value.trim(), u = uname.value.trim().toLowerCase();
      if (!c || !u) return toast("Isi kode dan username", "err");
      const inv = await getDoc(D("invites", c));
      if (!inv.exists() || inv.data().used || String(inv.data().username).toLowerCase() !== u) return toast("Kode atau username tidak cocok / sudah dipakai", "err");
      const b = writeBatch(db);
      b.update(D("invites", c), { used: true, usedBy: S.user.uid, usedAt: serverTimestamp() });
      b.set(D("roles", S.user.uid), { role: "admin", username: u, email: S.user.email || "", code: c, createdAt: serverTimestamp() });
      await b.commit(); await loadUser(S.user); toast("Anda sekarang admin"); go("/admin");
    }) }, "Aktifkan"));
});

/* ---------- Panel ---------- */
route("/admin", async (_, q) => {
  if (!isStaff()) return h("div", { class: "card pad" }, "Halaman ini khusus pengelola.");
  const tab = q.tab || "toko";
  const tabsDef = [["toko", "Toko"], ["pesanan", "Pesanan"], ["lelang", "Lelang"], ["langganan", "Langganan"]];
  if (isOwner()) tabsDef.push(["pengaturan", "Pengaturan"], ["admin", "Admin & log"]);
  const body = h("div", { class: "col" });
  const fn = { toko: storesTab, pesanan: ordersTab, lelang: sellTab, langganan: subsTab, pengaturan: settingsTab, admin: adminTab }[tab] || storesTab;
  body.append(await fn());
  return h("div", { class: "col gap" }, h("h1", null, "Panel " + (isOwner() ? "Owner" : "Admin")), h("div", { class: "tabs" }, tabsDef.map(([k, l]) => h("a", { class: "chip" + (tab === k ? " on" : ""), href: "#/admin?tab=" + k }, l))), body);
});

async function storesTab() {
  const rows = (await list("stores")).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const cfg = await getSettings();
  const act = (label, cls, fn) => h("button", { class: "btn sm " + cls, onClick: (e) => run(e.currentTarget, async () => { await fn(); toast("Tersimpan"); location.reload(); }) }, label);
  return h("div", { class: "col" }, rows.length ? rows.map((s) => h("div", { class: "card pad col" },
    h("div", { class: "row sp" }, h("b", null, s.name), h("span", { class: "tag " + (s.status === "approved" ? "ok" : s.status === "suspended" ? "er" : "wr") }, s.status)),
    kv("Kota", s.city), kv("Alamat", s.address || "-"), kv("WhatsApp", s.whatsapp || "-"), kv("Langganan sampai", s.subscriptionUntil ? fmtDate(s.subscriptionUntil) : "-"), kv("Peringatan", s.warnings || 0),
    h("div", { class: "row" },
      s.status !== "approved" ? act("Setujui + trial", "pri", async () => { await updateDoc(D("stores", s.id), { status: "approved", subscriptionUntil: ts(Math.max(toMs(s.subscriptionUntil), Date.now()) + (cfg.trialDays || 30) * DAY), updatedAt: serverTimestamp() }); await audit("setujui_toko", "stores/" + s.id); notify(s.id, "Toko Anda disetujui. Selamat berjualan!", "/toko-saya"); }) : null,
      s.status === "approved" ? act("Suspend", "dng", async () => { await updateDoc(D("stores", s.id), { status: "suspended", updatedAt: serverTimestamp() }); await audit("suspend_toko", "stores/" + s.id); notify(s.id, "Toko Anda disuspend pengelola", "/toko-saya"); }) : null,
      act("Beri peringatan", "am", async () => { await updateDoc(D("stores", s.id), { warnings: (s.warnings || 0) + 1, updatedAt: serverTimestamp() }); await audit("peringatan_toko", "stores/" + s.id); notify(s.id, "Anda menerima peringatan dari pengelola", "/toko-saya"); }),
      h("a", { class: "btn sm out", href: "#/toko/" + s.id }, "Lihat")))) : h("p", { class: "mut" }, "Belum ada toko."));
}

async function ordersTab() {
  const rows = (await list("orders")).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  return h("div", { class: "col" }, rows.length ? rows.map((o) => h("a", { class: "item", href: "#/pesanan/" + o.id }, h("div", null, h("div", { class: "b" }, o.productTitle || o.title || o.id), h("div", { class: "mut xs" }, (o.storeName || "") + " · " + rp(o.price || o.amount))), statusTag(ORDER_STATUS, o.status))) : h("p", { class: "mut" }, "Belum ada pesanan."));
}

async function sellTab() {
  const rows = (await list("sellRequests")).sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
  return h("div", { class: "col" }, rows.length ? rows.map((r) => h("a", { class: "item", href: "#/lelang/" + r.id }, h("div", null, h("div", { class: "b" }, r.title), h("div", { class: "mut xs" }, r.city + " · " + (r.highestBid ? rp(r.highestBid) : "tanpa penawaran"))), statusTag(SELL_STATUS, r.status))) : h("p", { class: "mut" }, "Belum ada pengajuan."));
}

async function subsTab() {
  const rows = (await list("subscriptionRequests")).sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  return h("div", { class: "col" }, rows.length ? rows.map((r) => h("div", { class: "card pad col" },
    h("div", { class: "row sp" }, h("b", null, r.storeName), h("span", { class: "tag " + (r.status === "approved" ? "ok" : r.status === "rejected" ? "er" : "wr") }, r.status)), kv("Dikirim", fmtDate(r.createdAt)),
    safeUrl(r.proofUrl) ? h("a", { href: safeUrl(r.proofUrl), target: "_blank", rel: "noopener" }, h("img", { src: safeUrl(r.proofUrl), alt: "Bukti", style: { maxWidth: "240px", borderRadius: "10px" } })) : null,
    r.status === "pending" ? h("div", { class: "row" },
      h("button", { class: "btn sm pri", onClick: (e) => run(e.currentTarget, async () => {
        const sd = await getDoc(D("stores", r.storeId)); const base = Math.max(toMs(sd.data()?.subscriptionUntil), Date.now());
        const b = writeBatch(db);
        b.update(D("stores", r.storeId), { subscriptionUntil: ts(base + 30 * DAY), updatedAt: serverTimestamp() });
        b.update(D("subscriptionRequests", r.id), { status: "approved", reviewedBy: S.user.uid, updatedAt: serverTimestamp() });
        await b.commit(); await audit("aktifkan_langganan", "stores/" + r.storeId); notify(r.storeId, "Langganan diperpanjang 30 hari", "/toko-saya?tab=langganan"); toast("Diaktifkan"); location.reload();
      }) }, "Aktifkan +30 hari"),
      h("button", { class: "btn sm dng", onClick: (e) => run(e.currentTarget, async () => { await updateDoc(D("subscriptionRequests", r.id), { status: "rejected", reviewedBy: S.user.uid }); await audit("tolak_langganan", "stores/" + r.storeId); notify(r.storeId, "Bukti langganan ditolak, unggah ulang", "/toko-saya?tab=langganan"); location.reload(); }) }, "Tolak")) : null)) : h("p", { class: "mut" }, "Belum ada pengajuan langganan."));
}

async function settingsTab() {
  const c = await getSettings(true);
  const f = { qrisImage: h("input", { type: "text", value: c.qrisImage }), rekeningInfo: h("textarea", null, c.rekeningInfo), subscriptionPrice: h("input", { type: "text", value: c.subscriptionPrice }), subscriptionInfo: h("textarea", null, c.subscriptionInfo), trialDays: h("input", { type: "number", value: c.trialDays }), productLimit: h("input", { type: "number", value: c.productLimit }), adminWa: h("input", { type: "text", value: c.adminWa }) };
  return h("div", { class: "col" }, note("Ganti gambar QRIS dengan mengunggah file assets/qris.png ke repositori GitHub."),
    field("Lokasi gambar QRIS", f.qrisImage), field("Info rekening cadangan", f.rekeningInfo), field("Biaya langganan", f.subscriptionPrice, "Contoh: Rp 100.000 / bulan"), field("Petunjuk langganan", f.subscriptionInfo), field("Hari trial toko baru", f.trialDays), field("Batas produk per toko", f.productLimit), field("WhatsApp pengelola", f.adminWa),
    h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
      await setDoc(D("settings", "public"), { qrisImage: f.qrisImage.value.trim() || "assets/qris.png", rekeningInfo: f.rekeningInfo.value.trim(), subscriptionPrice: f.subscriptionPrice.value.trim(), subscriptionInfo: f.subscriptionInfo.value.trim(), trialDays: Number(f.trialDays.value) || 30, productLimit: Number(f.productLimit.value) || 50, adminWa: f.adminWa.value.trim() });
      await audit("ubah_pengaturan", "settings/public"); await getSettings(true); toast("Pengaturan disimpan");
    }) }, "Simpan"));
}

async function adminTab() {
  const [roles, invites, logs] = await Promise.all([list("roles"), list("invites"), list("auditLogs", 100)]);
  logs.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const uname = h("input", { type: "text", placeholder: "Username admin baru" });
  return h("div", { class: "col gap" },
    h("div", { class: "card pad col" }, h("h3", null, "Undang admin"), field("Username", uname),
      h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
        const u = uname.value.trim().toLowerCase(); if (!/^[a-z0-9_]{3,20}$/.test(u)) return toast("Username 3-20 huruf/angka/_", "err");
        const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        await setDoc(D("invites", code), { role: "admin", username: u, used: false, createdBy: S.user.uid, createdAt: serverTimestamp() });
        await audit("buat_undangan", "invites/" + code, u);
        toast("Kode: " + code); location.reload();
      }) }, "Buat kode undangan")),
    h("div", { class: "card pad col" }, h("h3", null, "Undangan"), invites.length ? invites.map((i) => h("div", { class: "kv" }, h("span", null, i.username + (i.used ? " (terpakai)" : "")), h("code", null, i.id))) : h("p", { class: "mut sm" }, "Belum ada.")),
    h("div", { class: "card pad col" }, h("h3", null, "Staf"), roles.map((r) => h("div", { class: "kv" }, h("span", null, r.username || r.email || r.id), h("span", { class: "tag" }, r.role)))),
    h("div", { class: "card pad col" }, h("h3", null, "Log aktivitas"), logs.length ? logs.slice(0, 60).map((l) => h("div", { class: "mut xs" }, fmtDate(l.createdAt) + " · " + l.byName + " · " + l.action + " · " + l.target)) : h("p", { class: "mut sm" }, "Kosong.")));
}
