import { minutesToTime } from '../dates.js';
import { h } from './dom.js';

/** Sol saat sütunu; nowMin verilirse kırmızı saat etiketi de gösterilir. */
export function TimeColumn(range, nowMin = null) {
  const col = h('div', { class: 'tc', 'aria-hidden': 'true' });
  for (let m = range.startMin; m < range.endMin; m += 60) {
    col.append(h('div', { class: 'tc-h' }, h('span', null, minutesToTime(m))));
  }
  if (nowMin !== null && nowMin >= range.startMin && nowMin <= range.endMin) {
    const top = ((nowMin - range.startMin) / (range.endMin - range.startMin)) * 100;
    col.append(h('span', { class: 'now-label', style: { top: `${top}%` } }, minutesToTime(nowMin)));
  }
  return col;
}
