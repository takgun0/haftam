import { formatWeekRange } from '../dates.js';
import { h, icon, logoMark } from './dom.js';

export function WeekNavigator({ weekStart, onPrev, onNext, compact = false }) {
  return h('nav', { class: 'wnav', 'aria-label': 'Hafta gezgini' },
    h('button', { type: 'button', class: ['btn btn-ghost', compact ? 'btn-touch' : 'btn-icon'], 'aria-label': 'Önceki hafta (←)', dataset: { fk: 'prev' }, onClick: onPrev }, icon('chev-l')),
    h('span', { class: 'wnav-label', 'aria-live': 'polite' }, formatWeekRange(weekStart)),
    h('button', { type: 'button', class: ['btn btn-ghost', compact ? 'btn-touch' : 'btn-icon'], 'aria-label': 'Sonraki hafta (→)', dataset: { fk: 'next' }, onClick: onNext }, icon('chev-r')));
}

export function ThemeButton({ dark, onToggle, touch = false }) {
  return h('button', {
    type: 'button',
    class: ['btn btn-ghost', touch ? 'btn-touch' : 'btn-icon'],
    'aria-label': dark ? 'Açık temaya geç' : 'Koyu temaya geç',
    dataset: { fk: 'theme' },
    onClick: onToggle,
  }, icon(dark ? 'sun' : 'moon'));
}

export function AppHeader({ weekStart, termWeek, dark, upcomingOpen, actions }) {
  return h('header', { class: 'hdr' },
    h('div', { class: 'logo' }, logoMark(), h('span', null, 'Haftam')),
    WeekNavigator({ weekStart, onPrev: actions.prevWeek, onNext: actions.nextWeek }),
    h('button', { type: 'button', class: 'btn', 'aria-keyshortcuts': 'T', title: 'Bugün (T)', dataset: { fk: 'today' }, onClick: actions.today }, 'Bugün'),
    termWeek && h('span', { class: 'chip' }, `Dönemin ${termWeek}. haftası`),
    h('div', { class: 'grow' }),
    h('button', {
      type: 'button', class: 'btn btn-ghost only-tablet', 'aria-expanded': upcomingOpen ? 'true' : 'false',
      dataset: { fk: 'upcoming' }, onClick: actions.toggleUpcoming,
    }, icon('list', 'sm'), 'Yaklaşan'),
    h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Yazdır', title: 'Yazdır / PDF', dataset: { fk: 'print' }, onClick: actions.print }, icon('printer')),
    ThemeButton({ dark, onToggle: actions.toggleTheme }),
    h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Ayarlar', dataset: { fk: 'settings' }, onClick: actions.openSettings }, icon('settings')),
    h('span', { class: 'hdr-sep', 'aria-hidden': 'true' }),
    h('button', { type: 'button', class: 'btn btn-primary', 'aria-keyshortcuts': 'N', title: 'Yeni etkinlik (N)', dataset: { fk: 'add' }, onClick: () => actions.openCreate() }, icon('plus', 'sm'), 'Etkinlik ekle'));
}
