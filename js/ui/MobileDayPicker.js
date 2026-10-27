import { formatDayTitle, formatWeekdayShort } from '../dates.js';
import { h, icon } from './dom.js';

/** Yatay kaydırılabilir gün seçici (ok tuşlarıyla da gezilir). */
export function MobileDayPicker({ days, selectedISO, todayISO, onSelect }) {
  const list = h('div', { class: 'mdp', role: 'tablist', 'aria-label': 'Gün seçici' });
  days.forEach((d, i) => {
    const active = d.instances.filter((x) => !x.cancelled).length;
    const sel = d.iso === selectedISO;
    list.append(h('button', {
      type: 'button',
      role: 'tab',
      class: ['mdp-day', d.iso === todayISO && 'is-today', d.holiday && 'is-holiday', sel && 'is-sel'],
      'aria-selected': sel ? 'true' : 'false',
      tabindex: sel ? '0' : '-1',
      'aria-label': `${formatDayTitle(d.date)}${d.holiday ? ', ' + d.holiday.name : ''}, ${active} etkinlik`,
      dataset: { fk: `mdp:${d.iso}` },
      onClick: () => onSelect(d.iso),
      onKeydown: (e) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        e.stopPropagation();
        const next = days[Math.max(0, Math.min(days.length - 1, i + step))];
        onSelect(next.iso);
      },
    },
    h('span', { class: 'n' }, formatWeekdayShort(d.date)),
    h('span', { class: 'd' }, String(d.date.getDate())),
    h('span', { class: 'mdp-dots', 'aria-hidden': 'true' }, Array.from({ length: Math.min(active, 3) }, () => h('span'))),
    d.holiday && h('span', { class: 'mdp-flag' }, icon('flag', 'tiny'))));
  });
  return list;
}
