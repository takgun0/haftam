import { CATEGORY_LABELS } from '../schedule.js';
import { CATEGORY_ICONS, h, icon } from './dom.js';

/** Ekranda gösterilecek saat aralığı: ayar + o günlerdeki etkinlikleri kapsar. */
export function computeRange(settings, days) {
  const toMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  let s = toMin(settings.dayStart);
  let e = toMin(settings.dayEnd);
  for (const d of days) {
    for (const it of d.instances) {
      s = Math.min(s, it.startMin);
      e = Math.max(e, it.endMin);
    }
  }
  const startMin = Math.floor(s / 60) * 60;
  const endMin = Math.min(24 * 60, Math.ceil(e / 60) * 60);
  return { startMin, endMin, hours: (endMin - startMin) / 60 };
}

export function instanceAria(inst) {
  const parts = [inst.title, `${inst.start}–${inst.end}`];
  if (inst.location) parts.push(inst.location);
  parts.push(CATEGORY_LABELS[inst.category]);
  if (inst.cancelled) parts.push(inst.cancelReason === 'holiday' ? 'tatil nedeniyle iptal' : 'bu hafta iptal');
  if (inst.modified) parts.push('bu hafta değiştirildi');
  if (inst.conflict) parts.push('çakışma var');
  return parts.join(', ');
}

/**
 * Izgaradaki etkinlik bloğu. Konum ve yükseklik, görünen aralığa göre yüzdeyle
 * verilir; böylece ekranda ve baskıda aynı hesap çalışır.
 */
export function EventBlock(inst, range, { onOpen, mobile = false } = {}) {
  const total = range.endMin - range.startMin;
  const dur = inst.endMin - inst.startMin;
  const short = dur <= 30;
  const compact = dur <= 60;
  const top = ((inst.startMin - range.startMin) / total) * 100;
  const height = (dur / total) * 100;
  const gap = inst.cols > 1 ? 2 : 0;

  let meta = `${inst.start}–${inst.end}`;
  if (inst.cancelled) meta = inst.cancelReason === 'holiday' ? 'Tatil · bu hafta iptal' : 'Bu hafta iptal';
  else if (mobile && inst.location && inst.cols === 1) meta += ` · ${inst.location}`;

  const el = h('button', {
    type: 'button',
    class: ['ev', `c-${inst.category}`, short && 'is-short', compact && 'is-compact', inst.cols > 1 && 'is-narrow', inst.cancelled && 'is-cancelled',
      inst.modified && 'has-badge', inst.conflict && 'has-warn'],
    style: {
      top: `${top}%`,
      height: `calc(${height}% - 3px)`,
      left: `calc(3px + (100% - 6px) * ${inst.col / inst.cols})`,
      width: `calc((100% - 6px) / ${inst.cols} - ${gap}px)`,
    },
    'aria-label': instanceAria(inst),
    'aria-haspopup': 'dialog',
    dataset: { fk: inst.key },
    onClick: (e) => onOpen && onOpen(inst, e.currentTarget),
  },
  h('span', { class: 'ev-t' },
    icon(CATEGORY_ICONS[inst.category], mobile ? 'sm' : 'xs'),
    h('span', { class: 'ev-tt' }, inst.title)),
  !short && h('span', { class: 'ev-m' }, meta),
  !mobile && !compact && inst.location && !inst.cancelled && h('span', { class: 'ev-m' }, inst.location),
  h('span', { class: 'ev-k', 'aria-hidden': 'true' }, CATEGORY_LABELS[inst.category]),
  inst.modified && h('span', { class: 'ev-flag', 'aria-hidden': 'true' }, h('span', { class: 'i i-edit i-tiny' }), 'Değişti'),
  inst.conflict && h('span', { class: 'ev-warn', 'aria-hidden': 'true', title: 'Çakışma' }, h('span', { class: 'i i-alert i-tiny' })));
  if (short || compact) el.title = `${inst.title} · ${inst.start}–${inst.end}${inst.location ? ' · ' + inst.location : ''}`;
  return el;
}
