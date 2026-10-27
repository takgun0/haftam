// .ics dışa aktarma testleri.
import { buildICS, icsEscape, icsFold } from '../js/export.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function eq(a, e, msg = '') {
  if (JSON.stringify(a) !== JSON.stringify(e)) throw new Error(`${msg ? msg + ': ' : ''}beklenen ${JSON.stringify(e)}, gelen ${JSON.stringify(a)}`);
}
function ok(c, msg) { if (!c) throw new Error(msg || 'koşul sağlanmadı'); }

const data = {
  schemaVersion: 1,
  settings: { customHolidays: [] },
  routines: [{
    id: 'ist', title: 'İstatistik', days: [1, 4], start: '09:00', end: '10:50', location: 'B-204', category: 'ders',
    note: 'Hoca: Doç. Dr. Aydın; ödev, proje', validFrom: '2026-10-19', validUntil: '2026-11-08', weekInterval: 1,
  }, {
    id: 'kulup', title: 'Kulüp', days: [3], start: '19:00', end: '21:00', location: '', category: 'sosyal',
    note: '', validFrom: '2026-10-21', validUntil: '2026-12-31', weekInterval: 2,
  }],
  events: [{ id: 'e1', title: 'Toplantı', date: '2026-11-15', start: '14:00', end: '15:00', location: 'Zoom', category: 'is', note: '' }],
  overrides: [
    { routineId: 'ist', date: '2026-10-26', action: 'cancel' },
    { routineId: 'ist', date: '2026-11-02', action: 'modify', changes: { date: '2026-11-03', start: '13:00', end: '14:50', location: 'C-101' } },
  ],
};
const now = new Date(Date.UTC(2026, 9, 27, 10, 15, 0));
const ics = buildICS(data, now);
const unfolded = ics.replace(/\r\n /g, '');
const lines = unfolded.split('\r\n');
const vevents = unfolded.split('BEGIN:VEVENT').slice(1).map((b) => b.split('END:VEVENT')[0]);

test('ics: CRLF satır sonları, VCALENDAR ve VTIMEZONE', () => {
  ok(ics.endsWith('\r\n'), 'CRLF ile bitmeli');
  ok(!/[^\r]\n/.test(ics), 'yalnız LF olmamalı');
  eq(lines[0], 'BEGIN:VCALENDAR');
  ok(lines.includes('TZID:Europe/Istanbul') && lines.includes('TZOFFSETTO:+0300'));
  eq(vevents.length, 4, 'rutin, değiştirilmiş hafta, 2 haftalık rutin, etkinlik');
});

test('ics: rutin RRULE, DTSTART ilk gerçekleşme', () => {
  const v = vevents[0];
  ok(v.includes('UID:routine-ist@haftam'));
  ok(v.includes('DTSTART;TZID=Europe/Istanbul:20261019T090000'), v);
  ok(v.includes('DTEND;TZID=Europe/Istanbul:20261019T105000'));
  ok(v.includes('RRULE:FREQ=WEEKLY;INTERVAL=1;WKST=MO;BYDAY=MO,TH;UNTIL=20261108T205959Z'), v);
  ok(v.includes('DTSTAMP:20261027T101500Z'));
});

test('ics: iptal edilen hafta ve 29 Ekim tatili EXDATE', () => {
  ok(vevents[0].includes('EXDATE;TZID=Europe/Istanbul:20261026T090000,20261029T090000'), vevents[0]);
});

test('ics: değiştirilen hafta RECURRENCE-ID ile ayrı VEVENT', () => {
  const v = vevents[1];
  ok(v.includes('UID:routine-ist@haftam'));
  ok(v.includes('RECURRENCE-ID;TZID=Europe/Istanbul:20261102T090000'), v);
  ok(v.includes('DTSTART;TZID=Europe/Istanbul:20261103T130000'));
  ok(v.includes('LOCATION:C-101'));
  ok(!v.includes('RRULE'), 'tekil örnekte RRULE olmamalı');
});

test('ics: 2 haftada bir INTERVAL=2 ve tek seferlik etkinlik', () => {
  ok(vevents[2].includes('INTERVAL=2;WKST=MO;BYDAY=WE'));
  ok(vevents[2].includes('DTSTART;TZID=Europe/Istanbul:20261021T190000'));
  ok(vevents[3].includes('UID:event-e1@haftam') && vevents[3].includes('DTSTART;TZID=Europe/Istanbul:20261115T140000'));
});

test('ics: metin kaçışları', () => {
  eq(icsEscape('a;b,c\\d\ne'), 'a\\;b\\,c\\\\d\\ne');
  ok(vevents[0].includes('DESCRIPTION:Hoca: Doç. Dr. Aydın\\; ödev\\, proje'));
});

test('ics: satırlar 75 sekizliği aşmaz, UTF-8 karakter bölünmez', () => {
  const long = 'SUMMARY:' + 'Çağrı İşıl ılık sütü öğle güneşinde içti '.repeat(6);
  const folded = icsFold(long);
  const enc = new TextEncoder();
  for (const l of folded.split('\r\n')) ok(enc.encode(l).length <= 75, `uzun satır: ${enc.encode(l).length}`);
  eq(folded.replace(/\r\n /g, ''), long);
  for (const l of ics.split('\r\n')) ok(enc.encode(l).length <= 75, l);
});

export function runTests() {
  return tests.map((t) => {
    try { t.fn(); return { name: t.name, ok: true }; } catch (err) { return { name: t.name, ok: false, error: err.message }; }
  });
}
