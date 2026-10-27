import { diffDays } from '../dates.js';
import { h, icon, trapFocus } from './dom.js';

function lastBackupText(iso, now) {
  if (!iso) return 'Henüz yedek almadın.';
  const days = diffDays(new Date(iso), now);
  if (days <= 0) return 'Son yedek: bugün';
  if (days === 1) return 'Son yedek: dün';
  return `Son yedek: ${days} gün önce`;
}

/**
 * Ayarlar. Aşama 1'de yalnızca Veri bölümü var (yedek al/yükle, tümünü sil).
 * actions: { backup, importBackup, clearAll }
 */
export function openSettings({ data, now, actions }) {
  const opener = document.activeElement;
  const counts = `${data.routines.length} rutin · ${data.events.length} tek seferlik etkinlik`;

  const run = (fn) => () => {
    close();
    fn();
  };

  const panel = h('div', { class: 'set set-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'set-title' },
    h('div', { class: 'grabber', 'aria-hidden': 'true' }),
    h('div', { class: 'set-top' },
      h('h1', { id: 'set-title' }, 'Ayarlar'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-icon', 'aria-label': 'Kapat', onClick: () => close() }, icon('x'))),
    h('div', { class: 'set-main' },
      h('section', { class: 'set-sec', 'aria-labelledby': 'set-veri' },
        h('div', null,
          h('h2', { id: 'set-veri' }, 'Veri'),
          h('p', { class: 'd' }, 'Programın yalnızca bu tarayıcıda durur. Tarayıcı verilerini temizlersen kaybolur; düzenli yedek al.')),
        h('div', { class: 'set-rows' },
          h('div', { class: 'data-grid data-grid-2' },
            h('button', { type: 'button', class: 'dcard', onClick: run(actions.backup) },
              h('span', { class: 'ic' }, icon('download', 'sm')), h('span', { class: 't' }, 'Yedek al (JSON)'), h('span', { class: 's' }, counts)),
            h('button', { type: 'button', class: 'dcard', onClick: run(actions.importBackup) },
              h('span', { class: 'ic' }, icon('upload', 'sm')), h('span', { class: 't' }, 'Yedekten yükle'), h('span', { class: 's' }, '.json dosyası seç; mevcut verinin yerine geçer'))),
          h('div', { class: 'info-note' }, icon('clock', 'sm'), lastBackupText(data.settings.lastBackupAt, now)),
          h('div', { class: 'danger-zone' },
            h('div', null,
              h('div', { class: 't' }, 'Tüm verileri sil'),
              h('div', { class: 's' }, 'Rutinler, etkinlikler ve ayarlar bu tarayıcıdan kalıcı olarak silinir.')),
            h('button', { type: 'button', class: 'btn btn-danger', onClick: run(actions.clearAll) }, icon('trash', 'sm'), 'Tüm verileri sil…')))),
      h('div', { class: 'info-note set-foot' }, icon('lock', 'sm'), 'Verilerin sadece bu tarayıcıda saklanır. Hesap yok, sunucuya gönderilmez.')));

  const overlay = h('div', { class: 'overlay', onMousedown: (e) => { if (e.target === overlay) close(); } }, panel);

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else trapFocus(panel, e);
  }
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    if (opener && opener.isConnected) opener.focus();
  }
  document.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  panel.querySelector('.dcard').focus();
}
