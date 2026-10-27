import { h, icon } from './dom.js';

/** Mobilde sağ altta yüzen "+" butonu. */
export function Fab(onClick) {
  return h('button', { type: 'button', class: 'fab', 'aria-label': 'Etkinlik ekle', dataset: { fk: 'fab' }, onClick }, icon('plus'));
}
