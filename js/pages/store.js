import { D, C, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, limit, serverTimestamp } from "../fb.js";
import { h, rp, field, run, toast, confirmBox, kv, note, safeUrl, videoOk, fmtDate, toMs, photoPicker, chips, isPhone } from "../ui.js";
import { S, route, go, requireLogin, loadUser, storeActive, getSettings, productCard } from "../core.js";

/* ---------- Daftar toko ---------- */
route("/daftar-toko", async () => {
  if (!(await requireLogin())) return h("div", { class: "card pad" }, "Silakan masuk untuk mendaftarkan toko.");
  if (S.store) { go("/toko-saya"); return null; }
  const f = {
    name: h("input", { type: "text", placeholder: "Nama toko" }), city: h("input", { type: "text", placeholder: "Kota" }),
    address: h("textarea", { placeholder: "Alamat lengkap toko" }), mapUrl: h("input", { type: "url", placeholder: "Link Google Maps lokasi toko" }),
    hours: h("input", { type: "text", placeholder: "Contoh: Senin-Sabtu 09.00-20.00" }), whatsapp: h("input", { type: "tel", placeholder: "08xxxxxxxxxx" }),
    description: h("textarea", { placeholder: "Tentang toko (singkat)" })
  };
  const logo = [];
  return h("div", { class: "col" }, h("h1", null, "Daftar sebagai Toko"),
    note("Toko baru disetujui admin lebih dulu. Setelah disetujui, Anda mendapat uji coba gratis 1 bulan, lalu langganan tetap bulanan tanpa komisi per penjualan."),
    field("Nama toko", f.name), field("Kota", f.city), field("Alamat", f.address), field("Link peta", f.mapUrl, "Buka Google Maps, cari toko Anda, pilih Bagikan, lalu salin link."), field("Jam buka", f.hours), field("WhatsApp toko", f.whatsapp), field("Tentang toko", f.description), field("Logo toko (opsional)", photoPicker(logo, 1)),
    h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
      if (!f.name.value.trim() || !f.city.value.trim() || !f.address.value.trim()) return toast("Nama, kota, dan alamat wajib diisi", "err");
      if (!isPhone(f.whatsapp.value)) return toast("Nomor WhatsApp tidak valid", "err");
      if (f.mapUrl.value && !safeUrl(f.mapUrl.value)) return toast("Link peta tidak valid", "err");
      await setDoc(D("stores", S.user.uid), { name: f.name.value.trim(), city: f.city.value.trim(), address: f.address.value.trim(), mapUrl: safeUrl(f.mapUrl.value), hours: f.hours.value.trim(), whatsapp: f.whatsapp.value.replace(/[\s-]/g, ""), description: f.description.value.trim(), logoUrl: logo[0] || "", status: "pending", warnings: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      await loadUser(S.user); toast("Pendaftaran terkirim. Menunggu persetujuan admin."); go("/toko-saya");
    }) }, "Kirim pendaftaran"));
});

/* ---------- Dasbor toko ---------- */
route("/toko-saya", async (_, q) => {
  if (!S.user) return h("div", { class: "card pad" }, "Silakan masuk.");
  if (!S.store) return h("div", { class: "card pad col" }, h("p", null, "Anda belum punya toko."), h("a", { class: "btn pri", href: "#/daftar-toko" }, "Daftar sebagai Toko"));
  const st = S.store;
  if (st.status === "pending") return h("div", { class: "card pad col" }, h("h1", null, st.name), note("Pendaftaran toko Anda sedang diperiksa admin. Anda akan mendapat notifikasi setelah disetujui.", "wr"));
  if (st.status === "suspended") return h("div", { class: "card pad col" }, h("h1", null, st.name), note("Toko Anda sedang ditangguhkan. Hubungi pengelola Rxgadget.", "er"));
  const cfg = await getSettings();
  const tab = q.tab || "produk";
  const days = Math.ceil((toMs(st.subscriptionUntil) - Date.now()) / 86400000);
  const tabs = h("div", { class: "tabs" }, [["produk", "Produk"], ["profil", "Profil toko"], ["langganan", "Langganan"]].map(([k, l]) => h("a", { class: "chip" + (tab === k ? " on" : ""), href: "#/toko-saya?tab=" + k }, l)), h("a", { class: "chip", href: "#/lelang" }, "HP masuk (lelang)"), h("a", { class: "chip", href: "#/pesanan" }, "Pesanan"));
  const head = h("div", { class: "col" }, h("div", { class: "row sp" }, h("h1", null, st.name), h("a", { class: "btn sm", href: "#/toko/" + S.user.uid }, "Lihat halaman toko")),
    storeActive() ? note(`Langganan aktif sampai ${fmtDate(st.subscriptionUntil)} (${days} hari lagi).`, "ok") : note("Langganan Anda berakhir. Produk disembunyikan dan Anda tidak bisa menawar. Perpanjang di tab Langganan.", "wr"), tabs);
  let body;
  if (tab === "produk") body = await productsTab(cfg);
  else if (tab === "profil") body = profileTab();
  else body = await subscriptionTab(cfg);
  return h("div", { class: "col" }, head, body);
});

async function productsTab(cfg) {
  const snap = await getDocs(query(C("products"), where("storeId", "==", S.user.uid), limit(200)));
  const rows = []; snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
  rows.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const activeCount = rows.filter((r) => ["active", "reserved"].includes(r.status)).length;
  const atLimit = activeCount >= cfg.productLimit;
  return h("div", { class: "col" }, h("div", { class: "row sp" }, h("span", { class: "mut sm" }, `${activeCount} / ${cfg.productLimit} produk aktif`), h("a", { class: "btn pri sm", href: atLimit ? "#/toko-saya" : "#/toko-saya/produk/baru", onClick: (e) => { if (atLimit) { e.preventDefault(); toast("Batas produk aktif tercapai", "err"); } } }, "Tambah produk")),
    rows.length ? rows.map((p) => h("div", { class: "item" }, h("div", { style: { minWidth: 0 } }, h("div", { class: "b" }, p.title), h("div", { class: "mut xs" }, rp(p.price) + " · Grade " + p.grade + " · " + p.status)),
      h("div", { class: "row" }, h("a", { class: "btn sm", href: "#/toko-saya/produk/" + p.id }, "Ubah"),
        p.status === "reserved" ? h("span", { class: "tag wr" }, "Dalam transaksi") : h("button", { class: "btn sm", onClick: (e) => run(e.currentTarget, async () => { await updateDoc(D("products", p.id), { status: p.status === "active" ? "hidden" : "active", updatedAt: serverTimestamp() }); location.reload(); }) }, p.status === "active" ? "Sembunyikan" : "Tampilkan"),
        h("button", { class: "btn dng sm", onClick: async (e) => { if (await confirmBox("Hapus produk ini?")) run(e.currentTarget, async () => { await deleteDoc(D("products", p.id)); location.reload(); }); } }, "Hapus")))) : h("p", { class: "mut" }, "Belum ada produk. Tambahkan HP pertama Anda."));
}

function profileTab() {
  const s = S.store;
  const f = { name: h("input", { type: "text", value: s.name }), city: h("input", { type: "text", value: s.city }), address: h("textarea", null, s.address || ""), mapUrl: h("input", { type: "url", value: s.mapUrl || "" }), hours: h("input", { type: "text", value: s.hours || "" }), whatsapp: h("input", { type: "tel", value: s.whatsapp || "" }), description: h("textarea", null, s.description || "") };
  f.address.value = s.address || ""; f.description.value = s.description || "";
  const logo = s.logoUrl ? [s.logoUrl] : [];
  return h("div", { class: "col" }, field("Nama toko", f.name), field("Kota", f.city), field("Alamat", f.address), field("Link peta", f.mapUrl), field("Jam buka", f.hours), field("WhatsApp", f.whatsapp), field("Tentang toko", f.description), field("Logo", photoPicker(logo, 1)),
    note("Rekening pencairan dana diisi di Profil > Tarik dana."),
    h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
      if (!isPhone(f.whatsapp.value)) return toast("Nomor WhatsApp tidak valid", "err");
      await updateDoc(D("stores", S.user.uid), { name: f.name.value.trim(), city: f.city.value.trim(), address: f.address.value.trim(), mapUrl: safeUrl(f.mapUrl.value), hours: f.hours.value.trim(), whatsapp: f.whatsapp.value.replace(/[\s-]/g, ""), description: f.description.value.trim(), logoUrl: logo[0] || "", updatedAt: serverTimestamp() });
      await loadUser(S.user); toast("Profil toko disimpan");
    }) }, "Simpan"));
}

async function subscriptionTab(cfg) {
  const snap = await getDocs(query(C("subscriptionRequests"), where("storeId", "==", S.user.uid), limit(20)));
  const rows = []; snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
  rows.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const proof = [];
  return h("div", { class: "col" }, h("div", { class: "card pad" }, kv("Status", storeActive() ? "Aktif" : "Berakhir"), kv("Aktif sampai", fmtDate(S.store.subscriptionUntil)), kv("Biaya langganan", cfg.subscriptionPrice || "Hubungi pengelola")),
    cfg.subscriptionInfo ? note(cfg.subscriptionInfo) : null,
    h("div", { class: "card pad col" }, h("h3", null, "Perpanjang langganan"), h("p", { class: "mut sm" }, "Transfer sesuai petunjuk pengelola, lalu unggah bukti. Admin akan mengaktifkan setelah diperiksa."), photoPicker(proof, 1),
      h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
        if (!proof.length) return toast("Unggah bukti pembayaran", "err");
        await addDoc(C("subscriptionRequests"), { storeId: S.user.uid, storeName: S.store.name, proofUrl: proof[0], status: "pending", createdAt: serverTimestamp() });
        toast("Bukti dikirim. Menunggu konfirmasi admin."); location.reload();
      }) }, "Kirim bukti")),
    h("div", null, h("h3", null, "Riwayat pengajuan"), rows.length ? h("div", { class: "col", style: { marginTop: "8px" } }, rows.map((r) => h("div", { class: "item" }, h("span", null, fmtDate(r.createdAt)), h("span", { class: "tag " + (r.status === "approved" ? "ok" : r.status === "rejected" ? "er" : "wr") }, r.status === "approved" ? "Diaktifkan" : r.status === "rejected" ? "Ditolak" : "Menunggu")))) : h("p", { class: "mut sm" }, "Belum ada.")));
}

/* ---------- Form produk ---------- */
const BRANDS = ["Apple", "Samsung", "Xiaomi", "Oppo", "Vivo", "Realme", "Infinix", "Tecno", "Google", "Lainnya"];
const KELENGKAPAN = ["Dus", "Charger", "Kabel", "Nota", "Earphone"];
async function productForm(id) {
  if (!S.store || S.store.status !== "approved") return h("div", { class: "card pad" }, "Toko Anda belum disetujui.");
  if (!storeActive()) return h("div", { class: "card pad" }, "Langganan toko tidak aktif.");
  let p = null;
  if (id) { const s = await getDoc(D("products", id)); if (!s.exists() || s.data().storeId !== S.user.uid) return h("div", { class: "card pad" }, "Produk tidak ditemukan."); p = s.data(); }
  const hc = p?.health || {};
  const v = { brand: p?.brand || "Apple", grade: p?.grade || "A", comp: new Set(p?.completeness || []), trade: !!p?.tradeIn };
  const photos = [...(p?.photos || [])];
  const defects = (p?.defects || []).map((d) => ({ ...d }));
  const el = {
    model: h("input", { type: "text", value: p?.model || "", placeholder: "Contoh: iPhone 13" }), storage: h("input", { type: "text", value: p?.storage || "", placeholder: "Contoh: 128 GB" }),
    price: h("input", { type: "number", inputmode: "numeric", value: p?.price || "", placeholder: "Harga (angka)" }), warranty: h("input", { type: "text", value: p?.warranty || "", placeholder: "Contoh: Garansi toko 7 hari" }),
    imei: h("input", { type: "text", value: p?.imei || "", inputmode: "numeric" }), battery: h("input", { type: "number", value: hc.battery || "", placeholder: "Kesehatan baterai %" }),
    screen: h("input", { type: "text", value: hc.screen || "", placeholder: "Contoh: Mulus, sentuh normal" }), camera: h("input", { type: "text", value: hc.camera || "", placeholder: "Contoh: Depan dan belakang normal" }),
    functions: h("input", { type: "text", value: hc.functions || "", placeholder: "Face ID, sinyal, speaker, dll." }), video: h("input", { type: "url", value: p?.videoUrl || "", placeholder: "Link video cacat TikTok/YouTube (opsional)" })
  };
  const dList = h("div", { class: "col" });
  const drawD = () => dList.replaceChildren(...defects.map((d, i) => h("div", { class: "card pad col" }, h("input", { type: "text", value: d.label, placeholder: "Cacat (mis. Goresan bodi belakang)", onInput: (e) => (d.label = e.target.value) }), h("input", { type: "text", value: d.note || "", placeholder: "Keterangan (ukuran, lokasi)", onInput: (e) => (d.note = e.target.value) }), h("button", { type: "button", class: "btn dng sm", onClick: () => { defects.splice(i, 1); drawD(); } }, "Hapus cacat"))));
  drawD();
  const comp = h("div", { class: "row" }, KELENGKAPAN.map((k) => h("label", { class: "chk" }, h("input", { type: "checkbox", checked: v.comp.has(k), onChange: (e) => (e.target.checked ? v.comp.add(k) : v.comp.delete(k)) }), k)));
  return h("div", { class: "col" }, h("h1", null, p ? "Ubah produk" : "Tambah produk"),
    field("Merek", h("select", { onChange: (e) => (v.brand = e.target.value) }, BRANDS.map((b) => h("option", { value: b, selected: b === v.brand }, b)))),
    field("Tipe", el.model), field("Kapasitas", el.storage), field("Harga (Rp)", el.price),
    field("Grade kondisi", chips([["A", "A · Mulus"], ["B", "B · Lecet halus"], ["C", "C · Ada cacat"]], v.grade, (x) => (v.grade = x))),
    field("Kelengkapan", comp), field("Garansi toko", el.warranty),
    field("IMEI (disarankan)", el.imei, "Disarankan dicatat sebagai bukti. Jika tidak diisi, risiko bila ada pelanggan bermasalah ada pada toko."),
    h("div", { class: "card pad" }, h("h3", null, "Health card"), h("div", { style: { marginTop: "10px" } }, field("Baterai (%)", el.battery), field("Layar", el.screen), field("Kamera", el.camera), field("Fungsi lain", el.functions))),
    h("div", { class: "card pad col" }, h("h3", null, "Catatan cacat"), dList, h("button", { type: "button", class: "btn sm", onClick: () => { defects.push({ label: "", note: "" }); drawD(); } }, "Tambah cacat"), field("Link video cacat", el.video, "Unggah video ke TikTok atau YouTube, lalu tempel link-nya di sini.")),
    field("Foto (maks. 6)", photoPicker(photos, 6)),
    h("label", { class: "chk" }, h("input", { type: "checkbox", checked: v.trade, onChange: (e) => (v.trade = e.target.checked) }), "Bisa tukar tambah"),
    h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
      const price = Number(el.price.value);
      if (!el.model.value.trim()) return toast("Isi tipe HP", "err");
      if (!(price > 0)) return toast("Harga tidak valid", "err");
      if (!photos.length) return toast("Tambahkan minimal 1 foto", "err");
      if (el.video.value.trim() && !videoOk(el.video.value)) return toast("Link video harus dari YouTube atau TikTok", "err");
      const clean = defects.filter((d) => d.label.trim()).map((d) => ({ label: d.label.trim().slice(0, 80), note: (d.note || "").trim().slice(0, 200) }));
      const data = {
        storeId: S.user.uid, storeName: S.store.name, storeCity: S.store.city, os: v.brand === "Apple" ? "iOS" : "Android", brand: v.brand, model: el.model.value.trim(), storage: el.storage.value.trim(),
        title: (el.model.value.trim().toLowerCase().startsWith(v.brand.toLowerCase()) || v.brand === "Lainnya" ? "" : v.brand + " ") + el.model.value.trim() + (el.storage.value.trim() ? " " + el.storage.value.trim() : ""),
        grade: v.grade, price, completeness: [...v.comp], warranty: el.warranty.value.trim(), imei: el.imei.value.trim(),
        health: { battery: Number(el.battery.value) || 0, screen: el.screen.value.trim(), camera: el.camera.value.trim(), functions: el.functions.value.trim() },
        defects: clean, photos, videoUrl: safeUrl(el.video.value), tradeIn: v.trade, updatedAt: serverTimestamp()
      };
      if (id) await updateDoc(D("products", id), data);
      else await setDoc(D("products", crypto.randomUUID()), { ...data, status: "active", reviewedByRx: false, createdAt: serverTimestamp() });
      toast("Produk disimpan"); go("/toko-saya");
    }) }, "Simpan produk"));
}
route("/toko-saya/produk/baru", () => productForm(null));
route("/toko-saya/produk/:id", ({ id }) => productForm(id));
void productCard;
