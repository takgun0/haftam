import { h, icon } from './dom.js';

let container = null;

function getContainer() {
  if (!container) {
    container = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(container);
  }
  return container;
}

/**
 * Kısa bildirim. options: { action: { label, onClick }, kind: 'ok' | 'error', timeout }
 */
export function showToast(message, options = {}) {
  const { action, kind, timeout = action ? 7000 : 4000 } = options;
  const el = h('div', { class: ['toast', kind === 'error' && 'toast-error'] },
    kind === 'ok' && h('span', { class: 'i i-check i-sm ok', 'aria-hidden': 'true' }),
    kind === 'error' && icon('alert', 'sm'),
    h('span', null, message));
  let timer;
  const close = () => {
    clearTimeout(timer);
    el.remove();
  };
  if (action) {
    el.append(h('span', { class: 'sep', 'aria-hidden': 'true' }), h('button', {
      class: 'btn',
      onClick: () => {
        close();
        action.onClick();
      },
    }, action.label));
  }
  el.append(h('button', { class: 'btn btn-icon toast-x', 'aria-label': 'Bildirimi kapat', onClick: close }, icon('x', 'sm')));
  getContainer().append(el);
  timer = setTimeout(close, timeout);
  return close;
}
