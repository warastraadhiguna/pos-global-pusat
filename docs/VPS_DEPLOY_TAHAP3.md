# Deploy pos-pusat ke VPS — Tahap 3 Bagian A

**Status: SELESAI & TERVERIFIKASI (8 Oktober 2026).** pos-pusat live di
`https://sumber-alam.wan-client.com`, dikelola pm2 (berdampingan dgn `new-wanrent-api` yang
sudah ada duluan, 0 restart di keduanya). Hasil Langkah 9: HTTPS jalan, HTTP->HTTPS redirect
301 otomatis (certbot `--redirect`), token salah ditolak 401, `fitbull.id` tidak terganggu,
port 4100 tidak ada di rule ufw (`Default: deny (incoming)` + `HOST=127.0.0.1` di app — dua
lapis, port ini TIDAK bisa dijangkau dari internet). Cabang `TEST` sudah terdaftar, token
tersimpan di luar chat/repo ini (pegangan user).

**VPS:** `402287` (156.67.219.118) — server BERSAMA, ±40 situs lain hidup di sana (lihat
`CATATAN_SERVER_VPS.md`). Prinsip: hanya MENAMBAH, tidak mengubah apa pun yang sudah ada.
Jangan `systemctl restart` layanan global (nginx, mariadb) — pakai `reload`. Selalu `nginx -t`
dulu sebelum reload.

**Domain:** `sumber-alam.wan-client.com` (subdomain dari domain yang sudah ada di server ini).

**Pola yang dipakai:** sama seperti aplikasi Node+pm2 lain di server ini (lihat Bagian 5
catatan Anda) — kode di `/var/www/pos-pusat`, proses dikelola `pm2` (daemon yang sama,
`pm2-angling_root.service`, sudah jalan), nginx jadi reverse proxy ke port lokal, HTTPS via
`certbot --nginx`. BUKAN pola Laravel (tidak ada PHP-FPM/Composer/Artisan di sini).

Jalankan semua ini sebagai root (atau `sudo`) di VPS, URUT dari atas ke bawah. Kalau ada
langkah yang keluarannya tidak sesuai yang diharapkan, BERHENTI dan laporkan sebelum lanjut
(sama prinsip dengan `install.sh` AMA — berhenti di kejutan pertama).

---

## 0. Pre-flight — pastikan tidak akan bentrok dengan yang sudah ada

```bash
# DNS sudah mengarah ke server ini? (WAJIB sebelum certbot bisa jalan)
getent hosts sumber-alam.wan-client.com
# harus menunjukkan 156.67.219.118 — kalau belum, tunggu propagasi DNS dulu, JANGAN lanjut

# domain belum dipakai nginx lain?
ls /etc/nginx/sites-enabled | grep sumber-alam || echo "domain belum dipakai (bagus)"

# nginx sehat & cukup sumber daya?
nginx -t && free -h && df -h /

# port lokal yang mau dipakai pos-pusat BELUM dipakai aplikasi Node lain?
# (aplikasi Node existing di server ini pakai port berapa — cek dulu, JANGAN asal pilih 4100)
ss -tlnp | grep -E ':(4100|3000|3001|4000|4200|5000)\b'
# kalau 4100 kosong di output di atas, pakai 4100 di seluruh panduan ini.
# Kalau 4100 SUDAH dipakai, ganti PORT=4100 di LANGKAH 3 & 7 dengan port lain yang kosong.

# MySQL/MariaDB sudah ada & cuma dengar di localhost? (jangan sampai kebuka ke publik)
# CATATAN: MariaDB di server ini dengar di port 5431, BUKAN 3306 standar
# (dikonfirmasi hasil verifikasi) — makanya cek 5431, bukan 3306.
ss -tlnp | grep 5431
# HARUS menunjukkan 127.0.0.1:5431, BUKAN 0.0.0.0:5431 — kalau yang terakhir, laporkan dulu,
# jangan lanjut (artinya MySQL server ini sudah terbuka ke internet, itu masalah terpisah yang
# lebih mendesak dari sekadar pasang pos-pusat).

# firewall aktif? apa saja yang dibuka?
ufw status verbose
```

---

## 1. Database — MySQL/MariaDB (pakai yang sudah ada, bukan install baru)

```bash
# Generate password acak kuat, SIMPAN hasilnya (dipakai di .env langkah 3)
openssl rand -base64 24
```

```bash
# -h 127.0.0.1 -P 5431 WAJIB eksplisit — client mysql default pakai Unix
# socket kalau host ditulis "localhost" (port --port DIABAIKAN diam-diam
# kalau begitu), jadi tanpa -h ini bisa salah connect ke instance lain atau
# gagal. Port 5431 sesuai hasil verifikasi (bukan 3306 standar).
mysql -u root -p -h 127.0.0.1 -P 5431
```
Di prompt MySQL:
```sql
CREATE DATABASE pos_pusat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- '127.0.0.1', BUKAN 'localhost' — app Node connect lewat TCP ke 127.0.0.1
-- (lihat .env langkah 3), dan MySQL/MariaDB membedakan 'localhost' (socket)
-- dari '127.0.0.1' (TCP loopback) sbg host match yang BEDA utk user account.
-- Kalau user dibuat @'localhost', koneksi TCP dari app akan DITOLAK.
CREATE USER 'pos_pusat'@'127.0.0.1' IDENTIFIED BY 'TEMPEL_PASSWORD_DARI_ATAS_SINI';
GRANT ALL PRIVILEGES ON pos_pusat.* TO 'pos_pusat'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```
Catatan: user `pos_pusat` SENGAJA `@'localhost'` saja (bukan `@'%'`) — tidak pernah perlu diakses
dari luar mesin ini, app Node & MySQL sama-sama di server yang sama.

---

## 2. Ambil kode

```bash
mkdir -p /var/www/pos-pusat
cd /var/www/pos-pusat
git clone https://github.com/warastraadhiguna/pos-global-pusat.git .
npm install --omit=dev
```

---

## 3. Konfigurasi `.env`

```bash
cd /var/www/pos-pusat
cat > .env <<'EOF'
PORT=4100
# HOST=127.0.0.1 SENGAJA, BUKAN 0.0.0.0 — app Node ini TIDAK PERNAH boleh langsung
# dijangkau dari internet, cuma lewat nginx reverse proxy di localhost. Beda dari
# default dev lokal (yang terbiasa 0.0.0.0 krn di jaringan toko tertutup) — di VPS
# bersama ini salah satu lapis pengaman supaya port 4100 percuma kalaupun ufw/nginx
# salah konfigurasi.
HOST=127.0.0.1

DB_HOST=127.0.0.1
# 5431, BUKAN 3306 standar — MariaDB di server ini dengar di port non-default
# (dikonfirmasi hasil verifikasi VPS).
DB_PORT=5431
DB_USER=pos_pusat
DB_PASSWORD=TEMPEL_PASSWORD_YANG_SAMA_DARI_LANGKAH_1
DB_NAME=pos_pusat
EOF

chmod 640 .env
chown root:root .env   # cuma proses yang jalan sbg root (pm2-angling_root) yang perlu baca ini
```

---

## 4. Migrasi skema (DB pos_pusat masih kosong — aman)

```bash
cd /var/www/pos-pusat
npm run db:migrate
```
Harus keluar `Schema pos_pusat berhasil dibuat/diperbarui.`

---

## 5. Daftarkan cabang UJI (bukan SMG produksi)

```bash
cd /var/www/pos-pusat
node src/db/register-branch.js TEST "Cabang Uji"
```
**SALIN token yang dicetak** — dipakai di Bagian B (sender test dari lokal). Tidak akan
ditampilkan lagi setelah ini (cuma hash-nya tersimpan).

---

## 6. Jalankan lewat pm2 (daemon yang SUDAH ada, bukan service baru)

```bash
cd /var/www/pos-pusat
pm2 start src/server.js --name pos-pusat
pm2 save          # supaya ikut pulih otomatis saat server reboot (pm2-angling_root.service)
pm2 status         # pastikan status "online", catat tidak ada restart loop
pm2 logs pos-pusat --lines 30 --nostream   # harus kelihatan "pos-pusat (penerima sync) berjalan di http://127.0.0.1:4100"
```

---

## 7. nginx — vhost HTTP dulu

```bash
cat > /etc/nginx/sites-available/sumber-alam.wan-client.com <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name sumber-alam.wan-client.com;

    location / {
        proxy_pass http://127.0.0.1:4100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/sumber-alam.wan-client.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Uji HTTP dulu (sebelum SSL) — harus dapat respons dari pos-pusat:
```bash
curl -s http://sumber-alam.wan-client.com/health
```

---

## 8. HTTPS — certbot (WAJIB, `--redirect` memaksa HTTP→HTTPS otomatis)

```bash
certbot --nginx -d sumber-alam.wan-client.com --redirect --non-interactive --agree-tos -m EMAIL_ANDA@domain.com
nginx -t && systemctl reload nginx
```
`--redirect` membuat certbot MENULIS sendiri rule 301 HTTP→HTTPS ke vhost (bukan opsional/
interaktif) — ini yang menjawab syarat "request HTTP polos harus ditolak/dialihkan".

---

## 9. Verifikasi akhir (jalankan semua, tempel hasilnya ke saya)

```bash
# 1. HTTPS jalan
curl -s https://sumber-alam.wan-client.com/health

# 2. HTTP polos DIALIHKAN (harus 301, Location: https://...), BUKAN disajikan langsung
curl -sI http://sumber-alam.wan-client.com/health

# 3. Token salah ditolak
curl -s -w "\n%{http_code}\n" -X POST https://sumber-alam.wan-client.com/api/sync/batch \
  -H "Authorization: Bearer token-salah" -H "Content-Type: application/json" -d '{"sales":[],"salesReturns":[]}'

# 4. Pastikan situs LAIN di server ini tidak terganggu (sama spt pengecekan AMA ke fitbull.id)
curl -s -o /dev/null -w "%{http_code}\n" https://fitbull.id

# 5. Port Node TIDAK bisa diakses langsung dari luar (cuma lewat nginx)
#    — kalau ini BERHASIL konek dari luar server, itu masalah (seharusnya connection refused/timeout
#    dari luar karena HOST=127.0.0.1). Jalankan dari KOMPUTER LAIN, bukan dari VPS itu sendiri:
#    curl -s --max-time 5 http://156.67.219.118:4100/health   (dari luar, harus GAGAL)

# 6. Firewall tidak membuka port 4100 ke publik
ufw status | grep 4100 || echo "4100 tidak ada di rule ufw (bagus — tidak sengaja dibuka)"

# 7. pm2 tetap hidup, tidak restart-loop
pm2 status
```

---

## Yang terekspos ke publik setelah ini (ringkasan untuk review keamanan)

| Apa | Terekspos? | Catatan |
|---|---|---|
| `GET /health` | YA, publik, tanpa auth | Cuma `{status, service, time}` — tidak ada data bisnis/kredensial. Risiko rendah, tapi secara desain memang publik (dipakai utk cek "apakah pusat hidup" tanpa perlu token). |
| `POST /api/sync/batch` | YA, tapi WAJIB token Bearer valid | Endpoint ASLI yang dimaksud terbuka — token salah/tidak ada → 401, tidak ada bocoran data apa pun pada respons 401. |
| Rute lain apa pun | TIDAK ADA | Express app ini cuma punya 2 route di atas — semua rute lain kena `notFoundHandler` (404 JSON generik, tidak ada stack trace/detail internal yang bocor — `errorHandler` cuma kirim `err.message`, bukan `err.stack`, ke klien). |
| Port Node 4100 langsung | TIDAK (kalau Langkah 9.5 di atas lolos) | `HOST=127.0.0.1` di `.env` + tidak ada rule ufw utk 4100 → cuma bisa diakses dari localhost VPS itu sendiri (lewat nginx), bukan dari internet. |
| MySQL/MariaDB (5431) | TIDAK — dikonfirmasi localhost-only (127.0.0.1:5431) | Sudah begitu SEBELUM pos-pusat dipasang (bukan sesuatu yang kita ubah) — cuma diverifikasi ulang di Langkah 0, bukan dikonfigurasi. |
| HTTP polos (port 80) utk domain ini | TIDAK disajikan — DIALIHKAN ke HTTPS | `certbot --redirect` menulis rule 301 otomatis ke vhost. |

**Belum/tidak dilakukan di Bagian A ini** (sesuai arahan — sengaja, bukan lupa):
- Tidak menyalakan `sync_settings.enabled` di server cabang mana pun — scheduler produksi
  Semarang tetap mati, tidak disentuh sama sekali.
- Tidak mendaftarkan cabang `SMG` — cuma `TEST`.
- Tidak membuat dashboard/laporan apa pun di pos-pusat — murni endpoint penerima.
