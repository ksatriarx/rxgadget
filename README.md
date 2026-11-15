# Rxgadget – Tahap 1

Situs statis (tanpa build). Cukup unggah semua file ke repositori GitHub, hubungkan ke Cloudflare Pages.

## 1. Unggah ke GitHub (dari HP)
Buka github.com/ksatriarx/rxgadget → Add file → Upload files. Pertahankan struktur folder: `index.html`, `firebase-config.js`, `firestore.rules`, `storage.rules`, folder `css/`, `js/`, `js/pages/`, `assets/`. (Jika upload folder sulit di HP, buat file satu per satu lewat Add file → Create new file, ketik nama lengkap dengan garis miring, misalnya `js/pages/admin.js`, lalu tempel isinya.)

## 2. Firebase (console.firebase.google.com)
1. Create project → Add app → Web (`</>`). Salin `firebaseConfig`, tempel ke `firebase-config.js` (ganti semua "ISI").
2. Authentication → Sign-in method → aktifkan **Google**. Settings → Authorized domains → tambahkan domain `xxx.pages.dev` dari Cloudflare.
3. Firestore Database → Create (mode production, lokasi asia-southeast2) → tab **Rules** → tempel isi `firestore.rules` → Publish.
4. Storage → Get started → tab **Rules** → tempel isi `storage.rules` → Publish. (Jika Storage tidak tersedia di paket gratis, foto tetap bisa ditempel sebagai link gambar.)

## 3. Jadikan dirimu Owner
1. Buka situs, login Google sekali (supaya akun terbentuk).
2. Firebase → Authentication → Users → salin **User UID** akunmu.
3. Firestore → Start collection `roles` → Document ID = UID tadi → field `role` (string) = `owner`.

## 4. Cloudflare Pages
dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → pilih `rxgadget`. Build command kosong, output directory `/`. Deploy.

## 5. Pengaturan awal
- Unggah gambar QRIS Rxgadget sebagai `assets/qris.png`.
- Panel Owner → Pengaturan → isi biaya langganan, trial, dll. (membuat dokumen `settings/public`).
- Tambah admin: Panel → Admin & log → buat kode undangan → kirim kode + username ke admin → ia membuka `#/admin-masuk`.

## Catatan penting
- Penutupan lelang dan batas waktu dihitung di sisi pengguna (tanpa server); owner/admin memantau.
- Aturan keamanan perlu diuji dengan data nyata sebelum dipakai transaksi sungguhan.
- Syarat Layanan & Kebijakan Privasi adalah templat; minta tinjauan hukum. Menahan dana pihak ketiga dapat terkait aturan OJK/BI; konsultasikan sebelum beroperasi.
