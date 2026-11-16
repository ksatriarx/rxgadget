import { auth, uploadBlob } from "./fb.js";

/* ---------- DOM helper (tanpa innerHTML supaya aman dari XSS) ---------- */
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "value") e.value = v;
      else if (k === "checked") e.checked = !!v;
      else if (v === true) e.setAttribute(k, "");
      else e.setAttribute(k, String(v));
    }
  }
  add(e, kids);
  return e;
}
function add(e, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}
export const $ = (s, r = document) => r.querySelector(s);

/* ---------- format ---------- */
export const rp = (n) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(Number(n) || 0));
export function toMs(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}
export function fmtDate(ts) {
  const ms = toMs(ts);
  if (!ms) return "-";
  return new Date(ms).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}
export function timeLeft(ts) {
  const d = toMs(ts) - Date.now();
  if (d <= 0) return "Selesai";
  const s = Math.floor(d / 1000), dd = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  if (dd > 0) return `${dd}h ${hh}j ${mm}m`;
  return [hh, mm, ss].map((x) => String(x).padStart(2, "0")).join(":");
}
export function safeUrl(u) {
  try {
    const x = new URL(String(u));
    return x.protocol === "https:" || x.protocol === "http:" ? x.href : "";
  } catch { return ""; }
}
export function videoOk(u) {
  const s = safeUrl(u);
  if (!s) return false;
  const host = new URL(s).hostname.replace(/^www\./, "");
  return /(^|\.)(youtube\.com|youtu\.be|tiktok\.com)$/.test(host);
}
export function waLink(num, text) {
  let n = String(num || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = "62" + n.slice(1);
  return "https://wa.me/" + n + (text ? "?text=" + encodeURIComponent(text) : "");
}
export const esc = (s) => String(s ?? "");
export function isPhone(s) { return /^(\+62|62|0)8\d{7,12}$/.test(String(s).replace(/[\s-]/g, "")); }

/* ---------- toast & modal ---------- */
export function toast(msg, type) {
  const box = document.getElementById("toasts");
  const t = h("div", { class: "toast" + (type === "err" ? " err" : "") }, msg);
  box.append(t);
  setTimeout(() => t.remove(), 4200);
}
export function errMsg(e) {
  const c = e && (e.code || e.message || "");
  if (String(c).includes("permission-denied")) return "Aksi ditolak oleh sistem. Muat ulang halaman lalu coba lagi.";
  if (String(c).includes("unavailable") || String(c).includes("network")) return "Koneksi bermasalah. Coba lagi.";
  if (String(c).includes("quota") || String(c).includes("resource-exhausted")) return "Kuota layanan gratis hari ini habis. Coba lagi besok.";
  return (e && e.message) || "Terjadi kesalahan.";
}
export async function run(btn, fn) {
  if (btn) btn.disabled = true;
  try { await fn(); } catch (e) { console.error(e); toast(errMsg(e), "err"); }
  finally { if (btn) btn.disabled = false; }
}
export function openModal(title, body, actions, onClose) {
  const ov = h("div", { class: "ov", role: "dialog", "aria-modal": "true" });
  const close = () => { if (ov.isConnected) { ov.remove(); if (onClose) onClose(); } };
  const md = h("div", { class: "md" }, h("div", { class: "row sp" }, h("h2", null, title), h("button", { class: "ib", onClick: close, "aria-label": "Tutup" }, "Tutup")), body, actions ? h("div", { class: "row", style: { marginTop: "12px" } }, actions(close)) : null);
  ov.append(md);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  document.body.append(ov);
  return close;
}
export function confirmBox(msg, okText = "Ya, lanjut") {
  return new Promise((res) => {
    let val = false;
    openModal("Konfirmasi", h("p", null, msg), (c) => [
      h("button", { class: "btn pri", onClick: () => { val = true; c(); } }, okText),
      h("button", { class: "btn", onClick: () => c() }, "Batal")
    ], () => res(val));
  });
}
export function field(label, input, hint) {
  return h("div", { class: "field" }, h("label", null, label), input, hint ? h("div", { class: "hint" }, hint) : null);
}
export function note(text, kind) { return h("div", { class: "note" + (kind ? " " + kind : "") }, text); }
export function kv(k, v) { return h("div", { class: "kv" }, h("span", null, k), h("span", null, v)); }
export function chips(options, value, onPick) {
  const wrap = h("div", { class: "chips" });
  const draw = (cur) => {
    wrap.replaceChildren(...options.map(([val, label]) => h("button", { type: "button", class: "chip" + (cur === val ? " on" : ""), onClick: () => { draw(val); onPick(val); } }, label)));
  };
  draw(value);
  return wrap;
}

/* ---------- gambar ---------- */
export function compressImage(file, max = 1000, q = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r);
      c.height = Math.round(img.height * r);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal memproses gambar"))), "image/jpeg", q);
    };
    img.onerror = () => reject(new Error("File bukan gambar yang valid"));
    img.src = url;
  });
}
export async function uploadImageFile(file, folder = "p") {
  const u = auth.currentUser;
  if (!u) throw new Error("Silakan masuk dulu");
  const blob = await compressImage(file);
  const name = `${folder}/${u.uid}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  return uploadBlob(name, blob);
}
// Pemilih foto: unggah (dikompres otomatis) atau tempel link gambar. `urls` adalah array yang diubah langsung.
export function photoPicker(urls, max = 6) {
  const wrap = h("div", { class: "col" });
  const list = h("div", { class: "mini" });
  const drawList = () => list.replaceChildren(...urls.map((u, i) => h("div", { class: "x" }, h("img", { src: safeUrl(u), alt: "" }), h("button", { type: "button", "aria-label": "Hapus foto", onClick: () => { urls.splice(i, 1); drawList(); } }, "x"))));
  const file = h("input", { type: "file", accept: "image/*", multiple: true, style: { display: "none" } });
  const btn = h("button", { type: "button", class: "btn sm out", onClick: () => file.click() }, "Unggah foto");
  file.addEventListener("change", async () => {
    btn.disabled = true; btn.textContent = "Mengunggah…";
    try {
      for (const f of [...file.files]) {
        if (urls.length >= max) { toast("Maksimal " + max + " foto"); break; }
        urls.push(await uploadImageFile(f));
        drawList();
      }
    } catch (e) { toast(errMsg(e) + " (Anda juga bisa menempel link gambar.)", "err"); }
    btn.disabled = false; btn.textContent = "Unggah foto"; file.value = "";
  });
  const link = h("input", { type: "url", placeholder: "atau tempel link foto (https://…)" });
  const addLink = h("button", { type: "button", class: "btn sm", onClick: () => {
    const s = safeUrl(link.value.trim());
    if (!s) return toast("Link tidak valid", "err");
    if (urls.length >= max) return toast("Maksimal " + max + " foto", "err");
    urls.push(s); link.value = ""; drawList();
  } }, "Tambah");
  wrap.append(list, h("div", { class: "row" }, btn, file), h("div", { class: "row" }, h("div", { style: { flex: "1 1 160px" } }, link), addLink));
  drawList();
  return wrap;
}

/* ---------- label status ---------- */
export const ORDER_STATUS = {
  awaiting_payment: ["Menunggu pembayaran", "wr"], payment_submitted: ["Bukti bayar dikirim", "wr"], paid: ["Dana diterima penengah", "ok"],
  handed: ["HP diserahkan / dikirim", "ok"], received: ["HP diterima", "ok"], satisfied: ["Pembeli puas", "ok"],
  complaint: ["Komplain diajukan", "er"], complaint_approved: ["Komplain disetujui", "er"], complaint_rejected: ["Komplain ditolak", "wr"],
  refund_done: ["Refund selesai", "er"], payout_done: ["Selesai, dana diteruskan", "ok"], cancelled: ["Dibatalkan", ""]
};
export const SELL_STATUS = {
  open: ["Penawaran dibuka", "ok"], ended: ["Selesai tanpa kesepakatan", ""], cancelled: ["Dibatalkan", ""],
  awaiting_store_payment: ["Menunggu pembayaran toko", "wr"], store_payment_submitted: ["Bukti bayar toko dikirim", "wr"],
  awaiting_handover: ["Menunggu penyerahan HP", "ok"], handed_over: ["HP dikirim / diserahkan", "ok"], repricing: ["Toko mengajukan harga baru", "wr"],
  acc: ["Toko ACC", "ok"], returning: ["HP dikembalikan", "er"], payout_done: ["Selesai, dana diteruskan", "ok"],
  cancelled_paid: ["Batal (dana toko perlu dikembalikan)", "er"], refunded: ["Dana toko dikembalikan", ""]
};
export function statusTag(map, s) { const [t, k] = map[s] || [s, ""]; return h("span", { class: "tag " + k }, t); }
export const GRADE_HELP = { A: "Mulus / nyaris tanpa bekas pakai", B: "Lecet halus, fungsi normal", C: "Ada cacat terlihat, fungsi normal" };

/* ---------- SVG statis (hanya string tetap buatan sendiri) ---------- */
const SVGNS = "http://www.w3.org/2000/svg";
export function svg(markup) {
  const el = new DOMParser().parseFromString(markup.replace("<svg ", '<svg xmlns="' + SVGNS + '" '), "image/svg+xml").documentElement;
  return document.importNode(el, true);
}
export const TONE = {
  A: { tint: "#08826D", glow: "rgba(8,130,109,0.16)", screen: "#D8F5EC" },
  B: { tint: "#E8890C", glow: "rgba(232,137,12,0.16)", screen: "#FFEBCB" },
  C: { tint: "#E0594D", glow: "rgba(224,89,77,0.15)", screen: "#FFDDD7" }
};
export const tone = (g) => TONE[g] || TONE.C;
export const phoneSvg = (g, w = 38, hh = 68) => { const t = tone(g); return svg(`<svg width="${w}" height="${hh}" viewBox="0 0 84 150" aria-hidden="true"><rect x="2" y="2" width="80" height="146" rx="16" fill="#FFFFFF" stroke="${t.tint}" stroke-width="3"/><rect x="8" y="10" width="68" height="128" rx="10" fill="${t.screen}"/><circle cx="42" cy="18" r="3" fill="#1F2430"/></svg>`); };
export const icon = (d, size = 18, color = "#08826D", sw = 1.8) => svg(`<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none"><path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
export const ICON = {
  star: "M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4",
  phone: "M7 3h10v18H7z M11 18h2",
  video: "M4 6h12v12H4z M16 10l5-3v10l-5-3",
  check: "M5 12l5 5 9-10"
};
