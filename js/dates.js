// Tarih yardımcıları. Tüm işlemler yerel tarih bileşenleriyle yapılır;
// toISOString() kullanılmaz (UTC+3'te gün kayar).

export const MINUTES_PER_DAY = 24 * 60;

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Date → "YYYY-MM-DD" (yerel). */
export function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidISODate(s) {
  if (typeof s !== 'string') return false;
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
}

export function isValidTime(s) {
  return typeof s === 'string' && HHMM.test(s);
}

/** "YYYY-MM-DD" → yerel gece yarısı Date. */
export function parseISODate(s) {
  const m = ISO_DATE.exec(s);
  if (!m) throw new Error(`Geçersiz tarih: ${s}`);
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

/** Saat/dakikayı atarak yalnızca günü bırakır. */
export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** ISO tarihe gün ekler: ("2026-12-31", 1) → "2027-01-01". */
export function addDaysISO(iso, n) {
  return toISODate(addDays(parseISODate(iso), n));
}

/** 1 = Pazartesi … 7 = Pazar. */
export function dayOfWeek(d) {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** b - a, gün olarak (yaz saati geçişlerinden etkilenmez). */
export function diffDays(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Tarihin bulunduğu haftanın Pazartesi'si (yerel gece yarısı). */
export function startOfWeek(d) {
  return addDays(startOfDay(d), 1 - dayOfWeek(d));
}

/** "HH:MM" → gün başından itibaren dakika. */
export function timeToMinutes(s) {
  const m = HHMM.exec(s);
  if (!m) throw new Error(`Geçersiz saat: ${s}`);
  return +m[1] * 60 + +m[2];
}

export function minutesToTime(min) {
  const v = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(min)));
  return `${pad2(Math.floor(v / 60))}:${pad2(v % 60)}`;
}

/** Date'in gün içindeki dakikası. */
export function minutesOfDay(d) {
  return d.getHours() * 60 + d.getMinutes();
}

/** ISO tarih + "HH:MM" → yerel Date. */
export function combine(iso, time) {
  const d = parseISODate(iso);
  const t = timeToMinutes(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(t / 60), t % 60);
}

// ---- Biçimlendirme (tr-TR) ----

const fmtDayShort = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });
const fmtDayLong = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' });
const fmtDayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const fmtDayMonthLong = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' });
const fmtFull = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonthYear = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });

export const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** "Sal" */
export function formatWeekdayShort(d) {
  return fmtDayShort.format(d);
}

/** "Salı" */
export function formatWeekdayLong(d) {
  return fmtDayLong.format(d);
}

/** "27 Eki" */
export function formatDayMonth(d) {
  return fmtDayMonth.format(d);
}

/** "Salı, 27 Ekim" */
export function formatDayTitle(d) {
  return `${fmtDayLong.format(d)}, ${fmtDayMonthLong.format(d)}`;
}

/** "27 Ekim 2026" */
export function formatFullDate(d) {
  return fmtFull.format(d);
}

export function formatMonthYear(d) {
  return fmtMonthYear.format(d);
}

/** "26 Eki – 1 Kas 2026" / "28 Ara 2026 – 3 Oca 2027" */
export function formatWeekRange(weekStart, days = 7) {
  const end = addDays(weekStart, days - 1);
  const sameYear = weekStart.getFullYear() === end.getFullYear();
  const left = sameYear ? formatDayMonth(weekStart) : `${formatDayMonth(weekStart)} ${weekStart.getFullYear()}`;
  return `${left} – ${formatDayMonth(end)} ${end.getFullYear()}`;
}

/** Süre metni: 110 → "1 sa 50 dk", 45 → "45 dk", 120 → "2 sa". */
export function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h} sa ${m} dk`;
  if (h) return `${h} sa`;
  return `${m} dk`;
}

/** Başlamaya kalan dakikadan göreli metin: 45 → "45 dk sonra". */
export function formatRelative(minutesUntil) {
  if (minutesUntil <= 0) return 'Şimdi';
  if (minutesUntil < 60) return `${Math.ceil(minutesUntil)} dk sonra`;
  if (minutesUntil < 24 * 60) return `${formatDuration(Math.round(minutesUntil))} sonra`;
  const days = Math.round(minutesUntil / (24 * 60));
  return `${days} gün sonra`;
}
