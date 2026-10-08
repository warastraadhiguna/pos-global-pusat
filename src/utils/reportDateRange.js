// Rentang tanggal laporan dihitung dalam KALENDER Asia/Jakarta (WIB), BUKAN
// timezone OS/proses Node — VPS bisa saja default UTC, dan branch_created_at
// yang tersimpan di tabel sales/sales_returns adalah wall-clock WIB APA
// ADANYA (naive, tanpa info zona waktu, karena server cabang memang fisik
// di toko/WIB — lihat schema.sql). Kalau batas tanggal laporan dihitung
// pakai timezone proses yang salah, "hari ini" di dashboard owner bisa
// bergeser sehari dari "hari ini" yang sesungguhnya di toko. Intl dengan
// `timeZone` eksplisit membuat ini benar APAPUN timezone OS VPS-nya.
function jakartaToday() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

// Date.UTC() dipakai MURNI sbg kalkulator kalender (bukan timestamp
// sungguhan) — aman dari isu DST krn Indonesia tidak pernah pakai DST.
function addDaysCalendar(year, month, day, deltaDays) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function toSqlDateTime({ year, month, day }) {
  return `${year}-${pad(month)}-${pad(day)} 00:00:00`;
}

function parseDateString(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

// period: 'today' | 'month' | 'custom'. Untuk 'custom', startDate/endDate
// format 'YYYY-MM-DD', endDate INKLUSIF (laporan sampai akhir hari itu).
function resolveRange({ period, startDate, endDate }) {
  const today = jakartaToday();

  if (period === 'today') {
    const tomorrow = addDaysCalendar(today.year, today.month, today.day, 1);
    return { start: toSqlDateTime(today), end: toSqlDateTime(tomorrow), label: 'Hari Ini' };
  }

  if (period === 'month') {
    const firstOfMonth = { year: today.year, month: today.month, day: 1 };
    const firstOfNextMonth =
      today.month === 12
        ? { year: today.year + 1, month: 1, day: 1 }
        : { year: today.year, month: today.month + 1, day: 1 };
    return { start: toSqlDateTime(firstOfMonth), end: toSqlDateTime(firstOfNextMonth), label: 'Bulan Ini' };
  }

  if (period === 'custom') {
    const start = parseDateString(startDate);
    const end = parseDateString(endDate);
    if (!start || !end) {
      throw new Error("startDate dan endDate wajib diisi format 'YYYY-MM-DD' untuk period=custom");
    }
    const endExclusive = addDaysCalendar(end.year, end.month, end.day, 1);
    return {
      start: toSqlDateTime(start),
      end: toSqlDateTime(endExclusive),
      label: `${startDate} s/d ${endDate}`,
    };
  }

  throw new Error(`period tidak dikenal: '${period}' (harus 'today', 'month', atau 'custom')`);
}

module.exports = { resolveRange, jakartaToday };
