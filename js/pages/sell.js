import { db, D, C, getDoc, getDocs, updateDoc, query, where, limit, onSnapshot, serverTimestamp, arrayUnion, writeBatch } from "../fb.js";
import { h, rp, field, run, toast, openModal, confirmBox, kv, note, safeUrl, videoOk, fmtDate, toMs, timeLeft, photoPicker, chips, statusTag, SELL_STATUS, waLink } from "../ui.js";
import { S, route, go, onLeave, requireLogin, isStaff, isOwner, storeActive, notify, audit, logEntry, getSettings, ts, sellerInc, loadProducts } from "../core.js";

const BRANDS = ["Apple", "Samsung", "Xiaomi", "Oppo", "Vivo", "Realme", "Infinix", "Tecno", "Google", "Lainnya"];
const COND = [["Mulus", "Mulus"], ["Lecet halus", "Lecet halus"], ["Ada cacat", "Ada cacat"]];
const KELENGKAPAN = ["Dus", "Charger", "Kabel", "Nota", "Earphone"];
const needLogin = () => h("div", { class: "card pad col" }, h("p", null, "Silakan masuk untuk melihat halaman ini."), h("button", { class: "btn pri", onClick: async () => { if (await requireLogin()) location.reload(); } }, "Masuk"));
const HOUR = 3600000, DAY = 86400000;

/* ---------- Form jual / tukar tambah ---------- */
route("/jual", async () => {
  const prods = await loadProducts().catch(() => []);
  const v = { brand: "Apple", cond: "Mulus", comp: new Set(["Dus", "Charger"]), trade: "" };
  const photos = [];
  const el = {
    model: h("input", { type: "text", placeholder: "Contoh: iPhone 12" }), storage: h("input", { type: "text", placeholder: "Contoh: 128 GB" }), imei: h("input", { type: "text", inputmode: "numeric", placeholder: "Ketik *#06# di HP untuk melihat IMEI" }),
    desc: h("textarea", { placeholder: "Kondisi, riwayat servis, kekurangan (jujur akan mempercepat penawaran)" }), video: h("input", { type: "url", placeholder: "Link video cacat TikTok/YouTube (opsional)" }), city: h("input", { type: "text", placeholder: "Kota Anda" }),
    start: h("input", { type: "number", inputmode: "numeric", placeholder: "Harga awal lelang (Rp)" }), min: h("input", { type: "number", inputmode: "numeric", placeholder: "Harga minimum (rahasia)" }), buy: h("input", { type: "number", inputmode: "numeric", placeholder: "Harga 'Beli sekarang' (opsional)" }),
    days: h("input", { type: "number", min: 1, max: 15, value: 3 })
  };
  const incNote = h("div", { class: "hint" }, "");
  el.start.addEventListener("input", () => { const p = Number(el.start.value); incNote.textContent = p > 0 ? "Kenaikan minimum tiap penawaran: " + rp(sellerInc(p)) : ""; });
  const comp = h("div", { class: "row" }, KELENGKAPAN.map((k) => h("label", { class: "chk" }, h("input", { type: "checkbox", checked: v.comp.has(k), onChange: (e) => (e.target.checked ? v.comp.add(k) : v.comp.delete(k)) }), k)));
  const trade = h("select", { onChange: (e) => (v.trade = e.target.value) }, h("option", { value: "" }, "Tidak, hanya jual"), prods.filter((p) => p.tradeIn).map((p) => h("option", { value: p.id }, p.title + " · " + rp(p.price) + " · " + p.storeName)));
  return h("div", { class: "col" }, h("h1", null, "Jual / Tukar Tambah"),
    note("Isi data dengan jujur. Toko-toko akan menawar, dan Anda memilih penawar tertinggi. Harga final ditentukan setelah toko mengecek fisik HP. Dana toko ditahan Rxgadget lebih dulu, lalu diteruskan kepada Anda setelah toko menyatakan ACC."),
    field("Merek", h("select", { onChange: (e) => (v.brand = e.target.value) }, BRANDS.map((b) => h("option", { value: b }, b)))), field("Tipe", el.model), field("Kapasitas", el.storage),
    field("Kondisi", chips(COND, v.cond, (x) => (v.cond = x))), field("Kelengkapan", comp), field("IMEI", el.imei, "Dipakai toko untuk memeriksa status HP."),
    field("Deskripsi", el.desc), field("Foto (min. 2, maks. 6)", photoPicker(photos, 6)), field("Link video cacat", el.video), field("Kota", el.city, "Toko di kota yang sama bisa bertemu langsung; toko luar kota memakai kiriman paket."),
    h("div", { class: "card pad" }, h("h3", null, "Pengaturan penawaran"), h("div", { style: { marginTop: "10px" } }, field("Harga awal", el.start), incNote, field("Harga minimum (rahasia)", el.min, "Toko tidak bisa melihat angka ini. Penawaran di bawah minimum tidak bisa Anda pilih."), field("Beli sekarang (opsional)", el.buy, "Jika diisi, toko mana pun yang menekan lebih dulu langsung menang."), field("Lama penawaran (hari, maks. 15)", el.days))),
    field("Tukar tambah (opsional)", trade, "Hanya info: sistem menampilkan perkiraan selisih terhadap HP incaran."),
    h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
      if (!(await requireLogin())) return;
      const start = Number(el.start.value), min = Number(el.min.value) || 0, buy = Number(el.buy.value) || 0, days = Math.round(Number(el.days.value));
      if (!el.model.value.trim() || !el.city.value.trim()) return toast("Tipe dan kota wajib diisi", "err");
      if (photos.length < 2) return toast("Unggah minimal 2 foto", "err");
      if (!(start >= 1000)) return toast("Harga awal tidak valid", "err");
      if (min && min < start) return toast("Harga minimum tidak boleh di bawah harga awal", "err");
      if (buy && buy <= start) return toast("Harga 'Beli sekarang' harus di atas harga awal", "err");
      if (!(days >= 1 && days <= 15)) return toast("Lama penawaran 1 sampai 15 hari", "err");
      if (el.video.value.trim() && !videoOk(el.video.value)) return toast("Link video harus dari YouTube atau TikTok", "err");
      const tp = prods.find((p) => p.id === v.trade);
      const id = crypto.randomUUID();
      const batch = writeBatch(db);
      batch.set(D("sellRequests", id), {
        sellerId: S.user.uid, sellerName: S.profile.name, brand: v.brand, model: el.model.value.trim(), storage: el.storage.value.trim(), os: v.brand === "Apple" ? "iOS" : "Android",
        title: (v.brand === "Lainnya" || el.model.value.toLowerCase().startsWith(v.brand.toLowerCase()) ? "" : v.brand + " ") + el.model.value.trim() + (el.storage.value.trim() ? " " + el.storage.value.trim() : ""),
        condition: v.cond, completeness: [...v.comp], imei: el.imei.value.trim(), description: el.desc.value.trim().slice(0, 800), photos, videoUrl: safeUrl(el.video.value), city: el.city.value.trim(),
        startPrice: start, increment: sellerInc(start), buyNowPrice: buy, tradeInProductId: tp?.id || "", tradeInTitle: tp?.title || "", tradeInPrice: tp?.price || 0,
        durationDays: days, endsAt: ts(Date.now() + days * DAY), status: "open", highestBid: 0, highestBidder: "", bidCount: 0, minReached: false, winnerStoreId: "", finalAmount: 0, failedStores: [],
        log: [logEntry("Pengajuan dibuat")], createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      batch.set(D("sellRequests", id, "private", "data"), { minPrice: min, sellerPhone: S.profile.phone, createdAt: serverTimestamp() });
      await batch.commit();
      toast("Pengajuan dibuka. Toko mulai bisa menawar."); go("/lelang/" + id);
    }) }, "Buka penawaran"));
});

/* ---------- Daftar pengajuan saya ---------- */
route("/pengajuan", async () => {
  if (!S.user) return needLogin();
  const snap = await getDocs(query(C("sellRequests"), where("sellerId", "==", S.user.uid), limit(100)));
  const rows = []; snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
  rows.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  return h("div", { class: "col" }, h("div", { class: "row sp" }, h("h1", null, "Pengajuan saya"), h("a", { class: "btn pri sm", href: "#/jual" }, "Jual HP")),
    rows.length ? rows.map((r) => h("a", { class: "item", href: "#/lelang/" + r.id }, h("div", null, h("div", { class: "b" }, r.title), h("div", { class: "mut xs" }, (r.highestBid ? "Tertinggi " + rp(r.highestBid) : "Belum ada penawaran") + " · " + r.bidCount + " penawaran")), statusTag(SELL_STATUS, r.status))) : h("p", { class: "mut" }, "Belum ada pengajuan."));
});

/* ---------- Daftar lelang untuk toko ---------- */
route("/lelang", async () => {
  if (!S.user) return needLogin();
  if (!S.store) return h("div", { class: "card pad col" }, h("p", null, "Halaman ini untuk toko. Daftarkan toko Anda untuk ikut menawar HP yang masuk."), h("a", { class: "btn pri", href: "#/daftar-toko" }, "Daftar sebagai Toko"));
  const [open, won] = await Promise.all([
    getDocs(query(C("sellRequests"), where("status", "==", "open"), limit(100))),
    getDocs(query(C("sellRequests"), where("winnerStoreId", "==", S.user.uid), limit(100)))
  ]);
  const a = []; open.forEach((d) => { const r = { id: d.id, ...d.data() }; if (toMs(r.endsAt) > Date.now() && r.sellerId !== S.user.uid) a.push(r); });
  const b = []; won.forEach((d) => b.push({ id: d.id, ...d.data() }));
  a.sort((x, y) => toMs(x.endsAt) - toMs(y.endsAt)); b.sort((x, y) => toMs(y.updatedAt) - toMs(x.updatedAt));
  const item = (r) => h("a", { class: "item", href: "#/lelang/" + r.id }, h("div", null, h("div", { class: "b" }, r.title), h("div", { class: "mut xs" }, `${r.city} · ${r.condition} · ` + (r.highestBid ? "Tertinggi " + rp(r.highestBid) : "Mulai " + rp(r.startPrice)))), r.status === "open" ? h("span", { class: "tag ok" }, timeLeft(r.endsAt)) : statusTag(SELL_STATUS, r.status));
  return h("div", { class: "col gap" }, h("h1", null, "HP masuk (lelang)"), !storeActive() ? note("Langganan toko tidak aktif, Anda belum bisa menawar.", "wr") : null,
    h("div", null, h("h2", null, "Terbuka untuk ditawar"), h("div", { class: "col", style: { marginTop: "10px" } }, a.length ? a.map(item) : h("p", { class: "mut" }, "Belum ada pengajuan terbuka."))),
    h("div", null, h("h2", null, "Yang Anda menangkan"), h("div", { class: "col", style: { marginTop: "10px" } }, b.length ? b.map(item) : h("p", { class: "mut" }, "Belum ada."))));
});

/* ---------- Detail pengajuan / lelang ---------- */
route("/lelang/:id", async ({ id }) => {
  if (!S.user) return needLogin();
  const root = h("div", { class: "col gap" });
  const cfg = await getSettings();
  let timer = null;
  const unsub = onSnapshot(D("sellRequests", id), (snap) => {
    if (!snap.exists()) return root.replaceChildren(h("div", { class: "card pad" }, "Pengajuan tidak ditemukan."));
    draw({ id, ...snap.data() });
  }, (e) => root.replaceChildren(h("div", { class: "card pad" }, "Tidak bisa membuka pengajuan ini. " + (e.message || ""))));
  onLeave(() => { unsub(); if (timer) clearInterval(timer); });
  const upd = (data, text) => updateDoc(D("sellRequests", id), { ...data, log: arrayUnion(logEntry(text)), updatedAt: serverTimestamp() });

  async function draw(r) {
    if (timer) clearInterval(timer);
    const uid = S.user.uid, isSeller = uid === r.sellerId, isWinner = uid === r.winnerStoreId, staff = isStaff();
    const ended = toMs(r.endsAt) <= Date.now();
    let priv = null;
    if (isSeller || isWinner || staff) { try { const p = await getDoc(D("sellRequests", id, "private", "data")); priv = p.exists() ? p.data() : null; } catch { /* tidak berhak */ } }
    const actions = h("div", { class: "col" });
    const A = (n) => actions.append(n);
    const sbtn = (label, cls, fn) => h("button", { class: "btn " + cls, onClick: (e) => run(e.currentTarget, fn) }, label);
    const qris = () => [h("img", { class: "qris", src: cfg.qrisImage, alt: "QRIS Rxgadget", onError: (e) => e.target.replaceWith(h("div", { class: "note wr" }, "QRIS belum dipasang pengelola.")) }), cfg.rekeningInfo ? h("div", { class: "note" }, cfg.rekeningInfo) : null];

    /* --- panel penawaran (toko) --- */
    if (r.status === "open" && !ended && !isSeller && storeActive()) {
      const next = r.bidCount === 0 ? r.startPrice : r.highestBid + r.increment;
      const amt = h("input", { type: "number", inputmode: "numeric", value: next });
      A(h("div", { class: "card pad col" }, h("h3", null, "Tawar HP ini"),
        r.highestBidder === uid ? note("Penawaran Anda sedang tertinggi.", "ok") : (r.bidCount ? note("Penawaran Anda belum tertinggi atau belum menawar.", "wr") : null),
        field("Penawaran Anda (Rp)", amt, "Minimal " + rp(next) + " (kenaikan " + rp(r.increment) + "). Penawaran di 5 menit terakhir menambah waktu 5 menit."),
        sbtn("Kirim penawaran", "pri", async () => {
          const val = Math.round(Number(amt.value));
          if (!(val >= next)) return toast("Penawaran minimal " + rp(next), "err");
          let ends = toMs(r.endsAt);
          if (ends - Date.now() < 5 * 60000) ends += 5 * 60000;
          const prev = r.highestBidder;
          const batch = writeBatch(db);
          batch.update(D("sellRequests", id), { highestBid: val, highestBidder: uid, bidCount: r.bidCount + 1, endsAt: ts(ends), updatedAt: serverTimestamp() });
          batch.set(D("sellRequests", id, "bids", crypto.randomUUID()), { storeId: uid, storeName: S.store.name, amount: val, createdAt: serverTimestamp() });
          await batch.commit();
          toast("Penawaran terkirim");
          if (r.bidCount === 0) notify(r.sellerId, "Penawaran pertama masuk untuk " + r.title, "/lelang/" + id);
          if (prev && prev !== uid) notify(prev, "Penawaran Anda untuk " + r.title + " disalip", "/lelang/" + id);
        }),
        r.buyNowPrice > 0 ? sbtn("Beli sekarang " + rp(r.buyNowPrice), "am", async () => {
          if (!(await confirmBox("Menang langsung dengan harga " + rp(r.buyNowPrice) + "? Anda wajib membayar ke Rxgadget dalam 24 jam."))) return;
          await upd({ status: "awaiting_store_payment", winnerStoreId: uid, finalAmount: r.buyNowPrice, payDeadline: ts(Date.now() + 24 * HOUR) }, "Toko " + S.store.name + " memakai Beli sekarang");
          notify(r.sellerId, "Toko memakai 'Beli sekarang' untuk " + r.title, "/lelang/" + id);
        }) : null));
    } else if (r.status === "open" && !isSeller && !staff && !storeActive()) A(note("Hanya toko dengan langganan aktif yang bisa menawar.", "wr"));

    /* --- penjual --- */
    if (isSeller) {
      if (r.status === "open" && r.bidCount === 0) A(sbtn("Batalkan pengajuan", "dng sm", async () => { if (await confirmBox("Batalkan pengajuan ini?")) await upd({ status: "cancelled" }, "Pengajuan dibatalkan penjual"); }));
      if (r.status === "open" && ended) {
        const minOk = r.bidCount > 0 && r.highestBid >= (priv?.minPrice || 0);
        if (minOk) {
          const sd = await getDoc(D("stores", r.highestBidder));
          A(h("div", { class: "card pad col" }, h("h3", null, "Penawaran selesai"), kv("Penawar tertinggi", sd.exists() ? sd.data().name : "-"), kv("Penawaran", rp(r.highestBid)), note("Pilih penawar tertinggi. Jika toko tersebut gagal membayar, pilihan lain akan terbuka."),
            sbtn("Pilih penawar tertinggi", "pri", async () => { await upd({ status: "awaiting_store_payment", winnerStoreId: r.highestBidder, finalAmount: r.highestBid, payDeadline: ts(Date.now() + 24 * HOUR) }, "Penjual memilih penawar tertinggi"); notify(r.highestBidder, "Anda memenangkan " + r.title + ". Bayar dalam 24 jam.", "/lelang/" + id); })));
        } else A(h("div", { class: "card pad col" }, h("h3", null, "Penawaran selesai"), note(r.bidCount ? "Penawaran tertinggi belum mencapai harga minimum Anda." : "Tidak ada penawar.", "wr"), sbtn("Tutup pengajuan", "", async () => { await upd({ status: "ended" }, "Pengajuan ditutup"); })));
      }
      if (r.status === "awaiting_store_payment") {
        A(note("Menunggu toko membayar ke Rxgadget sebelum " + fmtDate(r.payDeadline) + "."));
        if (Date.now() > toMs(r.payDeadline)) {
          A(sbtn("Toko tidak membayar, lanjut ke penawar berikutnya", "am", async () => {
            const bs = await getDocs(query(C("sellRequests", id, "bids"), limit(200)));
            const best = {}; bs.forEach((d) => { const b = d.data(); if (!best[b.storeId] || b.amount > best[b.storeId].amount) best[b.storeId] = b; });
            const failed = new Set([...(r.failedStores || []), r.winnerStoreId]);
            const cand = Object.values(best).filter((b) => !failed.has(b.storeId) && b.amount >= (priv?.minPrice || 0) && b.amount <= r.finalAmount).sort((a, b) => b.amount - a.amount)[0];
            if (!cand) { if (await confirmBox("Tidak ada penawar lain yang memenuhi syarat. Batalkan pengajuan?")) await upd({ status: "cancelled" }, "Tidak ada penawar lain, dibatalkan"); return; }
            await upd({ winnerStoreId: cand.storeId, finalAmount: cand.amount, payDeadline: ts(Date.now() + 24 * HOUR), failedStores: arrayUnion(r.winnerStoreId) }, "Pindah ke penawar berikutnya: " + rp(cand.amount));
            notify(r.winnerStoreId, "Anda tidak membayar tepat waktu untuk " + r.title, "/lelang/" + id);
            notify(cand.storeId, "Anda mendapat kesempatan memenangkan " + r.title, "/lelang/" + id);
          }));
        }
      }
      if (r.status === "awaiting_handover") {
        const trk = h("input", { type: "text", placeholder: "Nomor resi (jika dikirim)" });
        const wd = await getDoc(D("stores", r.winnerStoreId)); const w = wd.exists() ? wd.data() : {};
        A(h("div", { class: "card pad col" }, h("h3", null, "Serahkan HP ke toko"), note("Batas penyerahan: " + fmtDate(r.handoverDeadline) + ". Lewat batas itu transaksi bisa dibatalkan toko dan dana toko dikembalikan.", "wr"),
          kv("Toko", w.name || "-"), kv("Kota toko", w.city || "-"), kv("Alamat", w.address || "-"), w.whatsapp ? kv("WhatsApp", h("a", { href: waLink(w.whatsapp), target: "_blank", rel: "noopener" }, w.whatsapp)) : null,
          note(w.city && w.city.toLowerCase() === (r.city || "").toLowerCase() ? "Toko satu kota dengan Anda: bisa bertemu langsung." : "Toko di kota lain: kirim paket. Rekam video saat mengemas HP."),
          field("Resi", trk), sbtn("Tandai HP sudah diserahkan / dikirim", "pri", async () => { await upd({ status: "handed_over", handover: { tracking: trk.value.trim(), at: Date.now() } }, "Penjual menyerahkan / mengirim HP"); notify(r.winnerStoreId, "HP " + r.title + " sudah diserahkan / dikirim", "/lelang/" + id); })));
      }
      if (r.status === "repricing") A(h("div", { class: "card pad col" }, h("h3", null, "Toko mengajukan harga baru"), kv("Harga semula", rp(r.finalAmount)), kv("Harga baru", rp(r.reprice?.price)), h("p", null, r.reprice?.reason), safeUrl(r.reprice?.evidenceUrl) ? h("a", { href: safeUrl(r.reprice.evidenceUrl), target: "_blank", rel: "noopener" }, "Lihat bukti") : null,
        sbtn("Setuju harga baru", "pri", async () => { await upd({ status: "acc", finalAmount: r.reprice.price }, "Penjual menyetujui harga baru"); notify(r.winnerStoreId, "Penjual menyetujui harga baru untuk " + r.title, "/lelang/" + id); }),
        sbtn("Tolak, HP dikembalikan", "dng", async () => { await upd({ status: "returning" }, "Penjual menolak harga baru, HP dikembalikan"); notify(r.winnerStoreId, "Penjual menolak harga baru. HP dikembalikan.", "/lelang/" + id); })));
      if (r.status === "acc" || r.status === "payout_done") { const rv = await getDoc(D("reviews", "sr_" + id)); if (!rv.exists()) { const { reviewForm } = await import("./account.js"); A(reviewForm("sr_" + id, r.winnerStoreId, "jual")); } }
    }

    /* --- toko pemenang --- */
    if (isWinner) {
      if (r.status === "awaiting_store_payment") {
        const proof = [];
        A(h("div", { class: "card pad col" }, h("h3", null, "Bayar ke Rxgadget"), kv("Jumlah", rp(r.finalAmount)), kv("Batas bayar", fmtDate(r.payDeadline)), ...qris(), photoPicker(proof, 1),
          note("Dana ditahan Rxgadget dan diteruskan ke penjual setelah Anda menekan ACC.", "wr"),
          sbtn("Kirim bukti bayar", "pri", async () => { if (!proof.length) return toast("Unggah bukti bayar", "err"); await upd({ status: "store_payment_submitted", storeProofUrl: proof[0] }, "Toko mengunggah bukti bayar"); })));
      }
      if (r.status === "awaiting_handover") {
        A(note("Dana sudah diterima Rxgadget. Menunggu penjual menyerahkan HP sebelum " + fmtDate(r.handoverDeadline) + "."));
        if (priv?.sellerPhone) A(h("a", { class: "btn out sm", href: waLink(priv.sellerPhone, "Halo, saya dari toko " + S.store.name + " terkait " + r.title + " di Rxgadget."), target: "_blank", rel: "noopener" }, "Hubungi penjual"));
        if (Date.now() > toMs(r.handoverDeadline)) A(sbtn("Penjual tidak menyerahkan, batalkan (dana dikembalikan)", "dng", async () => { if (await confirmBox("Batalkan transaksi? Dana Anda akan dikembalikan pengelola.")) await upd({ status: "cancelled_paid" }, "Toko membatalkan karena HP tidak diserahkan"); }));
      }
      if (r.status === "handed_over") {
        A(h("div", { class: "card pad col" }, h("h3", null, "Cek HP"), r.handover?.tracking ? kv("Resi", r.handover.tracking) : null, priv?.sellerPhone ? kv("Kontak penjual", priv.sellerPhone) : null,
          note("Cek fisik HP, bandingkan dengan deskripsi dan foto. Jika sesuai tekan ACC. Jika berbeda, ajukan harga baru dengan bukti."),
          sbtn("ACC, HP sesuai", "pri", async () => { await upd({ status: "acc" }, "Toko menyatakan ACC"); notify(r.sellerId, "Toko ACC untuk " + r.title + ". Dana segera ditransfer.", "/lelang/" + id); }),
          h("button", { class: "btn am", onClick: () => {
            const price = h("input", { type: "number", inputmode: "numeric" }); const why = h("textarea", { placeholder: "Alasan (min. 20 huruf)" }); const ev = h("input", { type: "url", placeholder: "Link foto/video bukti (opsional)" });
            openModal("Ajukan harga baru", h("div", null, note("Harga baru harus lebih rendah dari " + rp(r.finalAmount) + ". Penjual berhak menolak dan HP dikembalikan.", "wr"), field("Harga baru (Rp)", price), field("Alasan", why), field("Bukti", ev)), (close) => [h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
              const pr = Math.round(Number(price.value));
              if (!(pr > 0 && pr < r.finalAmount)) return toast("Harga baru harus lebih rendah dari harga semula", "err");
              if (why.value.trim().length < 20) return toast("Alasan terlalu singkat", "err");
              await upd({ status: "repricing", reprice: { price: pr, reason: why.value.trim(), evidenceUrl: safeUrl(ev.value) } }, "Toko mengajukan harga baru " + rp(pr));
              notify(r.sellerId, "Toko mengajukan harga baru untuk " + r.title, "/lelang/" + id); close();
            }) }, "Kirim")]);
          } }, "Ajukan harga baru")));
      }
    }

    /* --- admin & owner --- */
    if (staff) {
      if (r.status === "store_payment_submitted") A(h("div", { class: "card pad col" }, h("h3", null, "Periksa pembayaran toko"), safeUrl(r.storeProofUrl) ? h("a", { href: safeUrl(r.storeProofUrl), target: "_blank", rel: "noopener" }, h("img", { src: safeUrl(r.storeProofUrl), alt: "Bukti", style: { maxWidth: "260px", borderRadius: "10px" } })) : null, h("p", { class: "mut sm" }, "Cocokkan nominal " + rp(r.finalAmount) + " dengan mutasi."),
        sbtn("Dana sudah diterima", "pri", async () => { await upd({ status: "awaiting_handover", handoverDeadline: ts(Date.now() + 3 * DAY) }, "Pengelola mengonfirmasi dana toko diterima"); await audit("konfirmasi_bayar_toko", "sellRequests/" + id); notify(r.sellerId, "Dana toko sudah diterima. Serahkan HP dalam 3 hari.", "/lelang/" + id); notify(r.winnerStoreId, "Dana diterima. Menunggu penjual menyerahkan HP.", "/lelang/" + id); }),
        sbtn("Bukti tidak sesuai", "dng sm", async () => { await upd({ status: "awaiting_store_payment" }, "Bukti bayar toko ditolak"); await audit("tolak_bukti_toko", "sellRequests/" + id); notify(r.winnerStoreId, "Bukti bayar belum sesuai, unggah ulang", "/lelang/" + id); })));
      if (r.status === "acc") {
        const sd = await getDoc(D("users", r.sellerId)); const bk = sd.exists() ? sd.data().bank : null;
        A(h("div", { class: "card pad col" }, h("h3", null, "Teruskan dana ke penjual"), kv("Jumlah", rp(r.finalAmount)), bk?.accountNo ? kv("Rekening penjual", `${bk.bankName} · ${bk.accountNo} · ${bk.accountName}`) : note("Penjual belum mengisi rekening di Profil. Hubungi: " + (priv?.sellerPhone || "-"), "wr"),
          isOwner() ? sbtn("Dana sudah saya transfer ke penjual", "pri", async () => { await upd({ status: "payout_done" }, "Owner mentransfer dana ke penjual"); await audit("payout_penjual", "sellRequests/" + id); notify(r.sellerId, "Dana penjualan " + r.title + " sudah ditransfer", "/lelang/" + id); }) : note("Transfer dana hanya dapat dilakukan owner.")));
      }
      if (r.status === "returning" || r.status === "cancelled_paid") {
        const sd = await getDoc(D("users", r.winnerStoreId)); const bk = sd.exists() ? sd.data().bank : null;
        A(h("div", { class: "card pad col" }, h("h3", null, "Kembalikan dana toko"), kv("Jumlah", rp(r.finalAmount)), bk?.accountNo ? kv("Rekening toko", `${bk.bankName} · ${bk.accountNo} · ${bk.accountName}`) : note("Toko belum mengisi rekening di Profil.", "wr"),
          isOwner() ? sbtn("Dana toko sudah saya kembalikan", "pri", async () => { await upd({ status: "refunded" }, "Owner mengembalikan dana toko"); await audit("refund_toko", "sellRequests/" + id); }) : note("Refund hanya dapat dilakukan owner.")));
      }
    }

    /* --- tampilan utama --- */
    const photos = (r.photos || []).map(safeUrl).filter(Boolean);
    const bidsBox = h("div", { class: "card pad" }, h("h3", null, "Penawaran"));
    const tl = h("span", { class: "tag ok" }, timeLeft(r.endsAt));
    if (r.status === "open" && !ended) timer = setInterval(() => { tl.textContent = timeLeft(r.endsAt); if (toMs(r.endsAt) <= Date.now()) { clearInterval(timer); draw(r); } }, 1000);
    bidsBox.append(kv("Harga awal", rp(r.startPrice)), kv("Penawaran tertinggi", r.bidCount ? rp(r.highestBid) : "Belum ada"), kv("Jumlah penawaran", r.bidCount), kv("Kenaikan minimum", rp(r.increment)),
      isSeller && priv ? kv("Harga minimum Anda", rp(priv.minPrice) + (r.bidCount ? (r.highestBid >= priv.minPrice ? " (tercapai)" : " (belum tercapai)") : "")) : kv("Harga minimum", "Rahasia"),
      r.buyNowPrice ? kv("Beli sekarang", rp(r.buyNowPrice)) : null, r.status === "open" ? kv("Sisa waktu", tl) : null,
      r.tradeInProductId ? kv("Tukar tambah dengan", h("a", { href: "#/produk/" + r.tradeInProductId }, r.tradeInTitle + " (" + rp(r.tradeInPrice) + ")")) : null,
      r.tradeInProductId && r.bidCount ? kv("Perkiraan selisih", rp(Math.max(0, r.tradeInPrice - r.highestBid))) : null);
    if (isSeller || staff) {
      const list = h("div", { class: "col", style: { marginTop: "8px" } });
      bidsBox.append(list);
      getDocs(query(C("sellRequests", id, "bids"), limit(100))).then((bs) => { const rows = []; bs.forEach((d) => rows.push(d.data())); rows.sort((a, b) => b.amount - a.amount); list.replaceChildren(...rows.slice(0, 20).map((b) => h("div", { class: "kv" }, h("span", null, b.storeName), h("span", null, rp(b.amount))))); }).catch(() => {});
    }
    root.replaceChildren(
      h("div", { class: "row sp" }, h("h1", null, r.title), statusTag(SELL_STATUS, r.status)),
      photos.length ? h("div", { class: "gal" }, photos.map((u) => h("img", { src: u, alt: r.title, loading: "lazy" }))) : null,
      actions, bidsBox,
      h("div", { class: "card pad" }, kv("Kondisi", r.condition), kv("Kapasitas", r.storage || "-"), kv("Kelengkapan", (r.completeness || []).join(", ") || "-"), kv("IMEI", r.imei ? "Dicantumkan penjual" : "Tidak dicantumkan"), kv("Kota penjual", r.city), kv("Penjual", isSeller || staff ? r.sellerName : "Pengguna Rxgadget"), r.description ? kv("Deskripsi", r.description) : null,
        safeUrl(r.videoUrl) ? h("a", { class: "btn out sm", style: { marginTop: "10px" }, href: safeUrl(r.videoUrl), target: "_blank", rel: "noopener" }, "Tonton video cacat") : null),
      note("Penawaran bersifat estimasi. Harga final ditentukan setelah toko mengecek fisik HP."),
      (isSeller || isWinner || staff) ? h("div", { class: "card pad" }, h("h3", null, "Riwayat"), h("div", { class: "tl", style: { marginTop: "8px" } }, (r.log || []).slice().reverse().map((l) => h("div", null, h("b", null, fmtDate(l.t)), " · ", l.by, ": ", l.text)))) : null,
      h("a", { href: isSeller ? "#/pengajuan" : "#/lelang", class: "sm" }, "← Kembali"));
  }
  return root;
});
