import { formatDuration } from '../dates.js';
import { CATEGORIES, CATEGORY_LABELS } from '../schedule.js';
import { CATEGORY_ICONS, h, icon } from './dom.js';

/** Görüntülenen haftanın kategori bazında toplam saatleri. */
export function WeekSummary(summary, { isCurrentWeek = true } = {}) {
  const { totals, total, count, cancelled, conflicts, holidays } = summary;
  const title = isCurrentWeek ? 'Bu hafta' : 'Seçili hafta';
  return h('section', { class: 'ws', 'aria-label': `${title} özeti` },
    h('div', { class: 'ws-head' },
      h('h3', null, title),
      h('span', { class: 'muted tnum ws-total' }, total ? `${formatDuration(total)} planlı · ${count} etkinlik` : 'Etkinlik yok')),
    total > 0 && h('div', { class: 'ws-bar', 'aria-hidden': 'true' },
      CATEGORIES.filter((c) => totals[c] > 0).map((c) => h('span', { style: { width: `${(totals[c] / total) * 100}%`, background: `var(--cat-${c})` } }))),
    h('div', { class: 'ws-grid' }, CATEGORIES.map((c) => h('div', { class: ['ws-row', !totals[c] && 'is-zero'] },
      h('span', { class: ['cat-sq sm', `c-${c}`] }, icon(CATEGORY_ICONS[c], 'xs')),
      h('span', { class: 'n' }, CATEGORY_LABELS[c]),
      h('span', { class: 'v' }, totals[c] ? formatDuration(totals[c]) : '–')))),
    (conflicts || cancelled || holidays) ? h('div', { class: 'ws-foot' },
      conflicts > 0 && h('span', null, h('span', { class: 'i i-alert i-xs ws-warn', 'aria-hidden': 'true' }), `${conflicts} çakışma`),
      cancelled > 0 && h('span', null, icon('ban', 'xs'), `${cancelled} iptal`),
      holidays > 0 && h('span', null, icon('flag', 'xs'), `${holidays} tatil günü`)) : null);
}
