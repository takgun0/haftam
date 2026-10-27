import {
  addDays, dayOfWeek, DAY_SHORT, formatDayTitle, formatDuration, isValidISODate, isValidTime,
  minutesToTime, parseISODate, timeToMinutes, toISODate,
} from '../dates.js';
import { CATEGORIES, CATEGORY_LABELS, findConflicts } from '../schedule.js';
import { LIMITS } from '../validate.js';
import { CATEGORY_ICONS, h, icon, trapFocus } from './dom.js';

let seq = 0;

function initialState(opts) {
  const { mode, routine, event, instance, defaults = {}, data, today } = opts;
  const s = data.settings;
  const todayISO = toISODate(today);
  if (mode === 'edit-routine') return { kind: 'routine', ...structuredClone(routine) };
  if (mode === 'edit-event') return { kind: 'event', ...structuredClone(event) };
  if (mode === 'override') {
    return {
      kind: 'override', title: instance.title, start: instance.start, end: instance.end,
      location: instance.location, note: instance.note, category: instance.category, date: instance.date,
    };
  }
  const date = defaults.date || todayISO;
  const start = defaults.start || '09:00';
  const end = defaults.end || minutesToTime(Math.min(timeToMinutes(start) + 60, 23 * 60 + 59));
  // Rutinler varsayılan olarak dönem boyunca geçerli; dönem bittiyse bugünden 16 hafta.
  const termOver = s.termEnd < todayISO;
  return {
    kind: defaults.kind || 'routine',
    title: '',
    days: [dayOfWeek(parseISODate(date))],
    start, end,
    weekInterval: 1,
    validFrom: termOver ? todayISO : s.termStart,
    validUntil: termOver ? toISODate(addDays(today, 16 * 7)) : s.termEnd,
    date,
    location: '',
    category: defaults.kind === 'event' ? 'is' : 'ders',
    note: '',
  };
}

/**
 * Etkinlik ekleme/düzenleme penceresi (masaüstünde modal, mobilde alt sayfa).
 * mode: 'create' | 'edit-routine' | 'edit-event' | 'override'
 * onSave(result): { type: 'routine' | 'event', value } | { type: 'override', routineId, date, changes }
 */
export function openEventModal(opts) {
  const { mode, data, onSave, onDelete, routine, instance } = opts;
  const opener = document.activeElement;
  const f = initialState(opts);
  const uid = `ef${++seq}`;
  const isCreate = mode === 'create';
  const isOverride = mode === 'override';

  const heading = isOverride ? 'Sadece bu haftayı düzenle'
    : mode === 'edit-routine' ? 'Rutini düzenle (tüm haftalar)'
      : mode === 'edit-event' ? 'Etkinliği düzenle' : null;
  const headingEl = h('h2', { id: `${uid}-h` }, heading || (f.kind === 'routine' ? 'Yeni rutin' : 'Yeni etkinlik'));

  // ---- alan yardımcıları ----
  const errEls = {};
  const errorSpan = (name) => (errEls[name] = h('span', { class: 'field-error', id: `${uid}-${name}-err`, hidden: true }));
  const field = (label, control, name, hint) => h('div', { class: 'fld' },
    h('label', { class: 'lbl', for: control.id }, label, hint && h('span', { class: 'hint' }, hint)),
    control, name && errorSpan(name));
  const input = (name, props) => {
    const el = h('input', {
      class: 'inp', id: `${uid}-${name}`, name, value: f[name] ?? '',
      onInput: () => { f[name] = el.value; clearError(name); refresh(); },
      ...props,
    });
    return el;
  };

  // ---- segment: Rutin / Tek seferlik ----
  const segBtn = (kind, label, ic) => h('button', {
    type: 'button', role: 'radio', class: f.kind === kind ? 'is-on' : '', 'aria-checked': String(f.kind === kind),
    onClick: () => setKind(kind),
  }, icon(ic, 'sm'), label);
  const seg = isCreate && h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Etkinlik türü' },
    segBtn('routine', 'Rutin', 'repeat'), segBtn('event', 'Tek seferlik', 'calendar'));

  const titleEl = input('title', { maxlength: LIMITS.title, autocomplete: 'off', required: true, placeholder: 'Örn. İstatistik', 'aria-describedby': `${uid}-title-err` });

  // ---- günler ----
  const dayBtns = DAY_SHORT.map((label, i) => h('button', {
    type: 'button', class: 'dchip', 'aria-pressed': 'false', 'aria-label': ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'][i],
    onClick: () => {
      const d = i + 1;
      f.days = f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort((a, b) => a - b);
      clearError('days');
      refresh();
    },
  }, label));
  const daysGroup = h('div', { class: 'fld' },
    h('span', { class: 'lbl', id: `${uid}-days-l` }, 'Günler', h('span', { class: 'hint' }, 'Birden fazla seçebilirsin')),
    h('div', { class: 'days', role: 'group', 'aria-labelledby': `${uid}-days-l`, 'aria-describedby': `${uid}-days-err` }, dayBtns),
    errorSpan('days'));

  // ---- saat ----
  const startEl = input('start', { type: 'time', step: 300, required: true, 'aria-label': 'Başlangıç saati' });
  const endEl = input('end', { type: 'time', step: 300, required: true, 'aria-label': 'Bitiş saati', 'aria-describedby': `${uid}-end-err ${uid}-dur` });
  const durEl = h('span', { class: 'hint tnum', id: `${uid}-dur` });
  const timeGroup = h('div', { class: 'fld' },
    h('span', { class: 'lbl' }, 'Saat'),
    h('div', { class: 'trow' }, startEl, h('span', { class: 'dash', 'aria-hidden': 'true' }, '–'), endEl),
    durEl, errorSpan('end'));

  // ---- tekrar ----
  const repBtn = (v, label) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': 'false',
    onClick: () => { f.weekInterval = v; refresh(); },
  }, label);
  const repBtns = [repBtn(1, 'Her hafta'), repBtn(2, '2 haftada bir')];
  const repeatGroup = h('div', { class: 'fld' },
    h('span', { class: 'lbl', id: `${uid}-rep-l` }, 'Tekrar'),
    h('div', { class: 'seg seg-field', role: 'radiogroup', 'aria-labelledby': `${uid}-rep-l` }, repBtns));

  // ---- geçerlilik / tarih ----
  const fromEl = input('validFrom', { type: 'date', 'aria-label': 'Geçerlilik başlangıcı' });
  const untilEl = input('validUntil', { type: 'date', 'aria-label': 'Geçerlilik bitişi', 'aria-describedby': `${uid}-validUntil-err` });
  const validityGroup = h('div', { class: 'fld' },
    h('span', { class: 'lbl' }, 'Geçerlilik', h('span', { class: 'hint' }, 'Varsayılan: dönem tarihleri')),
    h('div', { class: 'trow' }, fromEl, h('span', { class: 'dash', 'aria-hidden': 'true' }, '–'), untilEl),
    errorSpan('validUntil'));
  const dateEl = input('date', { type: 'date', required: true, 'aria-describedby': `${uid}-date-err` });
  const dateGroup = field('Tarih', dateEl, 'date');

  // ---- çakışma uyarısı ----
  const conflictEl = h('div', { class: 'warn-inline', role: 'status', hidden: true });

  // ---- konum, kategori, not ----
  const locEl = input('location', { maxlength: LIMITS.location, autocomplete: 'off', placeholder: 'Derslik, bina veya bağlantı' });
  const catBtns = CATEGORIES.map((c, i) => h('button', {
    type: 'button', role: 'radio', class: ['copt', `c-${c}`], 'aria-checked': 'false', tabindex: '-1',
    onClick: () => { f.category = c; refresh(); },
    onKeydown: (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = (i + step + CATEGORIES.length) % CATEGORIES.length;
      f.category = CATEGORIES[next];
      refresh();
      catBtns[next].focus();
    },
  }, h('span', { class: 'dot', 'aria-hidden': 'true' }), CATEGORY_LABELS[c], icon(CATEGORY_ICONS[c], 'xs')));
  const catGroup = h('div', { class: 'fld' },
    h('span', { class: 'lbl', id: `${uid}-cat-l` }, 'Kategori'),
    h('div', { class: 'cats', role: 'radiogroup', 'aria-labelledby': `${uid}-cat-l` }, catBtns));
  const noteEl = h('textarea', {
    class: 'inp', id: `${uid}-note`, maxlength: LIMITS.note, placeholder: 'Hoca, ödev, bağlantı…',
    onInput: () => { f.note = noteEl.value; },
  });
  noteEl.value = f.note || '';

  // ---- butonlar ----
  const saveBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, icon('check', 'sm'), 'Kaydet');
  const foot = h('div', { class: 'f-foot' },
    !isCreate && !isOverride && onDelete && h('button', { type: 'button', class: 'btn btn-ghost btn-danger', onClick: () => { close(); onDelete(); } }, icon('trash', 'sm'), 'Sil'),
    h('div', { class: 'grow' }),
    h('button', { type: 'button', class: 'btn', onClick: () => close() }, 'İptal'),
    saveBtn);

  const overrideNote = isOverride && h('div', { class: 'cancel-band' }, icon('edit-one', 'sm'),
    `${formatDayTitle(parseISODate(f.date))} için geçerli. Diğer haftalar değişmez.`);

  const body = h('div', { class: 'f-body' },
    seg, overrideNote,
    field('Başlık', titleEl, 'title'),
    !isOverride && daysGroup, !isOverride && dateGroup,
    h('div', { class: 'row2 row2-time' }, timeGroup, !isOverride && repeatGroup),
    conflictEl,
    !isOverride && validityGroup,
    field('Konum', locEl),
    !isOverride && catGroup,
    field('Not', noteEl));

  const form = h('form', {
    class: 'modal', novalidate: true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': `${uid}-h`,
    onSubmit: (e) => { e.preventDefault(); submit(); },
  },
  h('div', { class: 'grabber', 'aria-hidden': 'true' }),
  h('div', { class: 'f-head' }, headingEl,
    h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Kapat', onClick: () => close() }, icon('x'))),
  body, foot);

  const overlay = h('div', { class: 'overlay', onMousedown: (e) => { if (e.target === overlay) close(); } }, form);

  // ---- davranış ----
  function setKind(kind) {
    f.kind = kind;
    if (kind === 'event' && f.category === 'ders' && !f.title) f.category = 'is';
    else if (kind === 'routine' && f.category === 'is' && !f.title) f.category = 'ders';
    headingEl.textContent = kind === 'routine' ? 'Yeni rutin' : 'Yeni etkinlik';
    for (const b of seg.children) {
      const on = (b.textContent === 'Rutin') === (kind === 'routine');
      b.className = on ? 'is-on' : '';
      b.setAttribute('aria-checked', String(on));
    }
    refresh();
  }

  function setError(name, msg) {
    const el = errEls[name];
    if (!el) return;
    el.replaceChildren(icon('alert', 'xs'), msg);
    el.hidden = false;
    const ctrl = { title: titleEl, end: endEl, date: dateEl, validUntil: untilEl }[name];
    if (ctrl) ctrl.setAttribute('aria-invalid', 'true');
  }
  function clearError(name) {
    const el = errEls[name];
    if (!el || el.hidden) return;
    el.hidden = true;
    const ctrl = { title: titleEl, end: endEl, date: dateEl, validUntil: untilEl }[name];
    if (ctrl) ctrl.removeAttribute('aria-invalid');
  }

  function candidate() {
    if (!isValidTime(f.start) || !isValidTime(f.end)) return null;
    if (f.kind === 'override') return { kind: 'override', routineId: instance.routineId, date: f.date, start: f.start, end: f.end };
    if (f.kind === 'event') return isValidISODate(f.date) ? { kind: 'event', id: f.id, date: f.date, start: f.start, end: f.end } : null;
    if (!f.days.length || !isValidISODate(f.validFrom) || !isValidISODate(f.validUntil)) return null;
    return { kind: 'routine', id: f.id, days: f.days, start: f.start, end: f.end, validFrom: f.validFrom, validUntil: f.validUntil, weekInterval: f.weekInterval };
  }

  function refresh() {
    const routineMode = f.kind === 'routine';
    if (!isOverride) {
      daysGroup.hidden = !routineMode;
      repeatGroup.hidden = !routineMode;
      validityGroup.hidden = !routineMode;
      dateGroup.hidden = routineMode;
    }
    dayBtns.forEach((b, i) => {
      const on = f.days && f.days.includes(i + 1);
      b.classList.toggle('is-on', !!on);
      b.setAttribute('aria-pressed', String(!!on));
    });
    repBtns.forEach((b, i) => {
      const on = f.weekInterval === i + 1;
      b.className = on ? 'is-on' : '';
      b.setAttribute('aria-checked', String(on));
    });
    catBtns.forEach((b, i) => {
      const on = f.category === CATEGORIES[i];
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    if (isValidTime(f.start) && isValidTime(f.end) && timeToMinutes(f.end) > timeToMinutes(f.start)) {
      durEl.textContent = `Süre: ${formatDuration(timeToMinutes(f.end) - timeToMinutes(f.start))}`;
    } else durEl.textContent = '';

    const c = candidate();
    const conflicts = c ? findConflicts(c, data) : [];
    if (conflicts.length) {
      const first = conflicts[0];
      const more = conflicts.length > 1 ? ` +${conflicts.length - 1} etkinlikle daha.` : '';
      conflictEl.replaceChildren(icon('alert', 'sm'), h('span', null,
        'Bu saatte ', h('b', null, `‘${first.title}’`), ' ile çakışıyor ',
        h('span', { class: 'warn-sub' }, `(${first.label})`), `.${more}`));
      conflictEl.hidden = false;
    } else conflictEl.hidden = true;
  }

  function submit() {
    const title = (f.title || '').trim();
    let firstBad = null;
    const bad = (name, msg, el) => { setError(name, msg); firstBad = firstBad || el; };
    if (!title) bad('title', 'Başlık zorunlu.', titleEl);
    if (!isValidTime(f.start) || !isValidTime(f.end)) bad('end', 'Başlangıç ve bitiş saatini gir.', isValidTime(f.start) ? endEl : startEl);
    else if (timeToMinutes(f.end) <= timeToMinutes(f.start)) bad('end', 'Bitiş saati başlangıçtan sonra olmalı.', endEl);
    if (f.kind === 'routine') {
      if (!f.days.length) bad('days', 'En az bir gün seç.', dayBtns[0]);
      if (!isValidISODate(f.validFrom) || !isValidISODate(f.validUntil)) bad('validUntil', 'Geçerlilik tarihlerini gir.', fromEl);
      else if (f.validUntil < f.validFrom) bad('validUntil', 'Bitiş tarihi başlangıçtan önce olamaz.', untilEl);
    }
    if (f.kind === 'event' && !isValidISODate(f.date)) bad('date', 'Geçerli bir tarih seç.', dateEl);
    if (firstBad) {
      firstBad.focus();
      return;
    }

    const common = { title, start: f.start, end: f.end, location: (f.location || '').trim(), note: (f.note || '').trim() };
    let result;
    if (f.kind === 'override') {
      const changes = {};
      for (const k of ['title', 'start', 'end', 'location', 'note']) {
        if (common[k] !== (routine[k] || '')) changes[k] = common[k];
      }
      result = { type: 'override', routineId: instance.routineId, date: f.date, changes };
    } else if (f.kind === 'routine') {
      result = { type: 'routine', value: { id: f.id, ...common, days: f.days, category: f.category, validFrom: f.validFrom, validUntil: f.validUntil, weekInterval: f.weekInterval } };
    } else {
      result = { type: 'event', value: { id: f.id, ...common, date: f.date, category: f.category } };
    }
    close(true);
    onSave(result);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else trapFocus(form, e);
  }

  function close(saved = false) {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    if (!saved && opener && opener.isConnected) opener.focus();
  }

  document.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  refresh();
  titleEl.focus();
  if (!isCreate) titleEl.select();
  return close;
}
