// Hafta hesaplama mantığı. DOM'a dokunmaz; tüm fonksiyonlar saf.

import {
  addDays, addDaysISO, combine, dayOfWeek, diffDays, DAY_SHORT, formatDayMonth,
  parseISODate, startOfWeek, timeToMinutes, toISODate,
} from './dates.js';
import { getHoliday } from './holidays.js';

export const CATEGORIES = ['ders', 'is', 'kisisel', 'sinav', 'sosyal', 'diger'];

export const CATEGORY_LABELS = {
  ders: 'Ders', is: 'İş', kisisel: 'Kişisel', sinav: 'Sınav', sosyal: 'Sosyal', diger: 'Diğer',
};

/** Tarihin Pazartesi'si. */
export function getWeekStart(date) {
  return startOfWeek(date);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** 2 haftada bir tekrarda referans, validFrom'un haftasıdır. */
function weekIndexFrom(refISO, date) {
  return Math.round(diffDays(startOfWeek(parseISODate(refISO)), startOfWeek(date)) / 7);
}

/** Rutin bu tarihte gerçekleşiyor mu (override'lar hariç)? */
export function routineOccursOn(routine, date) {
  const iso = toISODate(date);
  if (!routine.days.includes(dayOfWeek(date))) return false;
  if (iso < routine.validFrom || iso > routine.validUntil) return false;
  const interval = routine.weekInterval || 1;
  if (interval > 1) {
    const w = weekIndexFrom(routine.validFrom, date);
    if (w < 0 || w % interval !== 0) return false;
  }
  return true;
}

function makeInstance(kind, src, iso) {
  return {
    key: `${kind}:${src.id}:${iso}`,
    kind,
    id: src.id,
    routineId: kind === 'routine' ? src.id : null,
    date: iso,
    title: src.title,
    start: src.start,
    end: src.end,
    startMin: timeToMinutes(src.start),
    endMin: timeToMinutes(src.end),
    location: src.location || '',
    category: src.category,
    note: src.note || '',
    weekInterval: kind === 'routine' ? (src.weekInterval || 1) : null,
    cancelled: false,
    cancelReason: null,
    modified: false,
    col: 0,
    cols: 1,
    conflict: false,
  };
}

const OVERRIDE_FIELDS = ['title', 'start', 'end', 'location', 'note'];

/**
 * Bir günün örnekleri: rutinler açılır, tek seferlikler eklenir, override'lar
 * uygulanır, tatil işaretlenir ve çakışma yerleşimi hesaplanır.
 */
export function buildDay(iso, data) {
  const date = parseISODate(iso);
  const settings = data.settings || {};
  const holiday = getHoliday(iso, settings.customHolidays || []);
  const instances = [];

  for (const r of data.routines || []) {
    if (!routineOccursOn(r, date)) continue;
    const inst = makeInstance('routine', r, iso);
    const ov = (data.overrides || []).find((o) => o.routineId === r.id && o.date === iso);
    if (ov && ov.action === 'cancel') {
      inst.cancelled = true;
      inst.cancelReason = 'override';
    } else if (ov && ov.action === 'modify') {
      const changes = ov.changes || {};
      for (const f of OVERRIDE_FIELDS) {
        if (changes[f] !== undefined) inst[f] = changes[f];
      }
      inst.startMin = timeToMinutes(inst.start);
      inst.endMin = timeToMinutes(inst.end);
      // Boş "modify", tatilde rutini yine de göstermek içindir.
      inst.modified = Object.keys(changes).length > 0;
    } else if (holiday) {
      inst.cancelled = true;
      inst.cancelReason = 'holiday';
    }
    instances.push(inst);
  }

  for (const e of data.events || []) {
    if (e.date === iso) instances.push(makeInstance('event', e, iso));
  }

  instances.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.title.localeCompare(b.title, 'tr'));
  layoutDay(instances);
  return { iso, date, dow: dayOfWeek(date), holiday, instances };
}

/**
 * Çakışan örnekleri yan yana yerleştirir: her örneğe sütun indeksi (col) ve
 * kümesindeki sütun sayısı (cols) verir. İptal edilmemiş iki örnek üst üste
 * biniyorsa ikisi de conflict: true olur. Uç uca (10:00 biter, 10:00 başlar)
 * çakışma sayılmaz. Girdinin başlangıca göre sıralı olduğu varsayılır.
 */
export function layoutDay(instances) {
  let cluster = [];
  let clusterEnd = -1;
  let colEnds = [];

  const flush = () => {
    const cols = colEnds.length || 1;
    for (const it of cluster) it.cols = cols;
    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        const a = cluster[i], b = cluster[j];
        if (!a.cancelled && !b.cancelled && overlaps(a.startMin, a.endMin, b.startMin, b.endMin)) {
          a.conflict = true;
          b.conflict = true;
        }
      }
    }
    cluster = [];
    colEnds = [];
  };

  for (const it of instances) {
    it.conflict = false;
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= it.startMin);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.endMin);
    } else {
      colEnds[col] = it.endMin;
    }
    it.col = col;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  if (cluster.length) flush();
  return instances;
}

/** Haftanın 7 günü (Pazartesi'den başlayarak). */
export function buildWeek(weekStart, data) {
  const startISO = toISODate(getWeekStart(weekStart));
  const days = [];
  for (let i = 0; i < 7; i++) days.push(buildDay(addDaysISO(startISO, i), data));
  return { weekStart: startISO, days };
}

/**
 * Şu andan itibaren `days` günlük (bugün dahil) örnekler, başlangıca göre sıralı.
 * Bitmiş ve iptal edilmiş olanlar çıkarılır; başlamış olanlar ongoing: true.
 */
export function getUpcoming(now, data, days = 7) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const day = buildDay(toISODate(addDays(now, i)), data);
    for (const inst of day.instances) {
      if (inst.cancelled) continue;
      const startAt = combine(inst.date, inst.start);
      const endAt = combine(inst.date, inst.end);
      if (endAt <= now) continue;
      out.push({
        ...inst,
        startAt,
        endAt,
        ongoing: startAt <= now,
        minutesUntil: Math.max(0, (startAt - now) / 60000),
        dayOffset: i,
        dayHoliday: day.holiday,
      });
    }
  }
  out.sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt);
  return out;
}

/** Bu haftanın kategori bazında toplam dakikaları (iptaller hariç). */
export function weekSummary(week) {
  const totals = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  let count = 0;
  for (const day of week.days) {
    for (const inst of day.instances) {
      if (inst.cancelled) continue;
      totals[inst.category] += inst.endMin - inst.startMin;
      count++;
    }
  }
  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  return { totals, total, count };
}

function daysLabel(days) {
  return days.slice().sort((a, b) => a - b).map((d) => DAY_SHORT[d - 1]).join(', ');
}

/**
 * Eklenen/düzenlenen taslağın çakıştığı etkinlikler (satır içi uyarı için).
 * candidate.kind: 'routine' | 'event' | 'override'
 *  - routine: { id?, days, start, end, validFrom, validUntil, weekInterval }
 *  - event:   { id?, date, start, end }
 *  - override:{ routineId, date, start, end }
 * Dönüş: [{ title, label }]
 */
export function findConflicts(candidate, data) {
  const s = timeToMinutes(candidate.start);
  const e = timeToMinutes(candidate.end);
  if (!(e > s)) return [];
  const results = [];
  const seen = new Set();
  const add = (title, label) => {
    const k = `${title}|${label}`;
    if (!seen.has(k)) {
      seen.add(k);
      results.push({ title, label });
    }
  };

  if (candidate.kind === 'event' || candidate.kind === 'override') {
    const day = buildDay(candidate.date, data);
    for (const inst of day.instances) {
      if (inst.cancelled) continue;
      if (candidate.kind === 'event' && inst.kind === 'event' && inst.id === candidate.id) continue;
      if (candidate.kind === 'override' && inst.routineId === candidate.routineId) continue;
      if (overlaps(s, e, inst.startMin, inst.endMin)) {
        add(inst.title, `${formatDayMonth(day.date)} ${inst.start}–${inst.end}`);
      }
    }
    return results;
  }

  // Rutin: diğer rutinlerle ve geçerlilik aralığındaki tek seferliklerle karşılaştır.
  const cDays = candidate.days || [];
  const cInterval = candidate.weekInterval || 1;
  for (const r of data.routines || []) {
    if (r.id === candidate.id) continue;
    const shared = r.days.filter((d) => cDays.includes(d));
    if (!shared.length) continue;
    if (!overlaps(s, e, timeToMinutes(r.start), timeToMinutes(r.end))) continue;
    if (r.validUntil < candidate.validFrom || candidate.validUntil < r.validFrom) continue;
    const rInterval = r.weekInterval || 1;
    if (cInterval === 2 && rInterval === 2) {
      const offset = weekIndexFrom(candidate.validFrom, parseISODate(r.validFrom));
      if (Math.abs(offset) % 2 === 1) continue;
    }
    add(r.title, `${daysLabel(shared)} ${r.start}–${r.end}`);
  }
  for (const ev of data.events || []) {
    if (ev.date < candidate.validFrom || ev.date > candidate.validUntil) continue;
    const d = parseISODate(ev.date);
    if (!cDays.includes(dayOfWeek(d))) continue;
    if (cInterval === 2 && weekIndexFrom(candidate.validFrom, d) % 2 !== 0) continue;
    if (overlaps(s, e, timeToMinutes(ev.start), timeToMinutes(ev.end))) {
      add(ev.title, `${formatDayMonth(d)} ${ev.start}–${ev.end}`);
    }
  }
  return results;
}
