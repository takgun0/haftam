import { h } from './dom.js';

/** Şu anki saati gösteren çizgi; aralık dışındaysa null. faint: tüm haftaya yayılan soluk çizgi. */
export function NowLine(range, nowMin, { faint = false } = {}) {
  if (nowMin < range.startMin || nowMin > range.endMin) return null;
  const top = ((nowMin - range.startMin) / (range.endMin - range.startMin)) * 100;
  return h('div', { class: faint ? 'now-faint' : 'now', style: { top: `${top}%` }, 'aria-hidden': 'true' });
}
