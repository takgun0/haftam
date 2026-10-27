import { formatDayTitle, parseISODate } from '../dates.js';
import { CATEGORY_LABELS } from '../schedule.js';
import { CATEGORY_ICONS, h, icon, trapFocus } from './dom.js';

let current = null;

export function closePopover({ restoreFocus = true } = {}) {
  if (current) current(restoreFocus);
}

/**
 * Etkinlik detay popover'ı. actions: { editWeek, editAll, cancelWeek, restoreWeek,
 * showOnHoliday, resetWeek, deleteRoutine, editEvent, deleteEvent }
 */
export function openPopover(inst, anchor, actions) {
  closePopover({ restoreFocus: false });
  const titleId = `pop-${Date.now()}`;
  const isRoutine = inst.kind === 'routine';
  const run = (fn) => () => {
    close(false);
    fn(inst);
  };
  const act = (label, ic, fn, cls = '') => h('button', { type: 'button', class: ['pact', cls], onClick: run(fn) }, icon(ic, 'sm'), label);

  const statusBand = inst.cancelled
    ? h('div', { class: 'cancel-band' }, icon(inst.cancelReason === 'holiday' ? 'flag' : 'ban', 'sm'),
      inst.cancelReason === 'holiday' ? 'Tatil nedeniyle bu hafta yok' : 'Bu hafta iptal edildi')
    : inst.modified ? h('div', { class: 'cancel-band' }, icon('edit-one', 'sm'), 'Bu hafta için değiştirildi') : null;

  let acts;
  if (isRoutine) {
    acts = h('div', { class: 'pop-acts' },
      inst.cancelReason === 'override' && act('İptali geri al', 'undo', actions.restoreWeek, 'pact-primary'),
      inst.cancelReason === 'holiday' && act('Bu hafta yine de göster', 'undo', actions.showOnHoliday, 'pact-primary'),
      !inst.cancelled && act('Sadece bu haftayı düzenle', 'edit-one', actions.editWeek),
      inst.modified && act('Bu haftanın değişikliğini geri al', 'undo', actions.resetWeek),
      act('Tüm haftaları düzenle', 'edit', actions.editAll),
      !inst.cancelled && act('Bu hafta iptal et', 'ban', actions.cancelWeek),
      h('div', { class: 'pact-sep', 'aria-hidden': 'true' }),
      act('Sil…', 'trash', actions.deleteRoutine, 'pact-danger'));
  } else {
    acts = h('div', { class: 'pop-row' },
      h('button', { type: 'button', class: 'btn btn-ghost btn-danger', onClick: run(actions.deleteEvent) }, icon('trash', 'sm'), 'Sil'),
      h('div', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn btn-primary', onClick: run(actions.editEvent) }, icon('edit', 'sm'), 'Düzenle'));
  }

  const repeat = isRoutine ? (inst.weekInterval === 2 ? '2 haftada bir' : 'Her hafta') : 'Tek seferlik';
  const pop = h('div', { class: 'pop', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': titleId },
    h('button', { type: 'button', class: 'btn btn-ghost btn-icon pop-x', 'aria-label': 'Kapat', onClick: () => close(true) }, icon('x')),
    h('div', { class: 'pop-head' },
      h('div', { class: 'pop-tags' },
        h('span', { class: ['tag', `c-${inst.category}`] }, icon(CATEGORY_ICONS[inst.category], 'xs'), CATEGORY_LABELS[inst.category]),
        inst.cancelled && h('span', { class: 'badge badge-off' }, 'İptal'),
        inst.modified && h('span', { class: 'badge badge-mod' }, 'Değişti'),
        inst.conflict && h('span', { class: 'badge badge-warn' }, icon('alert', 'tiny'), 'Çakışma')),
      h('div', { class: ['pop-title', inst.cancelled && 'is-struck'], id: titleId }, inst.title)),
    h('div', { class: 'pop-meta' },
      h('div', { class: 'r tnum' }, icon('clock', 'sm'), h('span', null, `${formatDayTitle(parseISODate(inst.date))} · ${inst.start}–${inst.end}`)),
      h('div', { class: 'r' }, icon(isRoutine ? 'repeat' : 'calendar', 'sm'), h('span', null, repeat)),
      inst.location && h('div', { class: 'r' }, icon('pin', 'sm'), h('span', null, inst.location)),
      inst.note && h('div', { class: 'pop-note' }, inst.note),
      statusBand),
    acts);

  document.body.append(pop);
  position(pop, anchor);

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else trapFocus(pop, e);
  }
  function onDown(e) {
    if (!pop.contains(e.target) && !anchor.contains(e.target)) close(false);
  }
  const onResize = () => close(false);

  function close(restoreFocus) {
    pop.remove();
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onDown, true);
    window.removeEventListener('resize', onResize);
    current = null;
    if (restoreFocus) {
      const target = anchor.isConnected ? anchor : document.querySelector(`[data-fk="${CSS.escape(inst.key)}"]`);
      if (target) target.focus();
    }
  }
  current = close;
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('mousedown', onDown, true);
  window.addEventListener('resize', onResize);
  const first = pop.querySelector('.pact, .pop-row .btn-primary');
  (first || pop.querySelector('.pop-x')).focus();
}

function position(pop, anchor) {
  if (window.matchMedia('(max-width: 767px)').matches) {
    pop.classList.add('pop-sheet');
    return;
  }
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 12;
  let left = r.right + gap;
  let side = 'right';
  if (left + pw > vw - 8) {
    left = r.left - gap - pw;
    side = 'left';
  }
  if (left < 8) {
    left = Math.max(8, Math.min(vw - pw - 8, r.left));
    side = 'none';
  }
  let top = Math.min(Math.max(8, r.top - 8), vh - ph - 8);
  top = Math.max(8, top);
  const arrowY = Math.min(Math.max(16, r.top + Math.min(r.height / 2, 24) - top), ph - 24);
  pop.classList.add(`pop-${side}`);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.style.setProperty('--arrow-y', `${arrowY}px`);
}
