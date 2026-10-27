import { EventBlock } from './EventBlock.js';
import { NowLine } from './NowLine.js';
import { h } from './dom.js';

/** Bir günün sütunu: saat çizgileri, etkinlik blokları ve (bugünse) NowLine. */
export function DayColumn(day, range, { isToday, nowMin, onOpen, mobile = false, label }) {
  const col = h('div', {
    class: ['dc', isToday && 'is-today', day.holiday && 'is-holiday'],
    role: 'group',
    'aria-label': label,
  });
  for (const inst of day.instances) col.append(EventBlock(inst, range, { onOpen, mobile }));
  if (isToday) {
    const line = NowLine(range, nowMin);
    if (line) col.append(line);
  }
  return col;
}
