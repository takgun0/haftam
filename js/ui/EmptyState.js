import { h, icon, svg } from './dom.js';

function illustration() {
  const s = (style) => ({ style });
  return svg('svg', { width: 132, height: 96, viewBox: '0 0 132 96', 'aria-hidden': 'true' },
    svg('rect', { x: 6, y: 10, width: 120, height: 80, rx: 12, 'stroke-width': 1.5, ...s({ fill: 'var(--color-surface)', stroke: 'var(--color-border)' }) }),
    svg('path', { d: 'M6 30h120', 'stroke-width': 1.5, ...s({ stroke: 'var(--color-border)' }) }),
    svg('path', { d: 'M30 30v60M54 30v60M78 30v60M102 30v60', 'stroke-width': 1, 'stroke-dasharray': '2 3', ...s({ stroke: 'var(--color-border)' }) }),
    svg('rect', { x: 34, y: 38, width: 16, height: 22, rx: 4, 'stroke-width': 1, ...s({ fill: 'var(--cat-ders-bg)', stroke: 'var(--cat-ders)' }) }),
    svg('rect', { x: 58, y: 50, width: 16, height: 16, rx: 4, 'stroke-width': 1, ...s({ fill: 'var(--cat-sosyal-bg)', stroke: 'var(--cat-sosyal)' }) }),
    svg('rect', { x: 82, y: 40, width: 16, height: 30, rx: 4, 'stroke-width': 1.5, 'stroke-dasharray': '3 2', ...s({ fill: 'var(--color-primary-soft)', stroke: 'var(--color-primary)' }) }),
    svg('path', { d: 'M90 50v10M85 55h10', 'stroke-width': 1.8, 'stroke-linecap': 'round', ...s({ stroke: 'var(--color-primary)' }) }),
    svg('circle', { cx: 22, cy: 20, r: 3, ...s({ fill: 'var(--cat-sinav)' }) }),
    svg('circle', { cx: 32, cy: 20, r: 3, ...s({ fill: 'var(--cat-is)' }) }),
    svg('circle', { cx: 42, cy: 20, r: 3, ...s({ fill: 'var(--cat-ders)' }) }));
}

/** İlk açılış: hiç rutin ve etkinlik yokken. */
export function EmptyState({ onAddRoutine, onImport, inline = false }) {
  return h('div', { class: ['empty', inline && 'empty-inline'] },
    h('div', { class: 'empty-card' },
      illustration(),
      h('h2', null, 'Ders programını ekleyerek başla'),
      h('p', null, 'Derslerini bir kez rutin olarak gir; dönem boyunca her hafta kendiliğinden görünsün.'),
      h('div', { class: 'empty-actions' },
        h('button', { type: 'button', class: 'btn btn-primary btn-lg', onClick: onAddRoutine }, icon('repeat', 'sm'), 'İlk rutini ekle'),
        h('button', { type: 'button', class: 'link', onClick: onImport }, 'Yedekten yükle'))));
}
