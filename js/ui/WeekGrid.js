import { formatDayTitle, formatWeekRange, formatWeekdayShort, minutesOfDay } from '../dates.js';
import { DayColumn } from './DayColumn.js';
import { computeRange } from './EventBlock.js';
import { NowLine } from './NowLine.js';
import { TimeColumn } from './TimeColumn.js';
import { h, icon } from './dom.js';

function DayHeader(day, isToday) {
  return h('div', { class: ['dh', isToday && 'is-today', day.holiday && 'is-holiday'] },
    h('div', { class: 'dh-top' },
      h('span', { class: 'dh-name' }, formatWeekdayShort(day.date)),
      h('span', { class: 'dh-date', 'aria-current': isToday ? 'date' : null }, String(day.date.getDate()))),
    day.holiday && h('div', { class: 'dh-holiday', title: day.holiday.name }, icon('flag', 'xs'), day.holiday.name));
}

/**
 * Haftalık ızgara. days: gösterilecek günler (hafta sonu gizliyse 5).
 */
export function WeekGrid({ week, days, settings, now, todayISO, onOpen, empty }) {
  const range = computeRange(settings, days);
  const nowMin = minutesOfDay(now);
  const hasToday = days.some((d) => d.iso === todayISO);

  const head = h('div', { class: 'wg-head' },
    h('div', { class: 'tz', 'aria-hidden': 'true' }, 'GMT+3'),
    days.map((d) => DayHeader(d, d.iso === todayISO)));

  const body = h('div', { class: 'wg-body', style: { '--hours': range.hours } },
    TimeColumn(range, hasToday ? nowMin : null),
    days.map((d) => DayColumn(d, range, {
      isToday: d.iso === todayISO,
      nowMin,
      onOpen,
      label: `${formatDayTitle(d.date)}${d.holiday ? `, ${d.holiday.name}` : ''}, ${d.instances.length} etkinlik`,
    })),
    hasToday && NowLine(range, nowMin, { faint: true }));

  return h('section', {
    class: 'wg',
    style: { '--days': days.length },
    'aria-label': `Haftalık program, ${formatWeekRange(days[0].date, 7)}`,
  },
  h('div', { class: 'print-title' },
    h('span', null, 'Haftalık program'),
    h('b', null, formatWeekRange(week.days[0].date))),
  h('div', { class: 'wg-scroll', dataset: { scroll: 'grid' } }, head, body),
  empty);
}
