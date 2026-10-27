// Başlatma ve olay bağlama.

import { addDays, DAY_SHORT, dayOfWeek, diffDays, formatDayMonth, formatWeekdayLong, isValidISODate, minutesOfDay, minutesToTime, parseISODate, startOfWeek, toISODate } from './dates.js';
import { downloadBackup, downloadICS, pickJSONFile, printWeek } from './export.js';
import { buildWeek, getUpcoming, getWeekStart, routineOccursOn, weekSummary } from './schedule.js';
import { getState, initState, setUI, subscribe, undo, updateData, replaceData } from './state.js';
import { emptyData, load, newId, requestPersist } from './storage.js';
import { LIMITS, validateData } from './validate.js';
import { AppHeader } from './ui/AppHeader.js';
import { choiceDialog, confirmDialog } from './ui/ConfirmDialog.js';
import { EmptyState } from './ui/EmptyState.js';
import { computeRange } from './ui/EventBlock.js';
import { openEventModal } from './ui/EventModal.js';
import { closePopover, openPopover } from './ui/EventPopover.js';
import { MobileView } from './ui/MobileView.js';
import { backupDue, openSettings } from './ui/SettingsPanel.js';
import { showToast } from './ui/Toast.js';
import { UpcomingPanel } from './ui/UpcomingPanel.js';
import { WeekGrid } from './ui/WeekGrid.js';
import { enableDrag } from './ui/dragDrop.js';
import { onboardingSeen, openOnboarding } from './ui/Onboarding.js';
import { h, isTypingTarget } from './ui/dom.js';

const app = document.getElementById('app');
const mqMobile = window.matchMedia('(max-width: 767px)');
const mqDark = window.matchMedia('(prefers-color-scheme: dark)');
let printing = false;
const scrollMemory = new Map();

// ---------- yardımcılar ----------

const hasData = (data) => data.routines.length > 0 || data.events.length > 0;

function effectiveTheme(data) {
  const t = data.settings.theme;
  return t === 'system' ? (mqDark.matches ? 'dark' : 'light') : t;
}

function applyTheme() {
  const theme = effectiveTheme(getState().data);
  document.documentElement.dataset.theme = theme;
}

function termWeekOf(settings, weekStart) {
  const ws = toISODate(weekStart);
  const termStartWeek = startOfWeek(parseISODate(settings.termStart));
  if (ws < toISODate(termStartWeek) || ws > settings.termEnd) return null;
  return Math.floor(diffDays(termStartWeek, weekStart) / 7) + 1;
}

function defaultSelected(weekStart, now, showWeekend) {
  const today = toISODate(now);
  const days = Array.from({ length: showWeekend ? 7 : 5 }, (_, i) => toISODate(addDays(weekStart, i)));
  return days.includes(today) ? today : days[0];
}

function persistOrWarn(ok) {
  if (!ok) showToast('Kaydedilemedi: tarayıcı depolaması dolu ya da kapalı. Yedek almayı unutma.', { kind: 'error', timeout: 8000 });
  return ok;
}

function mutate(fn, toast) {
  const ok = persistOrWarn(updateData(fn));
  if (ok && toast) showToast(toast.message, toast.undo ? { action: { label: 'Geri al', onClick: () => undo() } } : { kind: 'ok' });
  return ok;
}

// ---------- veri işlemleri ----------

function upsert(list, value) {
  const i = list.findIndex((x) => x.id === value.id);
  if (i === -1) list.push(value);
  else list[i] = value;
}

function setOverride(d, routineId, date, override) {
  d.overrides = d.overrides.filter((o) => !(o.routineId === routineId && o.date === date));
  if (override) d.overrides.push({ routineId, date, ...override });
}

function handleSave(result) {
  if (result.type === 'routine') {
    const isNew = !result.value.id;
    const value = { ...result.value, id: result.value.id || newId() };
    mutate((d) => upsert(d.routines, value), { message: isNew ? `“${value.title}” rutini eklendi` : 'Rutin güncellendi (tüm haftalar)', undo: true });
  } else if (result.type === 'event') {
    const isNew = !result.value.id;
    const value = { ...result.value, id: result.value.id || newId() };
    mutate((d) => upsert(d.events, value), { message: isNew ? `“${value.title}” eklendi` : 'Etkinlik güncellendi', undo: true });
    goToDate(value.date);
  } else if (result.type === 'override') {
    const { routineId, date, changes } = result;
    mutate((d) => {
      const day = buildWeek(parseISODate(date), d).days.find((x) => x.iso === date);
      const onHoliday = !!(day && day.holiday);
      const empty = Object.keys(changes).length === 0;
      if (empty && !onHoliday) setOverride(d, routineId, date, null);
      else setOverride(d, routineId, date, { action: 'modify', changes });
    }, { message: 'Bu haftanın değişikliği kaydedildi', undo: true });
  }
}

const popoverActions = {
  editWeek: (inst) => openEventModal({ mode: 'override', data: getState().data, today: getState().ui.now, instance: inst, routine: findRoutine(inst.routineId), onSave: handleSave }),
  editAll: (inst) => {
    const routine = findRoutine(inst.routineId);
    openEventModal({ mode: 'edit-routine', data: getState().data, today: getState().ui.now, routine, onSave: handleSave, onDelete: () => deleteRoutine(routine) });
  },
  cancelWeek: (inst) => mutate((d) => setOverride(d, inst.routineId, inst.occurrenceDate, { action: 'cancel' }), { message: `${inst.title} bu hafta için iptal edildi`, undo: true }),
  restoreWeek: (inst) => mutate((d) => setOverride(d, inst.routineId, inst.occurrenceDate, null), { message: 'İptal geri alındı', undo: true }),
  showOnHoliday: (inst) => mutate((d) => setOverride(d, inst.routineId, inst.occurrenceDate, { action: 'modify', changes: {} }), { message: `${inst.title} tatil gününde de gösterilecek`, undo: true }),
  resetWeek: (inst) => mutate((d) => setOverride(d, inst.routineId, inst.occurrenceDate, null), { message: 'Bu haftanın değişikliği geri alındı', undo: true }),
  deleteRoutine: (inst) => deleteRoutine(findRoutine(inst.routineId)),
  editEvent: (inst) => {
    const event = getState().data.events.find((e) => e.id === inst.id);
    openEventModal({ mode: 'edit-event', data: getState().data, today: getState().ui.now, event, onSave: handleSave, onDelete: () => deleteEvent(event) });
  },
  deleteEvent: (inst) => deleteEvent(getState().data.events.find((e) => e.id === inst.id)),
};

function findRoutine(id) {
  return getState().data.routines.find((r) => r.id === id);
}

async function deleteRoutine(routine) {
  if (!routine) return;
  const ok = await confirmDialog({
    title: `“${routine.title}” silinsin mi?`,
    body: 'Bu bir rutin: tüm haftalardaki örnekleri ve haftalık değişiklikleri silinir.',
    confirmLabel: 'Rutini sil',
    danger: true,
  });
  if (!ok) return;
  mutate((d) => {
    d.routines = d.routines.filter((r) => r.id !== routine.id);
    d.overrides = d.overrides.filter((o) => o.routineId !== routine.id);
  }, { message: `“${routine.title}” silindi`, undo: true });
}

async function deleteEvent(event) {
  if (!event) return;
  const ok = await confirmDialog({ title: `“${event.title}” silinsin mi?`, body: 'Bu tek seferlik etkinlik kalıcı olarak silinir.', confirmLabel: 'Sil', danger: true });
  if (!ok) return;
  mutate((d) => { d.events = d.events.filter((e) => e.id !== event.id); }, { message: `“${event.title}” silindi`, undo: true });
}

// ---------- sürükle-bırak ----------

function dayLabel(iso) {
  const d = parseISODate(iso);
  return `${DAY_SHORT[dayOfWeek(d) - 1]} ${formatDayMonth(d)}`;
}

async function handleDrop(inst, to) {
  const where = `${dayLabel(to.date)} ${to.start}–${to.end}`;
  if (inst.kind === 'event') {
    mutate((d) => {
      const e = d.events.find((x) => x.id === inst.id);
      if (e) Object.assign(e, { date: to.date, start: to.start, end: to.end });
    }, { message: `“${inst.title}” taşındı · ${where}`, undo: true });
    return;
  }
  const routine = findRoutine(inst.routineId);
  if (!routine) return;
  const fromDow = dayOfWeek(parseISODate(inst.occurrenceDate));
  const toDow = dayOfWeek(parseISODate(to.date));
  const timeChanged = to.start !== routine.start;
  const allSub = toDow !== fromDow
    ? `Her hafta ${formatWeekdayLong(parseISODate(inst.occurrenceDate))} yerine ${formatWeekdayLong(parseISODate(to.date))}, ${to.start}–${to.end}`
    : `Her hafta ${to.start}–${to.end}`;
  const choice = await choiceDialog({
    title: `“${inst.title}” taşınsın mı?`,
    body: 'Bu bir rutin. Değişiklik hangi haftalara uygulansın?',
    iconName: 'repeat',
    options: [
      { value: 'week', label: 'Sadece bu hafta', sub: where, primary: true },
      { value: 'all', label: 'Tüm haftalar', sub: allSub + (timeChanged && routine.days.length > 1 ? ' (rutinin diğer günlerinin saati de değişir)' : '') },
    ],
  });
  if (choice === 'week') {
    mutate((d) => {
      const prev = d.overrides.find((o) => o.routineId === routine.id && o.date === inst.occurrenceDate && o.action === 'modify');
      const changes = { ...(prev ? prev.changes : {}), start: to.start, end: to.end, date: to.date };
      if (changes.start === routine.start) delete changes.start;
      if (changes.end === routine.end) delete changes.end;
      if (changes.date === inst.occurrenceDate) delete changes.date;
      setOverride(d, routine.id, inst.occurrenceDate, Object.keys(changes).length ? { action: 'modify', changes } : null);
    }, { message: `Bu hafta taşındı · ${where}`, undo: true });
  } else if (choice === 'all') {
    mutate((d) => {
      const r = d.routines.find((x) => x.id === routine.id);
      r.start = to.start;
      r.end = to.end;
      if (toDow !== fromDow) r.days = [...new Set(r.days.filter((x) => x !== fromDow).concat(toDow))].sort((a, b) => a - b);
      // Artık gerçekleşmeyen günlere bağlı haftalık değişiklikleri temizle
      d.overrides = d.overrides.filter((o) => o.routineId !== r.id || routineOccursOn(r, parseISODate(o.date)));
    }, { message: `Rutin güncellendi (tüm haftalar) · ${allSub}`, undo: true });
  }
}

// ---------- ayarlar ----------

const settingsActions = {
  updateSettings: (fn) => persistOrWarn(updateData((d) => { fn(d.settings); }, { undoable: false })),
  applyTermToRoutines: async () => {
    const { settings, routines } = getState().data;
    const ok = await confirmDialog({
      title: 'Dönem tarihleri rutinlere uygulansın mı?',
      body: `${routines.length} rutinin geçerliliği ${settings.termStart} – ${settings.termEnd} olarak değişecek.`,
      confirmLabel: 'Uygula',
    });
    if (!ok) return;
    mutate((d) => {
      for (const r of d.routines) {
        r.validFrom = d.settings.termStart;
        r.validUntil = d.settings.termEnd;
      }
    }, { message: 'Rutinlerin geçerlilik tarihleri güncellendi', undo: true });
  },
  addHoliday: ({ date, name }) => {
    if (!isValidISODate(date)) return 'Bir tarih seç.';
    if (!name) return 'Tatilin adını yaz.';
    if (name.length > LIMITS.holidayName) return `Ad en fazla ${LIMITS.holidayName} karakter olabilir.`;
    if (getState().data.settings.customHolidays.some((x) => x.date === date)) return 'Bu tarihe zaten bir tatil eklemişsin.';
    mutate((d) => { d.settings.customHolidays.push({ date, name }); }, { message: `${name} eklendi` });
    return null;
  },
  removeHoliday: (date) => mutate((d) => {
    d.settings.customHolidays = d.settings.customHolidays.filter((x) => x.date !== date);
  }, { message: 'Tatil kaldırıldı', undo: true }),
  backup: () => backup(),
  exportICS: () => {
    const name = downloadICS(getState().data);
    showToast(`Takvim dosyası indirildi · ${name}`, { kind: 'ok' });
  },
  importBackup: () => importBackup(),
  clearAll: () => clearAll(),
  showTour: () => startTour(),
};

function startTour() {
  const { data, ui } = getState();
  if (ui.mobile) setUI({ tab: 'gun' });
  openOnboarding({ mobile: ui.mobile, hasData: hasData(data), onAddRoutine: () => openCreate({ kind: 'routine' }) });
}

async function importBackup() {
  const res = await pickJSONFile();
  if (!res) return;
  const fail = (body, details) => confirmDialog({ title: 'Yedek yüklenemedi', body, details, alertOnly: true, confirmLabel: 'Tamam', iconName: 'alert' });
  if (res.error) return fail(res.error);
  let parsed;
  try {
    parsed = JSON.parse(res.text);
  } catch {
    return fail(`“${res.name}” geçerli bir JSON dosyası değil. Mevcut verin değiştirilmedi.`);
  }
  const result = validateData(parsed);
  if (!result.ok) {
    const shown = result.errors.slice(0, 8);
    if (result.errors.length > shown.length) shown.push(`… ve ${result.errors.length - shown.length} hata daha`);
    return fail('Dosyada şu sorunlar var. Mevcut verin değiştirilmedi.', shown);
  }
  const { data } = getState();
  if (hasData(data)) {
    const ok = await confirmDialog({
      title: 'Mevcut program değiştirilsin mi?',
      body: `Yedekte ${result.data.routines.length} rutin ve ${result.data.events.length} tek seferlik etkinlik var. Şu anki programının yerine geçecek.`,
      confirmLabel: 'Yedeği yükle',
    });
    if (!ok) return;
  }
  if (persistOrWarn(replaceData(result.data))) {
    showToast(`Yedek yüklendi · ${result.data.routines.length} rutin, ${result.data.events.length} etkinlik`, { action: { label: 'Geri al', onClick: () => undo() } });
  }
}

function backup() {
  updateData((d) => { d.settings.lastBackupAt = new Date().toISOString(); }, { undoable: false });
  const name = downloadBackup(getState().data);
  showToast(`Yedek indirildi · ${name}`, { kind: 'ok' });
}

async function clearAll() {
  const { data } = getState();
  const ok = await confirmDialog({
    title: 'Tüm veriler silinsin mi?',
    body: `${data.routines.length} rutin, ${data.events.length} tek seferlik etkinlik ve ayarların bu tarayıcıdan silinir. Önce yedek almanı öneririz.`,
    confirmLabel: 'Tümünü sil',
    danger: true,
    requireText: 'SİL',
  });
  if (!ok) return;
  if (persistOrWarn(replaceData(emptyData()))) showToast('Tüm veriler silindi', { action: { label: 'Geri al', onClick: () => undo() } });
}

// ---------- gezinme ----------

function goToWeek(weekStart) {
  closePopover({ restoreFocus: false });
  const { ui, data } = getState();
  setUI({ weekStart, selectedISO: defaultSelected(weekStart, ui.now, data.settings.showWeekend) });
}

function goToDate(iso) {
  const ws = getWeekStart(parseISODate(iso));
  setUI({ weekStart: ws, selectedISO: iso });
}

function openCreate(defaults = {}) {
  closePopover({ restoreFocus: false });
  const { ui, data } = getState();
  const todayISO = toISODate(ui.now);
  const weekDays = Array.from({ length: 7 }, (_, i) => toISODate(addDays(ui.weekStart, i)));
  const date = defaults.date || (weekDays.includes(todayISO) ? todayISO : weekDays[0]);
  let start = '09:00';
  if (date === todayISO) {
    const next = Math.ceil((minutesOfDay(ui.now) + 1) / 60) * 60;
    if (next <= 22 * 60) start = minutesToTime(next);
  }
  openEventModal({ mode: 'create', data, today: ui.now, defaults: { kind: 'routine', ...defaults, date, start }, onSave: handleSave });
}

/** Yaklaşan listesinden: o haftaya git, bloğu bul ve detayını aç. */
function openUpcoming(item) {
  const { ui } = getState();
  goToDate(item.date);
  if (ui.mobile) setUI({ tab: 'gun' });
  const el = app.querySelector(`[data-fk="${CSS.escape(item.key)}"]`);
  if (el) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const inst = buildWeek(parseISODate(item.date), getState().data).days.find((d) => d.iso === item.date)
      .instances.find((x) => x.key === item.key);
    if (inst) openPopover(inst, el, popoverActions);
  }
}

const actions = {
  prevWeek: () => goToWeek(addDays(getState().ui.weekStart, -7)),
  nextWeek: () => goToWeek(addDays(getState().ui.weekStart, 7)),
  today: () => {
    goToWeek(getWeekStart(getState().ui.now));
    setUI({ tab: 'gun', scrollToNow: true });
  },
  openCreate,
  openPopover: (inst, el) => openPopover(inst, el, popoverActions),
  openUpcoming,
  selectDay: (iso) => setUI({ selectedISO: iso }),
  setTab: (tab) => setUI({ tab }),
  toggleUpcoming: () => setUI({ upcomingOpen: !getState().ui.upcomingOpen }),
  toggleTheme: () => {
    const next = effectiveTheme(getState().data) === 'dark' ? 'light' : 'dark';
    updateData((d) => { d.settings.theme = next; }, { undoable: false });
  },
  print: () => printWeek(),
  openSettings: () => openSettings({ getData: () => getState().data, getNow: () => getState().ui.now, subscribe, actions: settingsActions }),
  importBackup,
};

// ---------- çizim ----------

function render() {
  const { data, ui } = getState();
  applyTheme();
  const now = ui.now;
  const todayISO = toISODate(now);
  const week = buildWeek(ui.weekStart, data);
  const days = data.settings.showWeekend ? week.days : week.days.slice(0, 5);
  const upcoming = getUpcoming(now, data, 7);
  const filled = hasData(data);
  const termWeek = termWeekOf(data.settings, ui.weekStart);
  const dark = effectiveTheme(data) === 'dark';
  const mobile = ui.mobile && !printing;
  const summary = weekSummary(week);
  const isCurrentWeek = week.weekStart === toISODate(getWeekStart(now));
  const due = backupDue(data, now);

  // Odak ve kaydırma konumunu koru.
  const active = document.activeElement;
  const fk = active && app.contains(active) ? active.closest('[data-fk]')?.dataset.fk : null;
  for (const el of app.querySelectorAll('[data-scroll]')) scrollMemory.set(`${el.dataset.scroll}:${ui.weekStart.getTime()}`, el.scrollTop);

  let view;
  if (mobile) {
    view = MobileView({ week, days, settings: data.settings, now, todayISO, selectedISO: ui.selectedISO, tab: ui.tab, upcoming, hasData: filled, dark, termWeek, summary, isCurrentWeek, backupDue: due, actions });
  } else {
    const empty = !filled && EmptyState({ onAddRoutine: () => openCreate({ kind: 'routine' }), onImport: importBackup });
    view = h('div', { class: 'shell' },
      AppHeader({ weekStart: ui.weekStart, termWeek, dark, upcomingOpen: ui.upcomingOpen, backupDue: due, actions }),
      h('div', { class: ['layout', ui.upcomingOpen && 'up-open'] },
        WeekGrid({ week, days, settings: data.settings, now, todayISO, onOpen: actions.openPopover, empty }),
        UpcomingPanel({ items: upcoming, onOpen: openUpcoming, hasData: filled, summary, isCurrentWeek })));
  }
  app.replaceChildren(view);
  if (!mobile && filled) {
    const grid = app.querySelector('.wg');
    const instances = new Map(days.flatMap((d) => d.instances.map((i) => [i.key, i])));
    enableDrag(grid, { instances, days, range: computeRange(data.settings, days), onDrop: handleDrop });
  }

  for (const el of app.querySelectorAll('[data-scroll]')) {
    const key = `${el.dataset.scroll}:${ui.weekStart.getTime()}`;
    if (scrollMemory.has(key) && !ui.scrollToNow) el.scrollTop = scrollMemory.get(key);
    else scrollToMorning(el, data, days, now, todayISO);
  }
  if (ui.scrollToNow) getState().ui.scrollToNow = false;
  if (fk) {
    const target = app.querySelector(`[data-fk="${CSS.escape(fk)}"]`);
    if (target) target.focus({ preventScroll: true });
  }
}

/** İlk açılışta: bu haftaysa şu andan bir saat öncesine, değilse gün başına kaydır. */
function scrollToMorning(el, data, days, now, todayISO) {
  const range = computeRange(data.settings, days);
  const inner = el.querySelector('.wg-body, .m-tl-inner');
  if (!inner) return;
  const isThisWeek = days.some((d) => d.iso === todayISO);
  const target = isThisWeek ? minutesOfDay(now) - 60 : range.startMin;
  const ratio = Math.max(0, (target - range.startMin) / (range.endMin - range.startMin));
  el.scrollTop = ratio * inner.offsetHeight;
}

// ---------- klavye ----------

function onKeydown(e) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (isTypingTarget(e.target)) return;
  if (document.querySelector('.overlay, .pop, .tour')) return;
  const key = e.key.toLocaleLowerCase('tr-TR');
  if (e.key === 'ArrowLeft') actions.prevWeek();
  else if (e.key === 'ArrowRight') actions.nextWeek();
  else if (key === 't') actions.today();
  else if (key === 'n') openCreate();
  else return;
  e.preventDefault();
}

// ---------- başlatma ----------

function start() {
  const loaded = load();
  const now = new Date();
  const weekStart = getWeekStart(now);
  initState(loaded.data, {
    now,
    weekStart,
    selectedISO: defaultSelected(weekStart, now, loaded.data.settings.showWeekend),
    tab: 'gun',
    mobile: mqMobile.matches,
    upcomingOpen: false,
  });
  subscribe(render);
  render();

  if (loaded.status === 'corrupt') {
    showToast('Kayıtlı veri okunamadı; güvenli bir kopyası saklandı ve boş programla başlandı.', { kind: 'error', timeout: 10000 });
  } else if (loaded.status === 'unavailable') {
    showToast('Tarayıcı depolaması kullanılamıyor; değişiklikler kaydedilmeyecek.', { kind: 'error', timeout: 10000 });
  }
  requestPersist();
  if (!onboardingSeen()) startTour();

  document.addEventListener('keydown', onKeydown);
  mqMobile.addEventListener('change', () => setUI({ mobile: mqMobile.matches }));
  mqDark.addEventListener('change', render);

  // NowLine ve göreli zamanlar: dakika değişince yeniden çiz.
  const tick = () => {
    const prev = getState().ui.now;
    const t = new Date();
    if (t.getMinutes() !== prev.getMinutes() || t.getDate() !== prev.getDate()) setUI({ now: t });
  };
  setInterval(tick, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  window.addEventListener('beforeprint', () => {
    printing = true;
    render();
  });
  window.addEventListener('afterprint', () => {
    printing = false;
    render();
  });
}

start();
