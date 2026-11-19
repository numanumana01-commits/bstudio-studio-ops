# Bstudio

Ruang kerja studio untuk proyek, tugas, review, absensi, KPI, payroll, dan keuangan. Preview memakai data contoh dan menyediakan pemilih akun. Untuk data operasional, aplikasi menggunakan identitas akun dan pemeriksaan akses pada server.

## Jalankan pengembangan

Gunakan Node.js 24. Jalankan `npm test`, `npm run build`, lalu `npm start`. Preview lokal tersedia di http://127.0.0.1:4173. Aplikasi dan pengujian tidak memerlukan instalasi paket npm.

## Sebelum aktivasi untuk tim

1. Jalankan migrasi D1 dan pastikan binding DB tersedia. Deploy hanya pada lingkungan yang menyediakan identitas terverifikasi dan menghapus header identitas dari request publik.
2. Set `OWNER_EMAIL` melalui pengaturan environment privat. Tanpa nilai ini, hanya demo dengan data contoh yang tersedia. Masuk sebagai owner dan tautkan identitas sebelum memberi akses ke tim.
3. Tetapkan peran di Akses Tim dan beri akses tingkat situs hanya kepada akun yang diundang. Viewer perlu proyek yang disetujui. Gunakan akun uji berbeda untuk memeriksa izin sebelum memasukkan data asli.
4. Konfirmasi jadwal kerja, hari libur, periode gaji, dan kebijakan absensi. Jalankan satu periode uji dengan perhitungan pembanding. Preview tidak mendebit dana, transfer bank, atau mengirim slip.
5. Tentukan jadwal pencadangan D1 dan uji pemulihan di lingkungan uji. Ekspor CSV membantu rekap keuangan dan slip final. File ekspor memuat data sesuai hak akun yang mengekspor.
6. Deploy perubahan melalui versi sumber. Uji perubahan skema pada salinan data, jalankan pengujian, dan periksa izin lagi sebelum rilis.

## Workspace

Satu akun dapat mempunyai peran berbeda di Bstudio, Matte Magic, dan Omera.Cinema. Transaksi, proyek, absensi, KPI, dan slip diproses dalam workspace yang dipilih. Saat data versi lama dibuka, rekamannya tetap berada di Bstudio. Workspace baru mulai kosong untuk akun operasional. Mode demo memuat contoh terpisah dan tidak menulis ke database operasional.

## Penyimpanan pilot

Penyimpanan studio memakai versi snapshot dan transaksi atomik. Poin QC dicatat sekali, slip final membekukan perhitungan, dan transaksi terbuka tidak ikut kas. Snapshot dibagi ke baris kecil pada D1. Batas aplikasi 3 juta karakter untuk snapshot seluruh workspace, dengan batas 1.000 entri riwayat di aplikasi. Migrasikan ke tabel per entitas sebelum beban kerja atau retensi audit melebihi cakupan pilot. Pantau kuota hosting dan database.

## Acuan

- OWASP ASVS 5.0 dan OWASP Authorization Cheat Sheet untuk referensi kontrol akses, validasi, dan verifikasi.
- WCAG 2.2 untuk fokus keyboard, label, keterbacaan, dan tata letak responsif.
- Pengujian repo memeriksa alur dan aturan aplikasi. Jalankan uji akun pada lingkungan hosting sebelum penggunaan operasional.
