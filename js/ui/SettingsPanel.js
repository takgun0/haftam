import { diffDays, formatDayMonth, formatFullDate, isValidISODate, minutesToTime, parseISODate, startOfWeek, timeToMinutes } from '../dates.js';
import { FIXED_HOLIDAYS } from '../holidays.js';
import { LIMITS } from '../validate.js';
import { h, icon, trapFocus } from './dom.js';

export const BACKUP_WARN_DAYS = 14;

/** Yedek uyarısı gerekiyor mu: veri var ve hiç yedek yok ya da 14 günü geçti. */
export function backupDue(data, now) {
  if (!data.routines.length && !data.events.length) return false;
  const last = data.settings.lastBackupAt;
  return !last || diffDays(new Date(last), now) > BACKUP_WARN_DAYS;
}

function lastBackupText(iso, now) {
  if (!iso) return 'Henüz yedek almadın.';
  const days = diffDays(new Date(iso), now);
  if (days <= 0) return 'Son yedek: bugün';
  if (days === 1) return 'Son yedek: dün';
  return `Son yedek: ${days} gün önce`;
}

function termProgress(settings, now) {
  const start = startOfWeek(parseISODate(settings.termStart));
  const total = Math.max(1, Math.ceil((diffDays(start, parseISODate(settings.termEnd)) + 1) / 7));
  const current = Math.floor(diffDays(start, now) / 7) + 1;
  return { total, current: Math.max(0, Math.min(total, current)), before: current < 1, after: current > total };
}

const HOURS = Array.from({ length: 24 }, (_, i) => minutesToTime(i * 60));

/**
 * Ayarlar paneli. Değişiklikler anında kaydedilir; panel veri değiştikçe yeniden çizilir.
 * actions: { updateSettings(fn), applyTermToRoutines, addHoliday({date,name}) → hata|null,
 *            removeHoliday(date), backup, importBackup, exportICS, clearAll }
 */
export function openSettings({ getData, getNow, subscribe, actions }) {
  const opener = document.activeElement;
  const ui = { errors: {}, holidayDraft: { date: '', name: '' }, section: 'donem' };

  const main = h('div', { class: 'set-main' });
  const navBtn = (id, label, ic) => h('button', {
    type: 'button', class: 'snav', dataset: { sk: `nav:${id}`, nav: id },
    onClick: () => {
      ui.section = id;
      main.querySelector(`#set-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      paintNav();
    },
  }, icon(ic, 'sm'), label);
  const veriBtn = navBtn('veri', 'Veri', 'file');
  const nav = h('nav', { class: 'set-nav', 'aria-label': 'Ayar bölümleri' },
    navBtn('donem', 'Dönem', 'calendar'), navBtn('gorunum', 'Görünüm', 'sun'),
    navBtn('tatiller', 'Tatiller', 'flag'), veriBtn,
    h('div', { class: 'grow' }),
    h('div', { class: 'info-note set-nav-note' }, icon('lock', 'sm'), h('span', null, 'Verilerin sadece bu tarayıcıda saklanır. Hesap yok, sunucuya gönderilmez.')));

  const panel = h('div', { class: 'set set-modal set-full', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'set-title' },
    h('div', { class: 'grabber', 'aria-hidden': 'true' }),
    h('div', { class: 'set-top' },
      h('h1', { id: 'set-title' }, 'Ayarlar'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Kapat', onClick: () => close() }, icon('x'))),
    h('div', { class: 'set-wrap' }, nav, main));

  function paintNav() {
    for (const b of nav.querySelectorAll('.snav')) b.classList.toggle('is-on', b.dataset.nav === ui.section);
  }

  // ---------- bölümler ----------

  function section(id, title, desc, ...rows) {
    return h('section', { class: 'set-sec', id: `set-${id}`, 'aria-labelledby': `set-${id}-h` },
      h('div', null, h('h2', { id: `set-${id}-h` }, title), desc && h('p', { class: 'd' }, desc)),
      h('div', { class: 'set-rows' }, rows));
  }

  const err = (key) => ui.errors[key] && h('span', { class: 'field-error', id: `set-err-${key}` }, icon('alert', 'xs'), ui.errors[key]);

  function dateField(key, label, value, onChange) {
    const id = `set-${key}`;
    return h('div', { class: 'fld' },
      h('label', { class: 'lbl', for: id }, label),
      h('input', {
        class: 'inp', type: 'date', id, value, dataset: { sk: key },
        'aria-invalid': ui.errors[key] ? 'true' : null, 'aria-describedby': ui.errors[key] ? `set-err-${key}` : null,
        onChange: (e) => onChange(e.target.value),
      }),
      err(key));
  }

  function hourSelect(key, label, value, onChange) {
    const id = `set-${key}`;
    const sel = h('select', { class: 'inp', id, dataset: { sk: key }, onChange: (e) => onChange(e.target.value) },
      HOURS.map((t) => h('option', { value: t, selected: t === value }, t)));
    return h('div', { class: 'fld' }, h('label', { class: 'lbl', for: id }, label), sel, err(key));
  }

  function switchRow(key, title, sub, on, onToggle) {
    return h('div', { class: 'srow' },
      h('div', null, h('div', { class: 't', id: `set-${key}-l` }, title), sub && h('div', { class: 's' }, sub)),
      h('button', {
        type: 'button', role: 'switch', class: ['switch', on && 'is-on'], 'aria-checked': String(on),
        'aria-labelledby': `set-${key}-l`, dataset: { sk: key }, onClick: onToggle,
      }));
  }

  function setTerm(field, value) {
    const s = getData().settings;
    const next = { termStart: s.termStart, termEnd: s.termEnd, [field]: value };
    delete ui.errors.termStart;
    delete ui.errors.termEnd;
    if (!isValidISODate(value)) ui.errors[field] = 'Geçerli bir tarih seç.';
    else if (next.termEnd < next.termStart) ui.errors[field] = 'Dönem bitişi başlangıçtan önce olamaz.';
    if (ui.errors[field]) return paint();
    actions.updateSettings((st) => { st[field] = value; });
  }

  function setHour(field, value) {
    const s = getData().settings;
    const next = { dayStart: s.dayStart, dayEnd: s.dayEnd, [field]: value };
    delete ui.errors.dayStart;
    delete ui.errors.dayEnd;
    if (timeToMinutes(next.dayEnd) <= timeToMinutes(next.dayStart)) {
      ui.errors[field] = 'Gün bitişi başlangıçtan sonra olmalı.';
      return paint();
    }
    actions.updateSettings((st) => { st[field] = value; });
  }

  function donem(data, now) {
    const s = data.settings;
    const p = termProgress(s, now);
    const mismatched = data.routines.filter((r) => r.validFrom !== s.termStart || r.validUntil !== s.termEnd).length;
    const progress = p.before ? 'Dönem henüz başlamadı'
      : p.after ? 'Dönem bitti' : `${p.current}. hafta / ${p.total}`;
    return section('donem', 'Dönem', 'Yeni rutinler varsayılan olarak bu tarihler arasında tekrarlanır.',
      h('div', { class: 'row2' },
        dateField('termStart', 'Dönem başlangıcı', s.termStart, (v) => setTerm('termStart', v)),
        dateField('termEnd', 'Dönem bitişi', s.termEnd, (v) => setTerm('termEnd', v))),
      h('div', { class: 'fld' },
        h('div', { class: 'term-row' }, h('span', { class: 'muted' }, progress),
          h('span', { class: 'muted tnum' }, `${formatFullDate(parseISODate(s.termStart))} – ${formatFullDate(parseISODate(s.termEnd))}`)),
        h('div', { class: 'term', 'aria-hidden': 'true' }, h('span', { style: { width: `${(p.after ? 1 : p.current / p.total) * 100}%` } }))),
      mismatched > 0 && h('div', { class: 'srow' },
        h('div', null, h('div', { class: 't' }, 'Var olan rutinler'),
          h('div', { class: 's' }, `${mismatched} rutinin geçerlilik tarihleri dönemden farklı.`)),
        h('button', { type: 'button', class: 'btn', dataset: { sk: 'applyTerm' }, onClick: actions.applyTermToRoutines }, 'Dönem tarihlerini uygula')));
  }

  function gorunum(data) {
    const s = data.settings;
    const themes = [['system', 'Sistem', 'settings'], ['light', 'Açık', 'sun'], ['dark', 'Koyu', 'moon']];
    return section('gorunum', 'Görünüm', 'Haftalık ızgarada gösterilecek saat aralığı ve tema. Aralık dışındaki etkinlikler için ızgara kendiliğinden genişler.',
      h('div', { class: 'row2' },
        hourSelect('dayStart', 'Gün başlangıcı', s.dayStart, (v) => setHour('dayStart', v)),
        hourSelect('dayEnd', 'Gün bitişi', s.dayEnd, (v) => setHour('dayEnd', v))),
      switchRow('showWeekend', 'Hafta sonunu göster', 'Kapalıyken ızgarada yalnızca Pazartesi–Cuma görünür.', s.showWeekend,
        () => actions.updateSettings((st) => { st.showWeekend = !st.showWeekend; })),
      h('div', { class: 'srow srow-wrap' },
        h('div', null, h('div', { class: 't', id: 'set-theme-l' }, 'Tema'), h('div', { class: 's' }, 'Sistem, cihazının ayarını izler.')),
        h('div', { class: 'seg seg-theme', role: 'radiogroup', 'aria-labelledby': 'set-theme-l' },
          themes.map(([id, label, ic]) => h('button', {
            type: 'button', role: 'radio', class: s.theme === id ? 'is-on' : '', 'aria-checked': String(s.theme === id),
            dataset: { sk: `theme:${id}` }, onClick: () => actions.updateSettings((st) => { st.theme = id; }),
          }, icon(ic, 'sm'), label)))));
  }

  function tatiller(data) {
    const custom = [...data.settings.customHolidays].sort((a, b) => a.date.localeCompare(b.date));
    const draft = ui.holidayDraft;
    const dateIn = h('input', {
      class: 'inp', type: 'date', value: draft.date, 'aria-label': 'Tatil tarihi', dataset: { sk: 'holDate' },
      'aria-invalid': ui.errors.holiday ? 'true' : null,
      onInput: (e) => { draft.date = e.target.value; },
    });
    const nameIn = h('input', {
      class: 'inp', value: draft.name, maxlength: LIMITS.holidayName, placeholder: 'Tatil adı (ör. Ramazan Bayramı)',
      'aria-label': 'Tatil adı', dataset: { sk: 'holName' }, autocomplete: 'off',
      onInput: (e) => { draft.name = e.target.value; },
      onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } },
    });
    function add() {
      const error = actions.addHoliday({ date: draft.date, name: draft.name.trim() });
      if (error) {
        ui.errors.holiday = error;
        paint();
      } else {
        delete ui.errors.holiday;
        ui.holidayDraft = { date: '', name: '' };
        paint();
      }
    }
    return section('tatiller', 'Tatiller', 'Tatil günleri ızgarada taranmış görünür; o günkü rutinler kendiliğinden iptal edilir (istersen yine de gösterebilirsin).',
      h('div', { class: 'fld' },
        h('span', { class: 'lbl' }, 'Resmî tatiller', h('span', { class: 'hint' }, 'Her yıl aynı gün')),
        h('div', { class: 'hol hol-fixed' }, FIXED_HOLIDAYS.map((fh) => h('div', { class: 'hol-row' },
          h('span', { class: 'hol-date' }, formatDayMonth(new Date(2026, +fh.md.slice(0, 2) - 1, +fh.md.slice(3)))),
          h('span', { class: 'hol-name' }, fh.name))))),
      h('div', { class: 'fld' },
        h('span', { class: 'lbl' }, 'Kendi tatillerin', h('span', { class: 'hint' }, 'Dini bayramlar her yıl değişir; buradan ekle')),
        h('div', { class: 'hol' },
          custom.length
            ? custom.map((c) => h('div', { class: 'hol-row' },
              h('span', { class: 'hol-date tnum' }, formatFullDate(parseISODate(c.date))),
              h('span', { class: 'hol-name' }, c.name),
              h('span', { class: 'badge badge-mod' }, 'Benim'),
              h('button', {
                type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': `${c.name} tatilini kaldır`,
                dataset: { sk: `holDel:${c.date}` }, onClick: () => actions.removeHoliday(c.date),
              }, icon('x', 'sm'))))
            : h('div', { class: 'hol-row muted' }, 'Henüz eklemedin.'),
          h('div', { class: 'hol-add' }, dateIn, nameIn,
            h('button', { type: 'button', class: 'btn btn-add', dataset: { sk: 'holAdd' }, onClick: add }, icon('plus', 'sm'), 'Ekle'))),
        err('holiday')));
  }

  function veri(data, now) {
    const due = backupDue(data, now);
    const last = data.settings.lastBackupAt;
    const days = last ? diffDays(new Date(last), now) : null;
    return section('veri', 'Veri', 'Programın yalnızca bu tarayıcıda durur. Tarayıcı verilerini temizlersen kaybolur; düzenli yedek al.',
      due && h('div', { class: 'band', role: 'status' }, icon('alert'),
        h('span', { class: 'txt' }, h('b', null, last ? `${days} gündür yedek almadın.` : 'Henüz hiç yedek almadın.'),
          last ? ` Son yedek: ${formatFullDate(new Date(last))}.` : ' Tarayıcı verileri silinirse programın kaybolur.'),
        h('button', { type: 'button', class: 'btn btn-primary', dataset: { sk: 'bandBackup' }, onClick: actions.backup }, icon('download', 'sm'), 'Şimdi yedek al')),
      h('div', { class: 'data-grid' },
        h('button', { type: 'button', class: 'dcard', dataset: { sk: 'backup' }, onClick: actions.backup },
          h('span', { class: 'ic' }, icon('download', 'sm')), h('span', { class: 't' }, 'Yedek al (JSON)'),
          h('span', { class: 's' }, `${data.routines.length} rutin · ${data.events.length} tek seferlik etkinlik`)),
        h('button', { type: 'button', class: 'dcard', dataset: { sk: 'import' }, onClick: () => { close(); actions.importBackup(); } },
          h('span', { class: 'ic' }, icon('upload', 'sm')), h('span', { class: 't' }, 'Yedekten yükle'),
          h('span', { class: 's' }, '.json dosyası seç; mevcut verinin yerine geçer')),
        h('button', { type: 'button', class: 'dcard', dataset: { sk: 'ics' }, onClick: actions.exportICS },
          h('span', { class: 'ic' }, icon('calendar', 'sm')), h('span', { class: 't' }, 'Takvime aktar (.ics)'),
          h('span', { class: 's' }, 'Google, Apple veya Outlook takvimine'))),
      h('div', { class: 'info-note' }, icon('clock', 'sm'), lastBackupText(last, now)),
      h('div', { class: 'danger-zone' },
        h('div', null, h('div', { class: 't' }, 'Tüm verileri sil'),
          h('div', { class: 's' }, 'Rutinler, etkinlikler, tatiller ve ayarlar bu tarayıcıdan kalıcı olarak silinir.')),
        h('button', { type: 'button', class: 'btn btn-danger', dataset: { sk: 'clear' }, onClick: () => { close(); actions.clearAll(); } }, icon('trash', 'sm'), 'Tüm verileri sil…')));
  }

  function paint() {
    const data = getData();
    const now = getNow();
    const active = document.activeElement;
    const sk = active && main.contains(active) ? active.dataset.sk : null;
    const top = main.scrollTop;
    main.replaceChildren(donem(data, now), gorunum(data), tatiller(data), veri(data, now),
      h('div', { class: 'info-note set-foot only-mobile' }, icon('lock', 'sm'), 'Verilerin sadece bu tarayıcıda saklanır.'));
    main.scrollTop = top;
    veriBtn.querySelector('.dotw')?.remove();
    if (backupDue(data, now)) veriBtn.append(h('span', { class: 'dotw', 'aria-label': 'Yedek uyarısı' }));
    paintNav();
    if (sk) main.querySelector(`[data-sk="${CSS.escape(sk)}"]`)?.focus();
  }

  const overlay = h('div', { class: 'overlay', onMousedown: (e) => { if (e.target === overlay) close(); } }, panel);
  const unsubscribe = subscribe(paint);

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else trapFocus(panel, e);
  }
  function close() {
    unsubscribe();
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    if (opener && opener.isConnected) opener.focus();
  }

  document.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  paint();
  [...panel.querySelectorAll('.snav, .set-main button, .set-main input')].find((el) => el.offsetParent !== null)?.focus();
  return close;
}
