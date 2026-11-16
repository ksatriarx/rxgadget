import { D, C, getDoc, getDocs, setDoc, query, where, limit, serverTimestamp } from "../fb.js";
import { h, rp, field, run, toast, openModal, chips, kv, note, safeUrl, waLink, fmtDate, toMs, GRADE_HELP, svg, icon, ICON, phoneSvg, tone } from "../ui.js";
import { S, route, go, requireLogin, loadProducts, productCard, storeMap, logEntry, notify } from "../core.js";

/* ---------- Beranda ---------- */
const DEMO = [["iPhone 13", "128 GB · 87%", "A", "[Toko A]"], ["Galaxy S22", "256 GB · 91%", "A", "[Toko B]"], ["iPhone 11", "64 GB · 82%", "B", "[Toko C]"], ["Xiaomi 12", "128 GB · 79%", "C", "[Toko A]"], ["iPhone 12", "128 GB · 85%", "B", "[Toko B]"], ["Galaxy A54", "128 GB · 90%", "A", "[Toko C]"]];
const heroPhone = () => svg('<svg width="128" height="240" viewBox="0 0 250 470" aria-hidden="true"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#CFF3E8"/><stop offset="1" stop-color="#FFE3C2"/></linearGradient></defs><rect x="4" y="4" width="242" height="462" rx="40" fill="#FFFFFF" stroke="#DDD5C5" stroke-width="3"/><rect x="16" y="16" width="218" height="438" rx="30" fill="url(#g1)"/><rect x="92" y="28" width="66" height="18" rx="9" fill="#1F2430"/><circle cx="125" cy="232" r="46" fill="none" stroke="#08826D" stroke-width="2.5" opacity="0.55"/><circle cx="125" cy="232" r="26" fill="none" stroke="#08826D" stroke-width="2.5" opacity="0.9"/></svg>');
route("/", async () => {
  const all = await loadProducts().catch(() => []);
  const f = { k: "all" };
  const grid = h("div", { class: "grid3", style: { marginTop: "12px" } });
  const demoNote = h("p", { class: "mut xs", style: { marginTop: "8px" } });
  const sub = h("p", { class: "mut xs", style: { marginTop: "4px" } });
  const draw = () => {
    const list = all.filter((p) => f.k === "all" || (f.k === "ios" && p.os === "iOS") || (f.k === "android" && p.os === "Android") || (f.k === "trade" && p.tradeIn)).slice(0, 9);
    if (all.length) {
      sub.textContent = "Unit terbaru dari toko yang sudah disetujui.";
      grid.replaceChildren(...(list.length ? list.map(productCard) : [h("p", { class: "mut", style: { gridColumn: "1/-1" } }, "Belum ada HP untuk filter ini.")]));
      demoNote.textContent = "Ikon centang = sudah direview Rxgadget.";
    } else {
      sub.textContent = "Contoh tampilan katalog. Tiap kartu dari toko yang berbeda.";
      grid.replaceChildren(...DEMO.map(([t, sp, g, st]) => h("div", { class: "pc demo" },
        h("div", { class: "pc-img", style: { background: `radial-gradient(80px 80px at 50% 55%, ${tone(g).glow}, rgba(255,255,255,0) 75%)` } }, phoneSvg(g), h("span", { class: "gpill", style: { background: tone(g).tint } }, g), h("span", { class: "chk-c" }, icon(ICON.check, 10, "#08826D", 3))),
        h("div", { class: "pc-b" }, h("div", { class: "pc-t" }, t), h("div", { class: "pc-s" }, sp), h("div", { class: "pc-p" }, "Rp [HARGA]"), h("div", { class: "pc-s" }, st)))));
      demoNote.textContent = "Ikon centang = sudah direview Rxgadget. HP asli muncul di sini setelah toko yang disetujui mengunggah produk.";
    }
  };
  draw();
  const filters = chips([["all", "Semua"], ["ios", "iPhone"], ["android", "Android"], ["trade", "Tukar tambah"]], "all", (v) => { f.k = v; draw(); });
  const trust = [[ICON.star, "Direview Rxgadget", "Unit diuji langsung, ditampilkan apa adanya."], [ICON.shield, "Toko terverifikasi", "Disetujui admin sebelum berjualan."], [ICON.phone, "IMEI dicek", "Status IMEI tampil di health card."], [ICON.video, "Video cacat jelas", "Cacat didokumentasikan foto dan video."]];
  const steps = [["Isi form HP-mu", "Tipe, kondisi, kelengkapan, IMEI, plus foto dan video cacat."], ["Toko mengirim penawaran", "Beberapa toko bersaing dalam batas waktu yang jelas."], ["Pilih dan serah terima", "Pilih penawaran terbaik, lalu cek fisik dan serah terima di toko."]];
  const bids = [["[Nama Toko B]", "Penawaran terbaru", "Tertinggi", true], ["[Nama Toko A]", "Menerima tukar tambah", "Kedua"], ["[Nama Toko C]", "Cek fisik di toko", "Ketiga"]];
  const hc = (k, v, c) => h("div", { class: "hc-r" }, h("span", { class: "mut" }, k), h("span", { style: c ? { color: c } : {} }, v));
  return h("div", { class: "home" },
    h("div", { class: "hero-bg" }, h("div", { class: "hero" },
      h("div", null,
        h("span", { class: "dotbadge" }, h("i"), "HP second · direview langsung"),
        h("h1", { class: "h1" }, "HP second yang dicek, direview, dan jelas kondisinya."),
        h("p", null, "Setiap unit punya foto, video cacat, dan health card. Mau jual HP lama? Biarkan toko bersaing memberi penawaran terbaik."),
        h("div", { class: "row", style: { marginTop: "14px" } }, h("a", { class: "btn pri", href: "#/katalog" }, "Jelajahi HP"), h("a", { class: "btn out", href: "#/jual" }, "Jual / Tukar Tambah"))),
      h("div", { class: "heroart" }, heroPhone(),
        h("div", { class: "hcard" }, h("div", { class: "row sp mut xs" }, h("span", null, "Health card"), h("span", { class: "gp" }, "Grade A")),
          h("div", { class: "mut xs", style: { marginTop: "7px" } }, "Baterai"), h("div", { class: "bar4" }, h("i", { style: { width: "87%" } })),
          hc("Layar", "Mulus"), hc("Kamera", "Normal"), hc("IMEI", "Bersih", "#08826D"))))),
    h("div", { class: "trust" }, trust.map(([ic, t, d]) => h("div", { class: "feat" }, icon(ic), h("div", null, h("div", { class: "b" }, t), h("div", { class: "mut xs" }, d))))),
    h("div", { class: "sec" }, h("div", { class: "row sp", style: { alignItems: "flex-end" } }, h("div", null, h("h2", null, "HP pilihan"), sub), filters), grid, demoNote),
    h("div", { class: "panel sec" }, h("div", { class: "two" },
      h("div", null,
        h("div", { class: "eyebrow am" }, "JUAL / TUKAR TAMBAH"), h("h2", { class: "big" }, "Jual HP-mu. Biar toko yang bersaing."),
        h("div", { class: "steps" }, steps.map(([t, d], i) => h("div", { class: "step" }, h("span", { class: "num" }, String(i + 1)), h("div", null, h("div", { class: "b" }, t), h("div", { class: "mut xs" }, d))))),
        h("a", { class: "btn am", href: "#/jual", style: { marginTop: "14px" } }, "Ajukan HP-mu")),
      h("div", { class: "sample" }, h("div", { class: "row sp" }, h("div", null, h("div", { class: "b" }, "Penawaran masuk"), h("div", { class: "mut xs" }, "Contoh · iPhone 12 128 GB")), h("span", { class: "tmr" }, "Sisa 23:41:10")),
        h("div", { class: "col", style: { marginTop: "10px", gap: "6px" } }, bids.map(([n, s2, rk, top]) => h("div", { class: "bid" + (top ? " top" : "") }, h("div", null, h("div", { class: "b sm" }, n), h("div", { class: "mut xs" }, s2)), h("div", { style: { textAlign: "right" } }, h("div", { class: "b sm" }, "Rp [TAWARAN]"), h("div", { class: top ? "ac xs" : "mut xs" }, rk))))),
        h("p", { class: "mut xs", style: { marginTop: "10px" } }, "Penawaran berupa estimasi. Harga final ditentukan setelah toko mengecek fisik HP.")))),
    h("div", { class: "duo" }, h("div", { class: "card pad rev", id: "review" }, h("div", { class: "vid" }, svg('<svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#FFFFFF" stroke="#08826D" stroke-width="2"/><path d="M26 20v24l20-12z" fill="#08826D"/></svg>'), h("span", { class: "vid-c" }, "Video review [JUDUL]")),
      h("div", null, h("div", { class: "eyebrow ac" }, "REVIEW LANGSUNG"), h("h2", { class: "big" }, "Dari video review, langsung ke halaman jualnya."),
        h("p", { class: "mut sm", style: { margin: "10px 0 12px" } }, "Tonton review di TikTok, lalu buka link atau scan QR di video untuk melihat unit yang sama lengkap dengan health card, foto, dan penawaran toko."),
        h("div", { class: "row" }, ["Direview Rxgadget", "Toko Terverifikasi", "IMEI Dicek"].map((t) => h("span", { class: "pill" }, t))))),
    h("div", { class: "card pad cta" }, h("div", null, h("h2", null, "Punya toko HP? Coba dulu, gratis."), h("p", { class: "mut sm", style: { margin: "8px 0 0" } }, "Pasang produkmu di etalase tokomu, ikut menawar HP yang masuk, dan tampil di konten review. Ada masa uji coba, lalu langganan tetap tanpa komisi per penjualan.")), h("a", { class: "btn pri", href: "#/daftar-toko" }, "Daftar sebagai Toko"))));
});

/* ---------- Katalog ---------- */
route("/katalog", async (_, q) => {
  const all = await loadProducts();
  const f = { os: "", grade: "", trade: false, text: q.q || "", sort: "new" };
  const grid = h("div", { class: "grid3" });
  const info = h("div", { class: "mut sm" });
  const draw = () => {
    let list = all.filter((p) => (!f.os || p.os === f.os) && (!f.grade || p.grade === f.grade) && (!f.trade || p.tradeIn) && (!f.text || (p.title + " " + p.storeName + " " + p.brand).toLowerCase().includes(f.text.toLowerCase())));
    if (f.sort === "low") list = [...list].sort((a, b) => a.price - b.price);
    if (f.sort === "high") list = [...list].sort((a, b) => b.price - a.price);
    info.textContent = list.length + " HP ditemukan";
    grid.replaceChildren(...list.map(productCard));
    if (!list.length) grid.replaceChildren(h("p", { class: "mut", style: { gridColumn: "1/-1" } }, "Tidak ada HP yang cocok."));
  };
  const search = h("input", { type: "search", placeholder: "Cari tipe atau toko…", value: f.text, onInput: (e) => { f.text = e.target.value; draw(); } });
  const sort = h("select", { onChange: (e) => { f.sort = e.target.value; draw(); } }, h("option", { value: "new" }, "Terbaru"), h("option", { value: "low" }, "Harga termurah"), h("option", { value: "high" }, "Harga termahal"));
  draw();
  return h("div", null, h("h1", null, "Beli HP"),
    h("div", { class: "col", style: { margin: "12px 0" } }, search,
      chips([["", "Semua"], ["iOS", "iPhone"], ["Android", "Android"]], "", (v) => { f.os = v; draw(); }),
      chips([["", "Semua grade"], ["A", "Grade A"], ["B", "Grade B"], ["C", "Grade C"]], "", (v) => { f.grade = v; draw(); }),
      h("div", { class: "row sp" }, h("label", { class: "chk" }, h("input", { type: "checkbox", onChange: (e) => { f.trade = e.target.checked; draw(); } }), "Bisa tukar tambah"), sort)),
    info, grid);
});

/* ---------- Detail produk ---------- */
route("/produk/:id", async ({ id }) => {
  const snap = await getDoc(D("products", id));
  if (!snap.exists()) return h("div", { class: "card pad" }, "Produk tidak ditemukan.");
  const p = { id, ...snap.data() };
  const sSnap = await getDoc(D("stores", p.storeId));
  const st = sSnap.exists() ? sSnap.data() : {};
  const photos = (p.photos || []).map(safeUrl).filter(Boolean);
  const hc = p.health || {};
  const buy = async (btn) => {
    if (!(await requireLogin())) return;
    if (S.user.uid === p.storeId) return toast("Ini produk toko Anda sendiri", "err");
    const method = { v: "cod" };
    const addr = h("textarea", { placeholder: "Alamat lengkap pengiriman" });
    const addrField = field("Alamat pengiriman", addr);
    addrField.style.display = "none";
    openModal("Beli " + p.title, h("div", null,
      kv("Harga", rp(p.price)), kv("Toko", p.storeName),
      field("Cara serah terima", chips([["cod", "Ambil / bertemu di toko"], ["kirim", "Dikirim paket"]], "cod", (v) => { method.v = v; addrField.style.display = v === "kirim" ? "" : "none"; })),
      addrField,
      note("Pembayaran dilakukan ke Rxgadget (penengah). Dana baru diteruskan ke toko setelah Anda menyatakan puas, atau 7 hari setelah HP diterima tanpa komplain. Untuk paket kiriman, rekam video saat membuka paket sebagai bukti komplain.", "wr")
    ), (close) => [h("button", { class: "btn pri", onClick: async (e) => {
      if (method.v === "kirim" && addr.value.trim().length < 10) return toast("Alamat belum lengkap", "err");
      await run(e.currentTarget, async () => {
        const ref = D("orders", crypto.randomUUID());
        await setDoc(ref, {
          productId: p.id, productTitle: p.title, productPhoto: photos[0] || "", price: p.price, storeId: p.storeId, storeName: p.storeName,
          buyerId: S.user.uid, buyerName: S.profile.name, buyerPhone: S.profile.phone, method: method.v, address: method.v === "kirim" ? addr.value.trim() : "",
          status: "awaiting_payment", log: [logEntry("Pesanan dibuat")], createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        await notify(p.storeId, "Pesanan baru untuk " + p.title, "/pesanan/" + ref.id);
        close(); go("/pesanan/" + ref.id);
      });
    } }, "Buat pesanan"), h("button", { class: "btn", onClick: () => close() }, "Batal")]);
  };
  const statusNote = p.status === "reserved" ? note("HP ini sedang dalam transaksi.", "wr") : p.status === "sold" ? note("HP ini sudah terjual.", "wr") : null;
  return h("div", { class: "col gap" },
    photos.length ? h("div", { class: "gal" }, photos.map((u) => h("img", { src: u, alt: p.title, loading: "lazy" }))) : h("div", { class: "ph" }, "Belum ada foto"),
    h("div", null,
      h("div", { class: "row" }, h("span", { class: "tag grade g" + p.grade }, "Grade " + p.grade), h("span", { class: "tag" }, "Second"), p.reviewedByRx ? h("span", { class: "tag ok" }, "Direview Rxgadget") : null, p.tradeIn ? h("span", { class: "tag ok" }, "Bisa tukar tambah") : null),
      h("h1", { style: { marginTop: "8px" } }, p.title),
      h("div", { class: "mut sm", style: { marginTop: "4px" } }, "Dijual oleh ", h("a", { href: "#/toko/" + p.storeId }, p.storeName), p.storeCity ? " · " + p.storeCity : ""),
      h("div", { style: { font: "700 24px 'Space Grotesk'", marginTop: "10px" } }, rp(p.price))),
    statusNote,
    h("div", { class: "row" },
      h("button", { class: "btn pri", disabled: p.status !== "active", onClick: (e) => run(e.currentTarget, () => buy(e.currentTarget)) }, "Beli sekarang"),
      st.whatsapp ? h("a", { class: "btn", href: waLink(st.whatsapp, `Halo, saya tertarik dengan ${p.title} di Rxgadget.`), target: "_blank", rel: "noopener" }, "Chat toko") : null),
    h("div", { class: "card pad" }, h("h3", null, "Health card"), h("div", { class: "hc", style: { marginTop: "10px" } },
      h("div", null, h("small", null, "Baterai"), hc.battery ? hc.battery + "%" : "-"), h("div", null, h("small", null, "Layar"), hc.screen || "-"),
      h("div", null, h("small", null, "Kamera"), hc.camera || "-"), h("div", null, h("small", null, "Fungsi lain"), hc.functions || "-"))),
    h("div", { class: "card pad" }, h("h3", null, "Catatan cacat"),
      (p.defects || []).length ? h("div", { class: "col", style: { marginTop: "8px" } }, p.defects.map((d) => h("div", null, h("div", { class: "b" }, d.label), h("div", { class: "mut sm" }, d.note || "")))) : h("p", { class: "mut", style: { marginTop: "6px" } }, "Penjual tidak mencantumkan cacat."),
      safeUrl(p.videoUrl) ? h("a", { class: "btn out sm", style: { marginTop: "10px" }, href: safeUrl(p.videoUrl), target: "_blank", rel: "noopener" }, "Tonton video") : null),
    h("div", { class: "card pad" }, kv("Merek / tipe", p.brand + " " + p.model), kv("Kapasitas", p.storage || "-"), kv("Grade", "Grade " + p.grade + " · " + (GRADE_HELP[p.grade] || "")), kv("Kelengkapan", (p.completeness || []).join(", ") || "-"), kv("Garansi toko", p.warranty || "-"), kv("IMEI", p.imei ? "Dicatat toko" : "Tidak dicantumkan"), kv("Diunggah", fmtDate(p.createdAt))),
    note("Dana Anda ditahan Rxgadget sampai Anda puas. Masa komplain 7 hari setelah HP diterima, hanya jika HP tidak sesuai deskripsi, foto/video, atau health card."));
});

/* ---------- Halaman toko ---------- */
route("/toko/:id", async ({ id }) => {
  const sSnap = await getDoc(D("stores", id));
  if (!sSnap.exists()) return h("div", { class: "card pad" }, "Toko tidak ditemukan.");
  const s = sSnap.data();
  const [map, pSnap, rSnap] = await Promise.all([storeMap(), getDocs(query(C("products"), where("storeId", "==", id), where("status", "==", "active"), limit(100))), getDocs(query(C("reviews"), where("storeId", "==", id), limit(50)))]);
  const prods = []; pSnap.forEach((d) => prods.push({ id: d.id, ...d.data() }));
  const revs = []; rSnap.forEach((d) => revs.push(d.data()));
  revs.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const avg = revs.length ? (revs.reduce((x, r) => x + r.rating, 0) / revs.length).toFixed(1) : null;
  const active = map[id]?.active;
  return h("div", { class: "col gap" },
    h("div", { class: "card pad row" },
      safeUrl(s.logoUrl) ? h("img", { src: safeUrl(s.logoUrl), alt: "", width: 56, height: 56, style: { borderRadius: "12px", objectFit: "cover" } }) : null,
      h("div", { style: { flex: "1 1 200px" } }, h("h1", null, s.name), h("div", { class: "row", style: { marginTop: "6px" } }, h("span", { class: "tag ok" }, "Toko terverifikasi"), avg ? h("span", { class: "tag" }, "★ " + avg + " (" + revs.length + ")") : h("span", { class: "tag" }, "Belum ada ulasan")))),
    h("div", { class: "card pad" }, kv("Kota", s.city || "-"), kv("Alamat", s.address || "-"), kv("Jam buka", s.hours || "-"), s.description ? kv("Tentang", s.description) : null,
      h("div", { class: "row", style: { marginTop: "10px" } }, s.whatsapp ? h("a", { class: "btn sm", href: waLink(s.whatsapp), target: "_blank", rel: "noopener" }, "WhatsApp") : null, safeUrl(s.mapUrl) ? h("a", { class: "btn sm out", href: safeUrl(s.mapUrl), target: "_blank", rel: "noopener" }, "Lihat di peta") : null)),
    h("div", null, h("h2", null, "HP dari toko ini"), active ? (prods.length ? h("div", { class: "grid3", style: { marginTop: "10px" } }, prods.map(productCard)) : h("p", { class: "mut", style: { marginTop: "8px" } }, "Belum ada produk aktif.")) : note("Toko ini sedang tidak aktif berjualan.", "wr")),
    h("div", null, h("h2", null, "Ulasan"), revs.length ? h("div", { class: "col", style: { marginTop: "10px" } }, revs.map((r) => h("div", { class: "card pad" }, h("div", { class: "row sp" }, h("span", { class: "b" }, r.reviewerName || "Pengguna"), h("span", { class: "am" }, "★".repeat(r.rating))), r.comment ? h("div", { class: "mut sm", style: { marginTop: "4px" } }, r.comment) : null, h("div", { class: "xs mut", style: { marginTop: "4px" } }, (r.kind === "jual" ? "Penjual HP · " : "Pembeli · ") + fmtDate(r.createdAt))))) : h("p", { class: "mut", style: { marginTop: "8px" } }, "Ulasan hanya muncul dari transaksi yang sudah selesai.")));
});

/* ---------- Syarat & Privasi (templat: perlu ditinjau pihak hukum) ---------- */
const legal = (title, paras) => h("div", { class: "col" }, h("h1", null, title), note("Templat awal. Mohon ditinjau konsultan hukum sebelum dipakai untuk transaksi sungguhan. Bagian [ISI] harus dilengkapi pemilik."), ...paras.map((t) => h("p", { class: "mut" }, t)));
route("/syarat", () => legal("Syarat Layanan", [
  "1. Rxgadget adalah platform yang mempertemukan pembeli, penjual HP, dan toko HP, serta bertindak sebagai penengah dana transaksi.",
  "2. Dana pembayaran pembeli ditahan Rxgadget dan diteruskan ke toko setelah pembeli menyatakan puas atau 7 hari setelah HP diterima tanpa komplain.",
  "3. Komplain hanya sah jika HP tidak sesuai deskripsi, foto/video, atau health card. Untuk paket kiriman, video saat membuka paket wajib sebagai bukti.",
  "4. Pada jual / tukar tambah, penawaran bersifat estimasi. Harga final ditentukan setelah toko mengecek fisik HP; toko dapat mengajukan harga baru dan penjual berhak menolak.",
  "5. Toko wajib berlangganan sesuai ketentuan yang berlaku. Toko yang berulang kali melanggar dapat ditangguhkan.",
  "6. Pengguna bertanggung jawab atas kebenaran data, foto, dan IMEI yang dicantumkan.",
  "7. Pengelola: [ISI nama pengelola dan kontak]. Hukum yang berlaku dan penyelesaian sengketa: [ISI]."
]));
route("/privasi", () => legal("Kebijakan Privasi", [
  "1. Data yang kami simpan: nama, email, nomor HP, data rekening untuk pencairan dana, serta riwayat transaksi.",
  "2. Nomor HP dibagikan hanya kepada pihak yang bertransaksi dengan Anda.",
  "3. Data dipakai untuk menjalankan transaksi, mencegah penipuan, dan menyelesaikan komplain.",
  "4. Anda dapat meminta koreksi atau penghapusan data lewat [ISI kontak pengelola], sepanjang tidak bertentangan dengan kewajiban pencatatan transaksi.",
  "5. Data disimpan pada layanan Google Firebase."
]));
