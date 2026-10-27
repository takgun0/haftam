// İçe aktarılan / kayıtlı verinin doğrulanması. Bilinmeyen alanlar atılır;
// eksik isteğe bağlı alanlar varsayılanla doldurulur; hatalı değerler Türkçe
// hata mesajı üretir ve veri reddedilir.

import { isValidISODate, isValidTime, timeToMinutes } from './dates.js';
import { CATEGORIES } from './schedule.js';

export const SCHEMA_VERSION = 1;

export const LIMITS = {
  title: 120,
  location: 120,
  note: 1000,
  holidayName: 80,
  routines: 500,
  events: 2000,
  overrides: 5000,
  holidays: 200,
};

export const DEFAULT_SETTINGS = {
  termStart: '2026-09-21',
  termEnd: '2027-01-10',
  dayStart: '08:00',
  dayEnd: '22:00',
  showWeekend: true,
  theme: 'system',
  customHolidays: [],
  lastBackupAt: null,
};

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const THEMES = ['system', 'light', 'dark'];
const OVERRIDE_FIELDS = ['title', 'start', 'end', 'location', 'note'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function makeCtx() {
  const errors = [];
  return {
    errors,
    err(where, msg) {
      errors.push(`${where}: ${msg}`);
    },
  };
}

function text(ctx, where, label, v, max, { required = false } = {}) {
  if (v === undefined || v === null) {
    if (required) ctx.err(where, `${label} zorunlu.`);
    return '';
  }
  if (typeof v !== 'string') {
    ctx.err(where, `${label} metin olmalı.`);
    return '';
  }
  const t = v.trim();
  if (required && !t) ctx.err(where, `${label} boş olamaz.`);
  if (t.length > max) ctx.err(where, `${label} en fazla ${max} karakter olabilir (${t.length}).`);
  return t;
}

function date(ctx, where, label, v) {
  if (!isValidISODate(v)) {
    ctx.err(where, `${label} “YYYY-AA-GG” biçiminde geçerli bir tarih olmalı (gelen: ${show(v)}).`);
    return null;
  }
  return v;
}

function time(ctx, where, label, v) {
  if (!isValidTime(v)) {
    ctx.err(where, `${label} “SS:DD” biçiminde olmalı (gelen: ${show(v)}).`);
    return null;
  }
  return v;
}

function show(v) {
  const s = typeof v === 'string' ? `“${v}”` : JSON.stringify(v);
  return s === undefined ? 'boş' : s.length > 40 ? s.slice(0, 40) + '…' : s;
}

function category(ctx, where, v) {
  if (!CATEGORIES.includes(v)) {
    ctx.err(where, `kategori şunlardan biri olmalı: ${CATEGORIES.join(', ')} (gelen: ${show(v)}).`);
    return null;
  }
  return v;
}

function timeRange(ctx, where, start, end) {
  if (start && end && timeToMinutes(end) <= timeToMinutes(start)) {
    ctx.err(where, `bitiş saati (${end}) başlangıçtan (${start}) sonra olmalı.`);
  }
}

function id(ctx, where, v, seen) {
  if (typeof v !== 'string' || !ID.test(v)) {
    ctx.err(where, 'kimlik (id) geçersiz.');
    return null;
  }
  if (seen.has(v)) ctx.err(where, `aynı kimlik (${v}) birden fazla kez kullanılmış.`);
  seen.add(v);
  return v;
}

function list(ctx, where, v, max) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    ctx.err(where, 'liste olmalı.');
    return [];
  }
  if (v.length > max) {
    ctx.err(where, `en fazla ${max} kayıt olabilir (${v.length}).`);
    return [];
  }
  return v;
}

function validateSettings(ctx, raw) {
  const s = { ...DEFAULT_SETTINGS, customHolidays: [] };
  if (raw === undefined) return s;
  if (!isObj(raw)) {
    ctx.err('Ayarlar', 'nesne olmalı.');
    return s;
  }
  const w = 'Ayarlar';
  if (raw.termStart !== undefined) s.termStart = date(ctx, w, 'dönem başlangıcı', raw.termStart) || s.termStart;
  if (raw.termEnd !== undefined) s.termEnd = date(ctx, w, 'dönem bitişi', raw.termEnd) || s.termEnd;
  if (s.termEnd < s.termStart) ctx.err(w, 'dönem bitişi başlangıçtan önce olamaz.');
  if (raw.dayStart !== undefined) s.dayStart = time(ctx, w, 'gün başlangıcı', raw.dayStart) || s.dayStart;
  if (raw.dayEnd !== undefined) s.dayEnd = time(ctx, w, 'gün bitişi', raw.dayEnd) || s.dayEnd;
  timeRange(ctx, w, s.dayStart, s.dayEnd);
  if (raw.showWeekend !== undefined) {
    if (typeof raw.showWeekend !== 'boolean') ctx.err(w, 'hafta sonu ayarı true/false olmalı.');
    else s.showWeekend = raw.showWeekend;
  }
  if (raw.theme !== undefined) {
    if (!THEMES.includes(raw.theme)) ctx.err(w, `tema şunlardan biri olmalı: ${THEMES.join(', ')}.`);
    else s.theme = raw.theme;
  }
  if (raw.lastBackupAt !== undefined && raw.lastBackupAt !== null) {
    if (typeof raw.lastBackupAt !== 'string' || raw.lastBackupAt.length > 40 || Number.isNaN(Date.parse(raw.lastBackupAt))) {
      ctx.err(w, 'son yedek zamanı geçersiz.');
    } else s.lastBackupAt = raw.lastBackupAt;
  }
  const seenDates = new Set();
  list(ctx, 'Ayarlar › tatiller', raw.customHolidays, LIMITS.holidays).forEach((h, i) => {
    const where = `Tatil ${i + 1}`;
    if (!isObj(h)) return ctx.err(where, 'nesne olmalı.');
    const d = date(ctx, where, 'tarih', h.date);
    const name = text(ctx, where, 'ad', h.name, LIMITS.holidayName, { required: true });
    if (d && seenDates.has(d)) ctx.err(where, `${d} tarihine birden fazla tatil eklenmiş.`);
    if (d) seenDates.add(d);
    s.customHolidays.push({ date: d, name });
  });
  return s;
}

function validateRoutine(ctx, r, i, seen) {
  const where = `Rutin ${i + 1}${isObj(r) && typeof r.title === 'string' ? ` (“${r.title.slice(0, 40)}”)` : ''}`;
  if (!isObj(r)) {
    ctx.err(where, 'nesne olmalı.');
    return null;
  }
  const out = {
    id: id(ctx, where, r.id, seen),
    title: text(ctx, where, 'başlık', r.title, LIMITS.title, { required: true }),
    days: [],
    start: time(ctx, where, 'başlangıç saati', r.start),
    end: time(ctx, where, 'bitiş saati', r.end),
    location: text(ctx, where, 'konum', r.location, LIMITS.location),
    category: category(ctx, where, r.category),
    note: text(ctx, where, 'not', r.note, LIMITS.note),
    validFrom: date(ctx, where, 'geçerlilik başlangıcı', r.validFrom),
    validUntil: date(ctx, where, 'geçerlilik bitişi', r.validUntil),
    weekInterval: 1,
  };
  if (!Array.isArray(r.days) || !r.days.length || !r.days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) {
    ctx.err(where, 'günler 1 (Pzt) ile 7 (Paz) arasında en az bir sayı içermeli.');
  } else {
    out.days = [...new Set(r.days)].sort((a, b) => a - b);
  }
  timeRange(ctx, where, out.start, out.end);
  if (out.validFrom && out.validUntil && out.validUntil < out.validFrom) ctx.err(where, 'geçerlilik bitişi başlangıçtan önce olamaz.');
  if (r.weekInterval !== undefined) {
    if (r.weekInterval !== 1 && r.weekInterval !== 2) ctx.err(where, 'tekrar aralığı 1 veya 2 olmalı.');
    else out.weekInterval = r.weekInterval;
  }
  return out;
}

function validateEvent(ctx, e, i, seen) {
  const where = `Etkinlik ${i + 1}${isObj(e) && typeof e.title === 'string' ? ` (“${e.title.slice(0, 40)}”)` : ''}`;
  if (!isObj(e)) {
    ctx.err(where, 'nesne olmalı.');
    return null;
  }
  const out = {
    id: id(ctx, where, e.id, seen),
    title: text(ctx, where, 'başlık', e.title, LIMITS.title, { required: true }),
    date: date(ctx, where, 'tarih', e.date),
    start: time(ctx, where, 'başlangıç saati', e.start),
    end: time(ctx, where, 'bitiş saati', e.end),
    location: text(ctx, where, 'konum', e.location, LIMITS.location),
    category: category(ctx, where, e.category),
    note: text(ctx, where, 'not', e.note, LIMITS.note),
  };
  timeRange(ctx, where, out.start, out.end);
  return out;
}

function validateOverride(ctx, o, i, routinesById, seenKeys) {
  const where = `Haftalık değişiklik ${i + 1}`;
  if (!isObj(o)) {
    ctx.err(where, 'nesne olmalı.');
    return null;
  }
  const routine = routinesById.get(o.routineId);
  if (!routine) {
    ctx.err(where, 'bağlı olduğu rutin bulunamadı.');
    return null;
  }
  const d = date(ctx, where, 'tarih', o.date);
  const key = `${o.routineId}|${d}`;
  if (seenKeys.has(key)) ctx.err(where, `aynı rutin ve tarih (${d}) için birden fazla değişiklik var.`);
  seenKeys.add(key);
  if (o.action !== 'cancel' && o.action !== 'modify') {
    ctx.err(where, 'işlem “cancel” veya “modify” olmalı.');
    return null;
  }
  const out = { routineId: o.routineId, date: d, action: o.action };
  if (o.action === 'modify') {
    const changes = {};
    const raw = o.changes === undefined ? {} : o.changes;
    if (!isObj(raw)) {
      ctx.err(where, 'değişiklikler nesne olmalı.');
    } else {
      for (const f of OVERRIDE_FIELDS) {
        if (raw[f] === undefined) continue;
        if (f === 'start' || f === 'end') changes[f] = time(ctx, where, f === 'start' ? 'başlangıç saati' : 'bitiş saati', raw[f]);
        else if (f === 'title') changes[f] = text(ctx, where, 'başlık', raw[f], LIMITS.title, { required: true });
        else changes[f] = text(ctx, where, f === 'note' ? 'not' : 'konum', raw[f], f === 'note' ? LIMITS.note : LIMITS.location);
      }
      const s = changes.start || routine.start;
      const e = changes.end || routine.end;
      if (isValidTime(s) && isValidTime(e)) timeRange(ctx, where, s, e);
    }
    out.changes = changes;
  }
  return out;
}

/**
 * Ham veriyi doğrular. Dönüş: { ok, data, errors }.
 * ok false ise data kullanılmamalıdır.
 */
export function validateData(raw) {
  const ctx = makeCtx();
  if (!isObj(raw)) return { ok: false, data: null, errors: ['Dosya bir Haftam yedeği değil (en üst düzeyde nesne bekleniyordu).'] };
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    const msg = typeof raw.schemaVersion === 'number' && raw.schemaVersion > SCHEMA_VERSION
      ? `Bu yedek daha yeni bir Haftam sürümüyle alınmış (şema ${raw.schemaVersion}).`
      : 'Şema sürümü (schemaVersion) eksik ya da tanınmıyor.';
    return { ok: false, data: null, errors: [msg] };
  }

  const settings = validateSettings(ctx, raw.settings);
  const routineIds = new Set();
  const routines = list(ctx, 'Rutinler', raw.routines, LIMITS.routines)
    .map((r, i) => validateRoutine(ctx, r, i, routineIds)).filter(Boolean);
  const eventIds = new Set();
  const events = list(ctx, 'Etkinlikler', raw.events, LIMITS.events)
    .map((e, i) => validateEvent(ctx, e, i, eventIds)).filter(Boolean);
  const byId = new Map(routines.map((r) => [r.id, r]));
  const seenKeys = new Set();
  const overrides = list(ctx, 'Haftalık değişiklikler', raw.overrides, LIMITS.overrides)
    .map((o, i) => validateOverride(ctx, o, i, byId, seenKeys)).filter(Boolean);

  if (ctx.errors.length) return { ok: false, data: null, errors: ctx.errors };
  return { ok: true, data: { schemaVersion: SCHEMA_VERSION, settings, routines, events, overrides }, errors: [] };
}
