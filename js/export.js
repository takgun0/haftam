// Dışa aktarma: JSON yedek, .ics takvim dosyası ve yazdırma.

import { pad2, toISODate } from './dates.js';
import { getHoliday } from './holidays.js';
import { CATEGORY_LABELS, routineOccurrences } from './schedule.js';

// ---------- .ics (RFC 5545) ----------

const TZID = 'Europe/Istanbul';
const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/** Metin değerlerini kaçışlar: \ ; , ve satır sonu. */
export function icsEscape(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Satırı 75 sekizliği aşmayacak şekilde katlar (UTF-8 karakterleri bölünmez). */
export function icsFold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

/** "2026-10-27" + "14:00" → "20261027T140000" (Europe/Istanbul yerel). */
function icsLocal(iso, time) {
  return `${iso.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

function icsStamp(now) {
  return `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`;
}

/** Geçerlilik bitiş gününün sonu (23:59:59 +03:00) UTC olarak. Türkiye 2016'dan beri sabit UTC+3. */
function icsUntil(iso) {
  return `${iso.replace(/-/g, '')}T205959Z`;
}

function eventLines({ uid, stamp, date, start, end, title, location, note, category, extra = [] }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    ...extra.filter((l) => l.startsWith('RECURRENCE-ID')),
    `DTSTART;TZID=${TZID}:${icsLocal(date, start)}`,
    `DTEND;TZID=${TZID}:${icsLocal(date, end)}`,
    ...extra.filter((l) => !l.startsWith('RECURRENCE-ID')),
    `SUMMARY:${icsEscape(title)}`,
  ];
  if (location) lines.push(`LOCATION:${icsEscape(location)}`);
  if (note) lines.push(`DESCRIPTION:${icsEscape(note)}`);
  lines.push(`CATEGORIES:${icsEscape(CATEGORY_LABELS[category])}`, 'END:VEVENT');
  return lines;
}

/**
 * Tüm rutin ve etkinlikleri .ics metnine çevirir.
 * Rutin → RRULE (FREQ=WEEKLY;INTERVAL;BYDAY;UNTIL), iptal edilen haftalar ve
 * tatil günleri → EXDATE, bu hafta değiştirilenler → RECURRENCE-ID'li ayrı VEVENT.
 */
export function buildICS(data, now = new Date()) {
  const stamp = icsStamp(now);
  const holidays = data.settings.customHolidays || [];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Haftam//Haftalik Program//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Haftam',
    `X-WR-TIMEZONE:${TZID}`,
    'BEGIN:VTIMEZONE',
    `TZID:${TZID}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0300',
    'TZNAME:+03',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const r of data.routines) {
    const occ = routineOccurrences(r);
    if (!occ.length) continue;
    const uid = `routine-${r.id}@haftam`;
    const exdates = [];
    const modified = [];
    for (const iso of occ) {
      const ov = data.overrides.find((o) => o.routineId === r.id && o.date === iso);
      if (ov && ov.action === 'cancel') exdates.push(iso);
      else if (ov && ov.action === 'modify') {
        if (Object.keys(ov.changes || {}).length) modified.push(ov);
      } else if (getHoliday(iso, holidays)) exdates.push(iso);
    }
    const rrule = `RRULE:FREQ=WEEKLY;INTERVAL=${r.weekInterval || 1};WKST=MO;BYDAY=${r.days.map((d) => BYDAY[d - 1]).join(',')};UNTIL=${icsUntil(r.validUntil)}`;
    const extra = [rrule];
    if (exdates.length) extra.push(`EXDATE;TZID=${TZID}:${exdates.map((iso) => icsLocal(iso, r.start)).join(',')}`);
    lines.push(...eventLines({ uid, stamp, date: occ[0], ...r, extra }));
    for (const ov of modified) {
      const c = ov.changes;
      lines.push(...eventLines({
        uid, stamp,
        date: c.date || ov.date,
        start: c.start || r.start,
        end: c.end || r.end,
        title: c.title ?? r.title,
        location: c.location ?? r.location,
        note: c.note ?? r.note,
        category: r.category,
        extra: [`RECURRENCE-ID;TZID=${TZID}:${icsLocal(ov.date, r.start)}`],
      }));
    }
  }

  for (const e of data.events) {
    lines.push(...eventLines({ uid: `event-${e.id}@haftam`, stamp, ...e }));
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

export function downloadICS(data, now = new Date()) {
  const name = `haftam-takvim-${toISODate(now)}.ics`;
  download(name, buildICS(data, now), 'text/calendar;charset=utf-8');
  return name;
}

// ---------- JSON yedek ----------

export function backupFileName(now = new Date()) {
  return `haftam-yedek-${toISODate(now)}.json`;
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Verinin JSON yedeğini indirir; dosya adını döndürür. */
export function downloadBackup(data, now = new Date()) {
  const name = backupFileName(now);
  download(name, JSON.stringify(data, null, 2), 'application/json');
  return name;
}

/** Kullanıcıdan bir .json dosyası seçmesini ister; metnini döndürür (iptalde null). */
export function pickJSONFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      if (file.size > 5 * 1024 * 1024) return resolve({ error: 'Dosya çok büyük (en fazla 5 MB).' });
      try {
        resolve({ name: file.name, text: await file.text() });
      } catch {
        resolve({ error: 'Dosya okunamadı.' });
      }
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export function printWeek() {
  window.print();
}
