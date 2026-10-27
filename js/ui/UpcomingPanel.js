import { formatDayMonth, formatWeekdayShort } from '../dates.js';
import { NextUpCard, relativeChip } from './NextUpCard.js';
import { WeekSummary } from './WeekSummary.js';
import { CATEGORY_ICONS, h, icon } from './dom.js';

/** Yaklaşanları "Şu an / Bugün / Yarın / tarih" olarak gruplar. */
export function groupUpcoming(items) {
  const groups = [];
  const byKey = new Map();
  for (const it of items) {
    let key, label, sub = null, holiday = false;
    if (it.ongoing) {
      key = 'now';
      label = 'Şu an';
    } else if (it.dayOffset === 0) {
      key = 'today';
      label = 'Bugün';
    } else {
      key = it.date;
      const d = it.startAt;
      if (it.dayOffset === 1) {
        label = 'Yarın';
        sub = `${formatWeekdayShort(d)} ${formatDayMonth(d)}`;
      } else label = `${formatWeekdayShort(d)} ${formatDayMonth(d)}`;
      if (it.dayHoliday) {
        sub = it.dayHoliday.name;
        holiday = true;
      }
    }
    if (!byKey.has(key)) {
      const g = { key, label, sub, holiday, items: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    byKey.get(key).items.push(it);
  }
  return groups;
}

function UpcomingRow(it, onOpen) {
  const badge = it.modified ? h('span', { class: 'badge badge-mod' }, 'Değişti')
    : it.conflict ? h('span', { class: 'badge badge-warn' }, icon('alert', 'tiny'), 'Çakışma') : null;
  return h('button', {
    type: 'button', class: 'ur', dataset: { fk: `up:${it.key}` },
    'aria-label': `${it.title}, ${it.start}–${it.end}${it.location ? ', ' + it.location : ''}${it.ongoing ? ', devam ediyor' : ''}`,
    onClick: () => onOpen(it),
  },
  h('span', { class: ['cat-sq', `c-${it.category}`] }, icon(CATEGORY_ICONS[it.category], 'sm')),
  h('span', { class: 'ur-main' },
    h('span', { class: 'ur-t' }, it.title),
    h('span', { class: 'ur-s' }, `${it.start}–${it.end}${it.location ? ` · ${it.location}` : ''}`)),
  relativeChip(it), badge);
}

export function UpcomingList(items, onOpen) {
  if (!items.length) {
    return h('div', { class: 'up-empty' }, icon('calendar', 'lg'),
      h('span', null, 'Önümüzdeki 7 günde etkinlik yok.'));
  }
  return groupUpcoming(items).map((g) => h('div', { class: 'ug', role: 'group', 'aria-label': g.sub ? `${g.label}, ${g.sub}` : g.label },
    h('div', { class: 'ug-h', 'aria-hidden': 'true' }, g.label,
      g.sub && h('span', { class: ['ug-sub', g.holiday && 'is-holiday'] }, g.holiday && icon('flag', 'tiny'), `· ${g.sub}`)),
    g.items.map((it) => UpcomingRow(it, onOpen))));
}

/** Masaüstü sağ panel. */
export function UpcomingPanel({ items, onOpen, hasData, summary, isCurrentWeek }) {
  const next = items.find((i) => !i.ongoing) || items[0];
  return h('aside', { class: 'up', 'aria-label': 'Yaklaşan' },
    h('div', { class: 'up-head' }, h('h2', null, 'Yaklaşan'), h('span', { class: 'muted up-sub' }, 'Önümüzdeki 7 gün')),
    hasData
      ? [NextUpCard(next, { onOpen }), h('div', { class: 'up-list' }, UpcomingList(items, onOpen)), WeekSummary(summary, { isCurrentWeek })]
      : h('div', { class: 'up-empty' }, icon('calendar', 'lg'),
        h('span', null, 'Henüz yaklaşan etkinlik yok. İlk rutinini eklediğinde sıradaki etkinlik burada görünür.')));
}
