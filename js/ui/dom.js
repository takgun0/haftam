// Küçük DOM yardımcıları. Metin her zaman textContent / text node olarak
// eklenir; innerHTML kullanılmaz.

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyProps(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'style') {
      for (const [sk, sv] of Object.entries(v)) if (sv !== undefined && sv !== null) el.style.setProperty(sk, String(sv));
    } else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === undefined || c === null || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** h('button', { class: 'btn', onClick }, 'Kaydet') */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, children);
  return el;
}

export function svg(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'style') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, sv);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) el.append(c);
  return el;
}

/** Maske tabanlı ikon (haftam tasarımındaki .i sınıfları). */
export function icon(name, size = '') {
  return h('span', { class: ['i', `i-${name}`, size && `i-${size}`], 'aria-hidden': 'true' });
}

export const CATEGORY_ICONS = { ders: 'book', is: 'briefcase', kisisel: 'user', sinav: 'exam', sosyal: 'users', diger: 'dot' };

export function logoMark() {
  return svg('svg', { width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    svg('rect', { width: 24, height: 24, rx: 7, class: 'logo-bg' }),
    svg('rect', { x: 6, y: 7, width: 3, height: 10, rx: 1.5, fill: '#fff' }),
    svg('rect', { x: 10.5, y: 10, width: 3, height: 7, rx: 1.5, fill: '#fff', opacity: '.7' }),
    svg('rect', { x: 15, y: 5, width: 3, height: 12, rx: 1.5, fill: '#fff' }));
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/** Tab ile odağın kök içinde kalmasını sağlar. */
export function trapFocus(root, e) {
  if (e.key !== 'Tab') return;
  const items = focusables(root);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
