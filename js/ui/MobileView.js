import { formatDayTitle, formatWeekRange, minutesOfDay } from '../dates.js';
import { ThemeButton } from './AppHeader.js';
import { DayColumn } from './DayColumn.js';
import { EmptyState } from './EmptyState.js';
import { computeRange } from './EventBlock.js';
import { Fab } from './Fab.js';
import { MobileDayPicker } from './MobileDayPicker.js';
import { NextUpCard } from './NextUpCard.js';
import { TimeColumn } from './TimeColumn.js';
import { UpcomingList } from './UpcomingPanel.js';
import { h, icon, logoMark } from './dom.js';

/** Mobil (< 768px): gün görünümü + Yaklaşan sekmesi. */
export function MobileView({ week, days, settings, now, todayISO, selectedISO, tab, upcoming, hasData, dark, termWeek, actions }) {
  const isDay = tab !== 'yaklasan';
  const day = days.find((d) => d.iso === selectedISO) || days[0];
  const todayLeft = upcoming.filter((u) => u.dayOffset === 0).length;

  const header = h('header', { class: 'm-hdr' },
    h('div', { class: 'logo' }, logoMark(), h('span', null, isDay ? 'Haftam' : 'Yaklaşan')),
    h('div', { class: 'grow' }),
    h('button', { type: 'button', class: 'btn btn-ghost btn-touch-text', dataset: { fk: 'today' }, onClick: actions.today }, 'Bugün'),
    ThemeButton({ dark, onToggle: actions.toggleTheme, touch: true }));

  let body;
  if (!hasData) {
    body = h('div', { class: 'm-body' }, EmptyState({ onAddRoutine: () => actions.openCreate({ kind: 'routine' }), onImport: actions.importBackup, inline: true }));
  } else if (isDay) {
    const range = computeRange(settings, [day]);
    const nowMin = minutesOfDay(now);
    const isToday = day.iso === todayISO;
    const active = day.instances.filter((x) => !x.cancelled).length;
    const next = upcoming.find((u) => !u.ongoing) || upcoming[0];
    body = h('div', { class: 'm-body' },
      NextUpCard(next, { compact: true, onOpen: actions.openUpcoming }),
      h('div', { class: 'm-week' },
        h('span', { class: 'm-week-label' }, formatWeekRange(week.days[0].date),
          termWeek && h('span', { class: 'muted' }, ` · ${termWeek}. hafta`)),
        h('div', { class: 'm-week-nav' },
          h('button', { type: 'button', class: 'btn btn-ghost btn-touch', 'aria-label': 'Önceki hafta', dataset: { fk: 'prev' }, onClick: actions.prevWeek }, icon('chev-l')),
          h('button', { type: 'button', class: 'btn btn-ghost btn-touch', 'aria-label': 'Sonraki hafta', dataset: { fk: 'next' }, onClick: actions.nextWeek }, icon('chev-r')))),
      MobileDayPicker({ days, selectedISO: day.iso, todayISO, onSelect: actions.selectDay }),
      h('div', { class: 'm-dayhead' },
        h('h2', null, formatDayTitle(day.date)),
        day.holiday
          ? h('span', { class: 'badge badge-warn' }, icon('flag', 'tiny'), day.holiday.name)
          : h('span', { class: 'muted m-count' }, `${isToday ? 'Bugün · ' : ''}${active} etkinlik`)),
      h('div', { class: 'm-tl', dataset: { scroll: 'day' }, role: 'region', 'aria-label': 'Günlük çizelge' },
        h('div', { class: 'm-tl-inner', style: { '--hours': range.hours } },
          TimeColumn(range),
          DayColumn(day, range, { isToday, nowMin, onOpen: actions.openPopover, mobile: true, label: formatDayTitle(day.date) }),
          day.instances.length === 0 && h('div', { class: 'm-empty-day' }, 'Bu gün boş. ', h('span', { class: 'm-empty-hint' }, '+ ile ekle')))));
  } else {
    body = h('div', { class: 'm-body' },
      h('div', { class: 'm-list-head muted' }, `Önümüzdeki 7 gün · ${upcoming.length} etkinlik`),
      h('div', { class: 'm-list' }, UpcomingList(upcoming, actions.openUpcoming)));
  }

  return h('div', { class: 'm' },
    header,
    body,
    hasData && Fab(() => actions.openCreate({ date: isDay ? day.iso : undefined })),
    h('nav', { class: 'tabbar', 'aria-label': 'Sekmeler' },
      h('button', { type: 'button', class: ['tab', isDay && 'is-active'], 'aria-current': isDay ? 'page' : null, dataset: { fk: 'tab:gun' }, onClick: () => actions.setTab('gun') }, icon('calendar', 'lg'), 'Gün'),
      h('button', { type: 'button', class: ['tab', !isDay && 'is-active'], 'aria-current': !isDay ? 'page' : null, dataset: { fk: 'tab:yaklasan' }, onClick: () => actions.setTab('yaklasan') },
        icon('list', 'lg'), 'Yaklaşan', todayLeft > 0 && h('span', { class: 'tab-badge', 'aria-label': `bugün ${todayLeft} etkinlik` }, String(todayLeft))),
      h('button', { type: 'button', class: 'tab', dataset: { fk: 'tab:ayarlar' }, onClick: actions.openSettings }, icon('settings', 'lg'), 'Ayarlar')));
}
