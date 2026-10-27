// schedule.js ve dates.js testleri. Hem tarayıcıda (schedule.test.html)
// hem de Node'da (`node tests/run.js`) çalışır.

import * as D from '../js/dates.js';
import * as S from '../js/schedule.js';
import { getHoliday } from '../js/holidays.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ? msg + ': ' : ''}beklenen ${e}, gelen ${a}`);
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'koşul sağlanmadı');
}

const d = (y, m, day, h = 0, min = 0) => new Date(y, m - 1, day, h, min);

function data(partial = {}) {
  return {
    schemaVersion: 1,
    settings: { termStart: '2026-09-21', termEnd: '2027-01-10', customHolidays: [], ...(partial.settings || {}) },
    routines: partial.routines || [],
    events: partial.events || [],
    overrides: partial.overrides || [],
  };
}
const routine = (o) => ({
  id: 'r1', title: 'İstatistik', days: [1], start: '09:00', end: '10:50', location: 'B-204',
  category: 'ders', note: '', validFrom: '2026-09-21', validUntil: '2027-01-10', weekInterval: 1, ...o,
});
const event = (o) => ({
  id: 'e1', title: 'Toplantı', date: '2026-10-27', start: '14:00', end: '15:00', location: '', category: 'is', note: '', ...o,
});
const isosOf = (week) => week.days.map((x) => x.iso);
const titles = (day) => day.instances.map((i) => i.title);

// ---- dates.js ----

test('toISODate yerel bileşenleri kullanır (gece yarısına yakın saatlerde kayma yok)', () => {
  eq(D.toISODate(d(2026, 10, 27, 0, 30)), '2026-10-27');
  eq(D.toISODate(d(2026, 10, 27, 23, 59)), '2026-10-27');
  eq(D.toISODate(d(2027, 1, 1, 0, 5)), '2027-01-01');
});

test('parseISODate ↔ toISODate gidiş-dönüş', () => {
  for (const s of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-12-31']) eq(D.toISODate(D.parseISODate(s)), s);
});

test('isValidISODate / isValidTime', () => {
  ok(D.isValidISODate('2028-02-29'));
  ok(!D.isValidISODate('2026-02-29'), '2026 artık yıl değil');
  ok(!D.isValidISODate('2026-13-01'));
  ok(!D.isValidISODate('26-10-27'));
  ok(D.isValidTime('00:00') && D.isValidTime('23:59'));
  ok(!D.isValidTime('24:00') && !D.isValidTime('9:00') && !D.isValidTime('12:60'));
});

test('addDays ay ve yıl geçişi', () => {
  eq(D.addDaysISO('2026-10-31', 1), '2026-11-01');
  eq(D.addDaysISO('2026-12-31', 1), '2027-01-01');
  eq(D.addDaysISO('2027-03-01', -1), '2027-02-28');
});

test('dayOfWeek: 1=Pzt … 7=Paz', () => {
  eq(D.dayOfWeek(d(2026, 10, 26)), 1);
  eq(D.dayOfWeek(d(2026, 10, 27)), 2);
  eq(D.dayOfWeek(d(2026, 11, 1)), 7);
});

test('diffDays', () => {
  eq(D.diffDays(d(2026, 10, 26), d(2026, 11, 2)), 7);
  eq(D.diffDays(d(2026, 12, 31), d(2027, 1, 1)), 1);
  eq(D.diffDays(d(2026, 11, 2), d(2026, 10, 26)), -7);
});

test('timeToMinutes / minutesToTime', () => {
  eq(D.timeToMinutes('09:00'), 540);
  eq(D.timeToMinutes('13:15'), 795);
  eq(D.minutesToTime(795), '13:15');
});

test('formatWeekRange (tr-TR)', () => {
  eq(D.formatWeekRange(d(2026, 10, 26)), '26 Eki – 1 Kas 2026');
  eq(D.formatWeekRange(d(2026, 12, 28)), '28 Ara 2026 – 3 Oca 2027');
});

test('formatRelative / formatDuration', () => {
  eq(D.formatRelative(45), '45 dk sonra');
  eq(D.formatRelative(165), '2 sa 45 dk sonra');
  eq(D.formatDuration(110), '1 sa 50 dk');
  eq(D.formatDuration(120), '2 sa');
});

// ---- schedule.js: hafta başlangıcı ----

test('getWeekStart: Salı, Pazar ve Pazartesi', () => {
  eq(D.toISODate(S.getWeekStart(d(2026, 10, 27, 13, 15))), '2026-10-26');
  eq(D.toISODate(S.getWeekStart(d(2026, 11, 1, 23, 59))), '2026-10-26');
  eq(D.toISODate(S.getWeekStart(d(2026, 10, 26, 0, 0))), '2026-10-26');
});

test('getWeekStart yıl geçişi: 1 Ocak 2027 Cuma → 28 Aralık 2026', () => {
  eq(D.toISODate(S.getWeekStart(d(2027, 1, 1))), '2026-12-28');
});

test('buildWeek ay geçişi olan hafta', () => {
  eq(isosOf(S.buildWeek(d(2026, 10, 28), data())), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
});

test('buildWeek yıl geçişi olan hafta + 1 Ocak tatili', () => {
  const w = S.buildWeek(d(2026, 12, 30), data());
  eq(isosOf(w), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  eq(w.days[4].holiday && w.days[4].holiday.name, 'Yılbaşı');
});

// ---- rutin açma ----

test('her hafta tekrarlanan rutin doğru günlerde', () => {
  const w = S.buildWeek(d(2026, 11, 2), data({ routines: [routine({ days: [1, 3] })] }));
  eq(w.days.map((x) => x.instances.length), [1, 0, 1, 0, 0, 0, 0]);
});

test('2 haftada bir: referans validFrom haftası', () => {
  const dt = data({ routines: [routine({ weekInterval: 2 })] });
  const on = (y, m, day) => S.buildWeek(d(y, m, day), dt).days[0].instances.length;
  eq(on(2026, 9, 21), 1, '1. hafta');
  eq(on(2026, 9, 28), 0, '2. hafta');
  eq(on(2026, 10, 5), 1, '3. hafta');
  eq(on(2026, 10, 12), 0, '4. hafta');
});

test('2 haftada bir: validFrom hafta ortasındaysa referans yine o haftanın Pazartesi’si', () => {
  // validFrom Çarşamba 23 Eyl; rutin Pazartesi ve Perşembe.
  const dt = data({ routines: [routine({ days: [1, 4], validFrom: '2026-09-23', weekInterval: 2 })] });
  const w1 = S.buildWeek(d(2026, 9, 21), dt);
  eq(w1.days.map((x) => x.instances.length), [0, 0, 0, 1, 0, 0, 0], 'Pzt 21 Eyl validFrom öncesi');
  eq(S.buildWeek(d(2026, 9, 28), dt).days.map((x) => x.instances.length), [0, 0, 0, 0, 0, 0, 0]);
  eq(S.buildWeek(d(2026, 10, 5), dt).days.map((x) => x.instances.length), [1, 0, 0, 1, 0, 0, 0]);
});

test('validFrom ve validUntil sınırları dahildir', () => {
  const dt = data({ routines: [routine({ days: [1, 2, 3, 4, 5, 6, 7], validFrom: '2026-10-27', validUntil: '2026-10-30' })] });
  eq(S.buildWeek(d(2026, 10, 26), dt).days.map((x) => x.instances.length), [0, 1, 1, 1, 1, 0, 0]);
});

test('tek seferlik etkinlik yalnızca kendi gününde', () => {
  const dt = data({ events: [event({ date: '2026-11-15' })] });
  eq(S.buildWeek(d(2026, 11, 9), dt).days.map((x) => x.instances.length), [0, 0, 0, 0, 0, 0, 1]);
  eq(S.buildWeek(d(2026, 11, 16), dt).days.map((x) => x.instances.length), [0, 0, 0, 0, 0, 0, 0]);
});

// ---- override ----

test('cancel override: örnek kalır, cancelled: true', () => {
  const dt = data({ routines: [routine()], overrides: [{ routineId: 'r1', date: '2026-11-02', action: 'cancel' }] });
  const inst = S.buildWeek(d(2026, 11, 2), dt).days[0].instances[0];
  eq([inst.cancelled, inst.cancelReason, inst.modified], [true, 'override', false]);
  eq(S.buildWeek(d(2026, 11, 9), dt).days[0].instances[0].cancelled, false, 'diğer haftalar etkilenmez');
});

test('modify override: değişiklik uygulanır, modified: true', () => {
  const dt = data({
    routines: [routine()],
    overrides: [{ routineId: 'r1', date: '2026-11-02', action: 'modify', changes: { start: '13:00', end: '14:50', location: 'C-101' } }],
  });
  const inst = S.buildWeek(d(2026, 11, 2), dt).days[0].instances[0];
  eq([inst.start, inst.end, inst.startMin, inst.location, inst.modified, inst.cancelled], ['13:00', '14:50', 780, 'C-101', true, false]);
  eq(inst.title, 'İstatistik', 'değişmeyen alan korunur');
});

test('tatil günü: gün işaretlenir, rutin tatil nedeniyle iptal', () => {
  const dt = data({ routines: [routine({ days: [4] })] });
  const day = S.buildWeek(d(2026, 10, 26), dt).days[3];
  eq(day.holiday.name, 'Cumhuriyet Bayramı');
  eq([day.instances[0].cancelled, day.instances[0].cancelReason], [true, 'holiday']);
});

test('tatilde boş modify override rutini yine de gösterir', () => {
  const dt = data({ routines: [routine({ days: [4] })], overrides: [{ routineId: 'r1', date: '2026-10-29', action: 'modify', changes: {} }] });
  const inst = S.buildWeek(d(2026, 10, 26), dt).days[3].instances[0];
  eq([inst.cancelled, inst.modified], [false, false]);
});

test('kullanıcı tatili resmî tatil gibi işaretlenir', () => {
  eq(getHoliday('2026-12-31', [{ date: '2026-12-31', name: 'Yılbaşı arifesi' }]).name, 'Yılbaşı arifesi');
  eq(getHoliday('2026-12-30', []), null);
});

// ---- çakışma gruplama ----

const mk = (title, start, end, extra = {}) => ({ title, start, end, startMin: D.timeToMinutes(start), endMin: D.timeToMinutes(end), cancelled: false, ...extra });

test('aynı saatte 3 etkinlik → 3 sütun', () => {
  const list = S.layoutDay([mk('A', '10:00', '11:30'), mk('B', '10:00', '11:00'), mk('C', '10:30', '11:30')]);
  eq(list.map((x) => [x.col, x.cols, x.conflict]), [[0, 3, true], [1, 3, true], [2, 3, true]]);
});

test('zincir çakışma: boşalan sütun yeniden kullanılır', () => {
  const list = S.layoutDay([mk('A', '09:00', '10:00'), mk('B', '09:30', '10:30'), mk('C', '10:00', '11:00')]);
  eq(list.map((x) => [x.col, x.cols]), [[0, 2], [1, 2], [0, 2]]);
});

test('uç uca etkinlikler çakışma değildir', () => {
  const list = S.layoutDay([mk('A', '09:00', '10:00'), mk('B', '10:00', '11:00')]);
  eq(list.map((x) => [x.col, x.cols, x.conflict]), [[0, 1, false], [0, 1, false]]);
});

test('iptal edilen örnek yer kaplar ama çakışma sayılmaz', () => {
  const list = S.layoutDay([mk('A', '09:00', '10:00', { cancelled: true }), mk('B', '09:30', '10:30')]);
  eq(list.map((x) => [x.cols, x.conflict]), [[2, false], [2, false]]);
});

test('buildDay çakışmayı rutin + tek seferlik arasında da bulur', () => {
  const dt = data({ routines: [routine({ days: [3], start: '15:00', end: '16:30', title: 'Kariyer Günü' })], events: [event({ date: '2026-10-28', start: '15:30', end: '16:30', title: 'Staj' })] });
  const day = S.buildDay('2026-10-28', dt);
  eq(titles(day), ['Kariyer Günü', 'Staj']);
  eq(day.instances.map((x) => [x.col, x.cols, x.conflict]), [[0, 2, true], [1, 2, true]]);
});

// ---- yaklaşanlar ----

test('getUpcoming: devam eden, gelecek; geçmiş ve iptaller hariç; sıralı', () => {
  const dt = data({
    routines: [
      routine({ id: 'r1', title: 'Ofis saati', days: [2], start: '13:00', end: '13:30' }),
      routine({ id: 'r2', title: 'ML', days: [2], start: '14:00', end: '15:50' }),
      routine({ id: 'r3', title: 'Kütüphane', days: [2], start: '09:00', end: '12:00' }),
      routine({ id: 'r4', title: 'İstatistik', days: [4] }),
    ],
    events: [event({ id: 'e1', date: '2026-11-03', title: 'Sekizinci gün' }), event({ id: 'e2', date: '2026-10-28', start: '10:00', end: '11:00', title: 'Yarın' })],
  });
  const up = S.getUpcoming(d(2026, 10, 27, 13, 15), dt);
  // Kütüphane bitti, Perşembe İstatistik tatilde iptal, 3 Kasım 8. gün.
  eq(up.map((u) => u.title), ['Ofis saati', 'ML', 'Yarın']);
  eq([up[0].ongoing, up[1].ongoing, Math.round(up[1].minutesUntil)], [true, false, 45]);
});

test('getUpcoming 7 gün: bugün dahil, 8. gün hariç', () => {
  const dt = data({ events: [event({ date: '2026-11-02', start: '09:00' }), event({ id: 'e2', date: '2026-11-03', start: '09:00' })] });
  eq(S.getUpcoming(d(2026, 10, 27, 8, 0), dt).map((u) => u.date), ['2026-11-02']);
});

// ---- findConflicts ----

test('findConflicts: rutin taslak İstatistik ile çakışır', () => {
  const dt = data({ routines: [routine({ days: [1, 4] })] });
  const c = S.findConflicts({ kind: 'routine', days: [1, 4], start: '10:00', end: '11:50', validFrom: '2026-09-21', validUntil: '2027-01-10', weekInterval: 1 }, dt);
  eq(c, [{ title: 'İstatistik', label: 'Pzt, Per 09:00–10:50' }]);
});

test('findConflicts: kendisiyle ve uç uca saatle çakışmaz', () => {
  const dt = data({ routines: [routine()] });
  eq(S.findConflicts({ kind: 'routine', id: 'r1', days: [1], start: '09:00', end: '10:50', validFrom: '2026-09-21', validUntil: '2027-01-10' }, dt), []);
  eq(S.findConflicts({ kind: 'event', date: '2026-11-02', start: '10:50', end: '12:00' }, dt), []);
});

test('findConflicts: iki "2 haftada bir" rutin farklı haftalardaysa çakışmaz', () => {
  const dt = data({ routines: [routine({ weekInterval: 2, validFrom: '2026-09-21' })] });
  const base = { kind: 'routine', days: [1], start: '09:00', end: '10:00', validUntil: '2027-01-10', weekInterval: 2 };
  eq(S.findConflicts({ ...base, validFrom: '2026-09-28' }, dt).length, 0);
  eq(S.findConflicts({ ...base, validFrom: '2026-10-05' }, dt).length, 1);
});

test('findConflicts: tek seferlik, iptal edilmiş haftayı yok sayar', () => {
  const dt = data({ routines: [routine()], overrides: [{ routineId: 'r1', date: '2026-11-02', action: 'cancel' }] });
  eq(S.findConflicts({ kind: 'event', date: '2026-11-02', start: '09:30', end: '10:00' }, dt), []);
  eq(S.findConflicts({ kind: 'event', date: '2026-11-09', start: '09:30', end: '10:00' }, dt).length, 1);
});

// ---- çalıştırıcı ----

export function runTests() {
  const results = [];
  for (const t of tests) {
    try {
      t.fn();
      results.push({ name: t.name, ok: true });
    } catch (err) {
      results.push({ name: t.name, ok: false, error: err.message });
    }
  }
  return results;
}
