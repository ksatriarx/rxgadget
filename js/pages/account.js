import { D, C, getDoc, getDocs, setDoc, updateDoc, query, where, limit, onSnapshot, serverTimestamp, arrayUnion } from "../fb.js";
import { h, rp, field, run, toast, openModal, confirmBox, kv, note, safeUrl, videoOk, fmtDate, toMs, photoPicker, uploadImageFile, statusTag, ORDER_STATUS, waLink } from "../ui.js";
import { S, route, go, onLeave, requireLogin, isStaff, isOwner, notify, audit, logEntry, getSettings, logout } from "../core.js";

const needLogin = () => h("div", { class: "card pad col" }, h("p", null, "Silakan masuk untuk melihat halaman ini."), h("button", { class: "btn pri", onClick: async () => { if (await requireLogin()) location.reload(); } }, "Masuk"));

/* ---------- Profil & Tarik dana ---------- */
route("/profil", async () => {
  if (!S.user) return needLogin();
  const p = S.profile || {};
  const b = p.bank || {};
  const name = h("input", { type: "text", value: p.name || "" });
  const phone = h("input", { type: "tel", value: p.phone || "" });
  const bank = h("input", { type: "text", value: b.bankName || "", placeholder: "Contoh: BCA / BRI / Mandiri / DANA" });
  const no = h("input", { type: "text", value: b.accountNo || "", inputmode: "numeric" });
  const an = h("input", { type: "text", value: b.accountName || "" });
  const saveAll = async (e) => run(e.currentTarget, async () => {
    if (!name.value.trim() || !phone.value.trim()) return toast("Nama dan nomor HP wajib diisi", "err");
    await setDoc(D("users", S.user.uid), { name: name.value.trim(), phone: phone.value.replace(/[\s-]/g, ""), bank: { bankName: bank.value.trim(), accountNo: no.value.trim(), accountName: an.value.trim() }, updatedAt: serverTimestamp() }, { merge: true });
    S.profile = { ...S.profile, name: name.value.trim(), phone: phone.value.trim(), bank: { bankName: bank.value, accountNo: no.value, accountName: an.value } };
    toast("Profil disimpan");
  });
  return h("div", { class: "col gap" }, h("h1", null, "Profil"),
    h("div", { class: "card pad" }, h("h3", null, "Data diri"), h("div", { style: { marginTop: "10px" } }, field("Nama", name), field("Nomor HP / WhatsApp", phone), kv("Email", p.email || S.user.email))),
    h("div", { class: "card pad" }, h("h3", null, "Tarik dana"), h("p", { class: "mut sm", style: { margin: "4px 0 10px" } }, "Rekening ini menjadi tujuan transfer dari Rxgadget (pencairan dana toko atau penjual HP, atau refund pembeli). Pastikan atas nama sendiri."),
      field("Bank / e-wallet", bank), field("Nomor rekening", no), field("Atas nama", an)),
    h("div", { class: "row" }, h("button", { class: "btn pri", onClick: saveAll }, "Simpan"), h("button", { class: "btn", onClick: () => logout() }, "Keluar")));
});

/* ---------- Daftar pesanan ---------- */
route("/pesanan", async () => {
  if (!S.user) return needLogin();
  const [a, b] = await Promise.all([
    getDocs(query(C("orders"), where("buyerId", "==", S.user.uid), limit(100))),
    S.store ? getDocs(query(C("orders"), where("storeId", "==", S.user.uid), limit(100))) : Promise.resolve(null)
  ]);
  const rows = (snap) => { const r = []; snap?.forEach((d) => r.push({ id: d.id, ...d.data() })); return r.sort((x, y) => toMs(y.createdAt) - toMs(x.createdAt)); };
  const item = (o, who) => h("a", { class: "item", href: "#/pesanan/" + o.id }, h("div", null, h("div", { class: "b" }, o.productTitle), h("div", { class: "mut xs" }, who + " · " + rp(o.price) + " · " + fmtDate(o.createdAt))), statusTag(ORDER_STATUS, o.status));
  const mine = rows(a), sold = rows(b);
  return h("div", { class: "col gap" }, h("h1", null, "Pesanan"),
    h("div", null, h("h2", null, "Pembelian saya"), h("div", { class: "col", style: { marginTop: "10px" } }, mine.length ? mine.map((o) => item(o, o.storeName)) : h("p", { class: "mut" }, "Belum ada pembelian."))),
    S.store ? h("div", null, h("h2", null, "Penjualan toko saya"), h("div", { class: "col", style: { marginTop: "10px" } }, sold.length ? sold.map((o) => item(o, "Pembeli: " + o.buyerName)) : h("p", { class: "mut" }, "Belum ada pesanan masuk."))) : null);
});

/* ---------- Detail pesanan (pembeli / toko / admin) ---------- */
route("/pesanan/:id", async ({ id }) => {
  if (!S.user) return needLogin();
  const root = h("div", { class: "col gap" });
  const cfg = await getSettings();
  const unsub = onSnapshot(D("orders", id), (snap) => {
    if (!snap.exists()) return root.replaceChildren(h("div", { class: "card pad" }, "Pesanan tidak ditemukan."));
    draw({ id, ...snap.data() });
  }, (e) => root.replaceChildren(h("div", { class: "card pad" }, "Tidak bisa membuka pesanan ini. " + (e.message || ""))));
  onLeave(unsub);

  const upd = (data, text) => updateDoc(D("orders", id), { ...data, log: arrayUnion(logEntry(text)), updatedAt: serverTimestamp() });

  async function draw(o) {
    const isBuyer = S.user.uid === o.buyerId, isStore = S.user.uid === o.storeId, staff = isStaff();
    const deadline = o.receivedAt ? toMs(o.receivedAt) + 7 * 86400000 : 0;
    const actions = h("div", { class: "col" });
    const A = (n) => actions.append(n);

    /* pembeli */
    if (isBuyer && o.status === "awaiting_payment") {
      const proof = [];
      A(h("div", { class: "card pad col" }, h("h3", null, "Bayar ke Rxgadget"), kv("Jumlah", rp(o.price)),
        h("img", { class: "qris", src: cfg.qrisImage, alt: "QRIS Rxgadget", onError: (e) => e.target.replaceWith(h("div", { class: "note wr" }, "QRIS belum dipasang oleh pengelola.")) }),
        cfg.rekeningInfo ? h("div", { class: "note" }, cfg.rekeningInfo) : null,
        h("p", { class: "mut sm" }, "Setelah membayar, unggah bukti transfer. Pengelola akan memeriksa dan mengonfirmasi dana."), photoPicker(proof, 1),
        h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
          if (!proof.length) return toast("Unggah bukti bayar dulu", "err");
          await upd({ status: "payment_submitted", paymentProofUrl: proof[0] }, "Pembeli mengunggah bukti bayar");
        }) }, "Kirim bukti bayar"),
        h("button", { class: "btn dng sm", onClick: async (e) => { if (await confirmBox("Batalkan pesanan ini?")) run(e.currentTarget, () => upd({ status: "cancelled" }, "Pesanan dibatalkan pembeli")); } }, "Batalkan pesanan")));
    }
    if (isBuyer && o.status === "handed") {
      const vid = h("input", { type: "url", placeholder: "Link video unboxing TikTok/YouTube (wajib untuk paket)" });
      A(h("div", { class: "card pad col" }, h("h3", null, "HP sudah Anda terima?"),
        o.method === "kirim" ? field("Video saat membuka paket", vid, "Wajib sebagai bukti jika ada komplain. Unggah ke TikTok/YouTube lalu tempel link-nya.") : null,
        note("Setelah ditandai diterima, masa komplain 7 hari dimulai.", "wr"),
        h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
          if (o.method === "kirim" && !videoOk(vid.value)) return toast("Tempel link video unboxing yang valid (YouTube / TikTok)", "err");
          await upd({ status: "received", receivedAt: serverTimestamp(), unboxingUrl: o.method === "kirim" ? safeUrl(vid.value) : "" }, "Pembeli menandai HP sudah diterima");
          await notify(o.storeId, "HP " + o.productTitle + " ditandai diterima pembeli", "/pesanan/" + id);
        }) }, "Ya, HP sudah diterima")));
    }
    if (isBuyer && o.status === "received") {
      const open = Date.now() < deadline;
      A(h("div", { class: "card pad col" }, h("h3", null, "Cek HP Anda"),
        h("p", { class: "mut sm" }, open ? "Masa komplain sampai " + fmtDate(deadline) + "." : "Masa komplain sudah berakhir."),
        h("button", { class: "btn pri", onClick: async (e) => { if (await confirmBox("Dana akan diteruskan ke toko. Yakin Anda puas dengan HP ini?", "Saya puas")) run(e.currentTarget, async () => { await upd({ status: "satisfied" }, "Pembeli menyatakan puas"); await notify(o.storeId, "Pembeli puas atas " + o.productTitle, "/pesanan/" + id); }); } }, "Saya puas"),
        open ? h("button", { class: "btn dng", onClick: () => {
          const reason = h("textarea", { placeholder: "Jelaskan bagian yang tidak sesuai dengan deskripsi, foto/video, atau health card (min. 20 huruf)" });
          const ev = h("input", { type: "url", placeholder: "Link video / bukti pendukung" });
          openModal("Ajukan komplain", h("div", null, note("Komplain hanya sah jika HP tidak sesuai deskripsi, foto/video, atau health card.", "wr"), field("Alasan", reason), field("Bukti (link video)", ev)), (close) => [h("button", { class: "btn dng", onClick: (e) => run(e.currentTarget, async () => {
            if (reason.value.trim().length < 20) return toast("Alasan terlalu singkat", "err");
            await upd({ status: "complaint", complaint: { reason: reason.value.trim(), evidenceUrl: safeUrl(ev.value), at: Date.now() } }, "Pembeli mengajukan komplain");
            await notify(o.storeId, "Komplain diajukan untuk " + o.productTitle, "/pesanan/" + id);
            close();
          }) }, "Kirim komplain")]);
        } }, "Ajukan komplain") : null));
    }
    if (isBuyer && (o.status === "satisfied" || o.status === "payout_done")) {
      const done = await getDoc(D("reviews", id));
      if (!done.exists()) A(reviewForm(id, o.storeId, "beli"));
    }

    /* toko */
    if (isStore && o.status === "paid") {
      const trk = h("input", { type: "text", placeholder: "Nomor resi / kurir" });
      const pk = h("input", { type: "url", placeholder: "Link video packing (disarankan)" });
      const imei = h("input", { type: "text", placeholder: "IMEI HP yang diserahkan (disarankan)" });
      A(h("div", { class: "card pad col" }, h("h3", null, "Serahkan HP ke pembeli"), h("p", { class: "mut sm" }, o.method === "kirim" ? "Pembeli memilih dikirim. Alamat: " + o.address : "Pembeli memilih bertemu / mengambil di toko."),
        o.method === "kirim" ? field("Resi", trk) : null, field("Video packing (tidak wajib)", pk), field("IMEI (tidak wajib)", imei),
        note("Disarankan merekam video packing dan mencatat IMEI sebagai bukti bila ada pelanggan bermasalah. Jika tidak, risiko ada pada toko.", "wr"),
        h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
          if (o.method === "kirim" && !trk.value.trim()) return toast("Isi nomor resi", "err");
          await upd({ status: "handed", handover: { method: o.method, tracking: trk.value.trim(), packingUrl: safeUrl(pk.value), imeiNote: imei.value.trim(), at: Date.now() } }, "Toko menyerahkan / mengirim HP");
          await notify(o.buyerId, "HP " + o.productTitle + " sudah diserahkan / dikirim toko", "/pesanan/" + id);
        }) }, o.method === "kirim" ? "Tandai sudah dikirim" : "Tandai sudah diserahkan")));
    }

    /* admin & owner */
    if (staff) {
      const sbtn = (label, cls, fn) => h("button", { class: "btn " + cls, onClick: (e) => run(e.currentTarget, fn) }, label);
      if (o.status === "payment_submitted") A(h("div", { class: "card pad col" }, h("h3", null, "Periksa pembayaran"),
        safeUrl(o.paymentProofUrl) ? h("a", { href: safeUrl(o.paymentProofUrl), target: "_blank", rel: "noopener" }, h("img", { src: safeUrl(o.paymentProofUrl), alt: "Bukti bayar", style: { maxWidth: "260px", borderRadius: "10px" } })) : null,
        h("p", { class: "mut sm" }, "Cocokkan nominal " + rp(o.price) + " dengan mutasi rekening/QRIS sebelum mengonfirmasi."),
        sbtn("Dana sudah diterima", "pri", async () => { await upd({ status: "paid" }, "Pengelola mengonfirmasi dana diterima"); await updateDoc(D("products", o.productId), { status: "reserved", updatedAt: serverTimestamp() }); await audit("konfirmasi_bayar", "orders/" + id); await notify(o.storeId, "Dana diterima. Silakan serahkan HP " + o.productTitle, "/pesanan/" + id); }),
        sbtn("Bukti tidak sesuai", "dng sm", async () => { await upd({ status: "awaiting_payment" }, "Bukti bayar ditolak pengelola"); await audit("tolak_bukti", "orders/" + id); await notify(o.buyerId, "Bukti bayar belum sesuai, unggah ulang", "/pesanan/" + id); })));
      if (o.status === "complaint") A(h("div", { class: "card pad col" }, h("h3", null, "Tinjau komplain"), h("p", null, o.complaint?.reason), safeUrl(o.complaint?.evidenceUrl) ? h("a", { href: safeUrl(o.complaint.evidenceUrl), target: "_blank", rel: "noopener" }, "Buka bukti") : null,
        o.unboxingUrl ? h("a", { href: safeUrl(o.unboxingUrl), target: "_blank", rel: "noopener" }, "Video unboxing pembeli") : null,
        sbtn("Setujui komplain (HP kembali, refund)", "dng", async () => { await upd({ status: "complaint_approved" }, "Komplain disetujui"); await audit("komplain_setuju", "orders/" + id); await notify(o.buyerId, "Komplain Anda disetujui", "/pesanan/" + id); }),
        sbtn("Tolak komplain", "", async () => { await upd({ status: "complaint_rejected" }, "Komplain ditolak"); await audit("komplain_tolak", "orders/" + id); await notify(o.buyerId, "Komplain Anda ditolak", "/pesanan/" + id); })));
      const payoutReady = o.status === "satisfied" || o.status === "complaint_rejected" || (o.status === "received" && Date.now() > deadline);
      if (payoutReady) {
        const st = await getDoc(D("users", o.storeId)); const bk = st.exists() ? st.data().bank : null;
        A(h("div", { class: "card pad col" }, h("h3", null, "Teruskan dana ke toko"), kv("Jumlah", rp(o.price)),
          bk?.accountNo ? kv("Rekening toko", `${bk.bankName} · ${bk.accountNo} · ${bk.accountName}`) : note("Toko belum mengisi rekening di Profil > Tarik dana.", "wr"),
          isOwner() ? sbtn("Dana sudah saya transfer ke toko", "pri", async () => { await upd({ status: "payout_done" }, "Owner mentransfer dana ke toko"); await updateDoc(D("products", o.productId), { status: "sold", updatedAt: serverTimestamp() }); await audit("payout_toko", "orders/" + id); await notify(o.storeId, "Dana penjualan " + o.productTitle + " sudah ditransfer", "/pesanan/" + id); }) : note("Transfer dana hanya dapat dilakukan owner.")));
      }
      if (o.status === "complaint_approved") {
        const bu = await getDoc(D("users", o.buyerId)); const bk = bu.exists() ? bu.data().bank : null;
        A(h("div", { class: "card pad col" }, h("h3", null, "Refund ke pembeli"), kv("Jumlah", rp(o.price)),
          bk?.accountNo ? kv("Rekening pembeli", `${bk.bankName} · ${bk.accountNo} · ${bk.accountName}`) : note("Pembeli belum mengisi rekening. Minta lewat WhatsApp: " + (o.buyerPhone || "-"), "wr"),
          isOwner() ? sbtn("Refund sudah saya transfer", "pri", async () => { await upd({ status: "refund_done" }, "Owner mengembalikan dana ke pembeli"); await updateDoc(D("products", o.productId), { status: "active", updatedAt: serverTimestamp() }); await audit("refund_pembeli", "orders/" + id); }) : note("Refund hanya dapat dilakukan owner.")));
      }
      if (["awaiting_payment", "payment_submitted", "paid"].includes(o.status)) A(sbtn("Batalkan pesanan (staf)", "dng sm", async () => { if (await confirmBox("Batalkan pesanan ini? Jika dana sudah diterima, refund harus dilakukan manual.")) { await upd({ status: "cancelled" }, "Pesanan dibatalkan pengelola"); await updateDoc(D("products", o.productId), { status: "active", updatedAt: serverTimestamp() }).catch(() => {}); await audit("batal_pesanan", "orders/" + id); } }));
    }

    const log = (o.log || []).slice().reverse();
    root.replaceChildren(
      h("div", { class: "row sp" }, h("h1", null, o.productTitle), statusTag(ORDER_STATUS, o.status)),
      h("div", { class: "card pad" }, kv("Harga", rp(o.price)), kv("Toko", h("a", { href: "#/toko/" + o.storeId }, o.storeName)), kv("Pembeli", o.buyerName), (isStore || staff) ? kv("Kontak pembeli", h("a", { href: waLink(o.buyerPhone), target: "_blank", rel: "noopener" }, o.buyerPhone)) : null, kv("Serah terima", o.method === "kirim" ? "Dikirim paket" : "Bertemu / ambil di toko"), o.address && (isStore || staff || isBuyer) ? kv("Alamat", o.address) : null, o.handover?.tracking ? kv("Resi", o.handover.tracking) : null, o.handover?.packingUrl ? kv("Video packing", h("a", { href: safeUrl(o.handover.packingUrl), target: "_blank", rel: "noopener" }, "Buka")) : null, deadline ? kv("Batas komplain", fmtDate(deadline)) : null),
      actions,
      h("div", { class: "card pad" }, h("h3", null, "Riwayat"), h("div", { class: "tl", style: { marginTop: "8px" } }, log.map((l) => h("div", null, h("b", null, fmtDate(l.t)), " · ", l.by, ": ", l.text)))),
      h("a", { href: "#/pesanan", class: "sm" }, "← Semua pesanan"));
  }
  return root;
});

/* ---------- Form ulasan ---------- */
export function reviewForm(docId, storeId, kind) {
  let rating = 5;
  const sel = h("select", { onChange: (e) => (rating = Number(e.target.value)) }, [5, 4, 3, 2, 1].map((n) => h("option", { value: n }, "★".repeat(n))));
  const cm = h("textarea", { placeholder: "Ceritakan pengalaman Anda (opsional)" });
  return h("div", { class: "card pad col" }, h("h3", null, "Beri ulasan untuk toko"), sel, cm,
    h("button", { class: "btn pri", onClick: (e) => run(e.currentTarget, async () => {
      await setDoc(D("reviews", docId), { storeId, reviewerId: S.user.uid, reviewerName: S.profile?.name || "Pengguna", rating, comment: cm.value.trim().slice(0, 400), kind, createdAt: serverTimestamp() });
      toast("Terima kasih atas ulasannya"); e.target.closest(".card").remove();
    }) }, "Kirim ulasan"));
}

/* ---------- Notifikasi ---------- */
route("/notifikasi", async () => {
  if (!S.user) return needLogin();
  const snap = await getDocs(query(C("notifications"), where("toUid", "==", S.user.uid), limit(60)));
  const rows = []; snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
  rows.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  rows.filter((r) => !r.read).forEach((r) => updateDoc(D("notifications", r.id), { read: true }).catch(() => {}));
  document.dispatchEvent(new CustomEvent("notif-read"));
  return h("div", { class: "col" }, h("h1", null, "Notifikasi"), rows.length ? rows.map((r) => h("a", { class: "item", href: "#" + (r.link || "/notifikasi") }, h("div", null, h("div", { class: r.read ? "" : "b" }, r.text), h("div", { class: "mut xs" }, fmtDate(r.createdAt))), r.read ? null : h("span", { class: "tag ok" }, "Baru"))) : h("p", { class: "mut" }, "Belum ada notifikasi."));
});
void go; void uploadImageFile;
