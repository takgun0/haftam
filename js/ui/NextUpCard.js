import { formatRelative, formatWeekdayLong } from '../dates.js';
import { CATEGORY_LABELS } from '../schedule.js';
import { CATEGORY_ICONS, h, icon } from './dom.js';

export function dayWord(item) {
  if (item.dayOffset === 0) return 'Bugün';
  if (item.dayOffset === 1) return 'Yarın';
  return formatWeekdayLong(item.startAt);
}

export function relativeChip(item) {
  if (item.ongoing) return h('span', { class: 'rel rel-now' }, 'Devam ediyor');
  if (item.dayOffset === 0) {
    return h('span', { class: ['rel', item.minutesUntil < 60 ? 'rel-soon' : 'rel-plain'] }, formatRelative(item.minutesUntil));
  }
  return null;
}

function repeatLabel(item) {
  if (item.kind === 'event') return 'Tek seferlik';
  return item.weekInterval === 2 ? '2 haftada bir' : 'Her hafta';
}

/** "Sıradaki" kartı: başlamamış ilk etkinlik (yoksa devam eden). */
export function NextUpCard(item, { compact = false, onOpen } = {}) {
  if (!item) return null;
  const card = h('article', {
    class: ['nu', `c-${item.category}`, compact && 'nu-compact'],
    'aria-label': `Sıradaki etkinlik: ${item.title}`,
  });
  const top = h('div', { class: 'nu-top' },
    h('span', { class: 'eyebrow' }, item.ongoing ? 'Şu an' : 'Sıradaki'),
    item.ongoing
      ? h('span', { class: 'rel rel-now' }, 'Devam ediyor')
      : h('span', { class: ['rel', item.dayOffset === 0 && item.minutesUntil < 60 ? 'rel-soon' : 'rel-plain'] },
        item.dayOffset === 0 ? formatRelative(item.minutesUntil) : dayWord(item)));

  const title = h('button', { type: 'button', class: 'nu-title nu-link', onClick: () => onOpen && onOpen(item) }, item.title);

  if (compact) {
    card.append(top, h('div', { class: 'nu-row' },
      h('span', { class: 'cat-sq cat-sq-lg' }, icon(CATEGORY_ICONS[item.category])),
      h('div', { class: 'nu-row-main' },
        title,
        h('div', { class: 'muted tnum nu-sub' }, `${dayWord(item)} ${item.start}–${item.end}${item.location ? ` · ${item.location}` : ''}`))));
    return card;
  }

  card.append(top, title,
    h('div', { class: 'nu-meta' },
      h('span', { class: 'tnum' }, icon('clock', 'sm'), `${dayWord(item)} · ${item.start}–${item.end}`),
      item.location && h('span', null, icon('pin', 'sm'), item.location)),
    h('div', { class: 'nu-foot' },
      h('span', { class: 'tag' }, icon(CATEGORY_ICONS[item.category], 'xs'), CATEGORY_LABELS[item.category]),
      h('span', { class: 'tag tag-plain' }, icon(item.kind === 'event' ? 'calendar' : 'repeat', 'xs'), repeatLabel(item)),
      item.note && h('span', { class: 'tag tag-plain tag-note', title: item.note }, icon('note', 'xs'), item.note)));
  return card;
}
