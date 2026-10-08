-- ============================================================================
-- pos-pusat — Skema DB Pusat (Tahap 2, Lapis 1: sales + sales_returns)
-- Lihat server/docs/SYNC_DESIGN_TAHAP1.md & SYNC_STATUS_RESET_AUDIT.md di
-- repo `server` untuk kontrak lengkap & alasan desainnya.
--
-- Prinsip:
--   1. Satu set tabel GABUNGAN semua cabang, dibedakan `branch_code` (bukan
--      skema terpisah per cabang).
--   2. PK = UUID ASLI dari baris cabang, dipakai APA ADANYA (bukan di-
--      generate ulang) — inilah yang membuat UPSERT idempotent (lihat
--      SyncReceiverService).
--   3. `branch_code` SELALU diresolve dari TOKEN autentikasi di pusat, TIDAK
--      PERNAH dipercaya dari klaim apa pun di body payload.
--   4. Pusat READ-ONLY dari sudut pandang cabang — tidak ada jalur apa pun
--      di sini yang mengirim data balik ke cabang.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS pos_pusat
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE pos_pusat;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Registry cabang yang boleh mengirim sync. token_hash = SHA-256 hex dari
-- token rahasia cabang (SHA-256 cukup di sini — ini bukan password manusia
-- yang perlu lambat-di-brute-force seperti bcrypt, ini token acak panjang;
-- pola yang sama dipakai API key di banyak layanan, mis. Stripe/GitHub).
-- Token ASLI tidak pernah disimpan di mana pun di pusat, cuma hash-nya.
-- Diisi lewat script `register-branch.js` (operasi admin manual, BUKAN
-- lewat endpoint HTTP apa pun — pendaftaran cabang baru bukan sesuatu yang
-- boleh dilakukan via API tanpa pengawasan).
DROP TABLE IF EXISTS branches;
CREATE TABLE branches (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  branch_code   VARCHAR(20)  NOT NULL UNIQUE,
  branch_name   VARCHAR(100) NULL,              -- label manusiawi opsional, mis. "Semarang"
  token_hash    CHAR(64)     NOT NULL UNIQUE,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1, -- nonaktifkan utk cabut akses tanpa hapus riwayat
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sync_at  DATETIME     NULL               -- update tiap kali batch dari cabang ini sukses diterima
) ENGINE=InnoDB;

-- Salinan gabungan sales semua cabang. branch_created_at = created_at ASLI
-- di cabang (jam transaksi sungguhan terjadi) — BEDA dari received_at (jam
-- pusat menerima, bisa jauh lebih telat kalau ada retry/gangguan jaringan).
-- updated_at ON UPDATE mencatat kapan baris ini TERAKHIR di-UPSERT (mis.
-- saat status voided baru terkabar belakangan, lihat SYNC_STATUS_RESET_AUDIT.md).
DROP TABLE IF EXISTS sales;
CREATE TABLE sales (
  id                 CHAR(36)      NOT NULL PRIMARY KEY,  -- UUID ASLI dari sales.id cabang
  branch_code        VARCHAR(20)   NOT NULL,
  sale_number        VARCHAR(30)   NOT NULL,
  cashier_name       VARCHAR(100)  NULL,                  -- snapshot teks, BUKAN FK ke users manapun
  customer_name      VARCHAR(100)  NULL,
  subtotal           INT           NOT NULL,
  discount_total     INT           NOT NULL DEFAULT 0,
  dpp                INT           NOT NULL DEFAULT 0,
  ppn_rate           DECIMAL(8,4)  NULL,
  ppn_mode           VARCHAR(10)   NULL,
  ppn_amount         INT           NOT NULL DEFAULT 0,
  grand_total        INT           NOT NULL,
  total_cost         DECIMAL(18,4) NOT NULL DEFAULT 0,
  gross_profit       DECIMAL(18,4) NOT NULL DEFAULT 0,
  status             VARCHAR(20)   NOT NULL,               -- 'completed' | 'voided', apa adanya dari cabang
  void_reason        TEXT          NULL,
  voided_at          DATETIME      NULL,
  branch_created_at  DATETIME      NOT NULL,
  received_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_sales_branch ON sales(branch_code);
CREATE INDEX idx_sales_created ON sales(branch_created_at);
CREATE INDEX idx_sales_status ON sales(status);

-- Salinan gabungan retur penjualan semua cabang. sale_id menunjuk ke
-- sales.id (cabang asal) TAPI SENGAJA BUKAN foreign key formal — batch
-- sync bisa datang tidak berurutan (retur boleh tersync sebelum/sesudah
-- sale aslinya, tergantung kapan masing2 masuk antrian local_only di
-- cabang), FK ketat akan menolak retur yang originnya belum sempat
-- diterima pusat. Konsolidasi/laporan nanti JOIN manual, toleran kalau
-- sale_id belum/tidak ada.
DROP TABLE IF EXISTS sales_returns;
CREATE TABLE sales_returns (
  id                 CHAR(36)     NOT NULL PRIMARY KEY,   -- UUID ASLI dari sales_returns.id cabang
  branch_code        VARCHAR(20)  NOT NULL,
  return_number      VARCHAR(30)  NOT NULL,
  sale_id            CHAR(36)     NOT NULL,
  return_date        DATE         NOT NULL,
  is_cash_refund     TINYINT(1)   NOT NULL DEFAULT 1,
  reason             TEXT         NULL,
  grand_total        INT          NOT NULL,
  total_cost         INT          NOT NULL,
  processed_by_name  VARCHAR(100) NULL,                   -- snapshot teks, sama pola dgn cashier_name
  branch_created_at  DATETIME     NOT NULL,
  received_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_sales_returns_branch ON sales_returns(branch_code);
CREATE INDEX idx_sales_returns_sale ON sales_returns(sale_id);

-- Login dashboard pusat (Tahap 4) — TERPISAH TOTAL dari `branches` di atas
-- (itu identitas MESIN/cabang lewat token, ini identitas MANUSIA lewat
-- password) dan dari `users` di DB cabang manapun (database yang beda
-- sama sekali). SENGAJA datar — tidak ada role/permission/branch_id:
-- siapa pun yang login boleh lihat semua laporan konsolidasi, cukup itu.
-- password_hash = bcrypt (BEDA dari branches.token_hash yang SHA-256 —
-- password manusia butuh hash lambat tahan brute-force, token acak
-- panjang tidak). failed_login_attempts/locked_until = lockout, pola
-- identik dgn users di server cabang (lihat AuthService.js).
-- Diisi lewat script `register-user.js` (operasi admin manual, BUKAN
-- lewat endpoint HTTP — sama alasan dgn register-branch.js: tidak boleh
-- ada akun admin pusat yang bisa dibuat dari luar).
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id                     CHAR(36)     NOT NULL PRIMARY KEY,
  username               VARCHAR(50)  NOT NULL UNIQUE,
  password_hash          VARCHAR(255) NOT NULL,
  full_name              VARCHAR(100) NOT NULL,
  is_active              TINYINT(1)   NOT NULL DEFAULT 1,
  failed_login_attempts  INT          NOT NULL DEFAULT 0,
  locked_until           DATETIME     NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
