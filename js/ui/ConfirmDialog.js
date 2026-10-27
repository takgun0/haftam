import { h, icon, trapFocus } from './dom.js';

/**
 * Onay penceresi. Promise<boolean> döner.
 * options: { title, body, confirmLabel, cancelLabel, danger, requireText, details: string[], alertOnly }
 */
export function confirmDialog(options) {
  const {
    title, body, confirmLabel = 'Tamam', cancelLabel = 'Vazgeç', danger = false,
    requireText = null, details = null, alertOnly = false, iconName = danger ? 'trash' : 'info',
  } = options;
  const opener = document.activeElement;

  return new Promise((resolve) => {
    const titleId = `cd-t-${Date.now()}`;
    const bodyId = `${titleId}-d`;
    let input = null;

    const confirmBtn = h('button', {
      class: ['btn', danger ? 'btn-danger-solid' : 'btn-primary'],
      disabled: !!requireText,
      onClick: () => close(true),
    }, danger && icon('trash', 'sm'), confirmLabel);

    if (requireText) {
      input = h('input', {
        class: 'inp', id: `${titleId}-in`, autocomplete: 'off', spellcheck: 'false',
        onInput: () => { confirmBtn.disabled = input.value.trim().toLocaleUpperCase('tr-TR') !== requireText; },
      });
    }

    const dialog = h('div', { class: 'dialog', role: alertOnly || danger ? 'alertdialog' : 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': bodyId },
      h('div', { class: 'dialog-row' },
        h('span', { class: ['dialog-ic', !danger && 'dialog-ic-info'] }, icon(iconName)),
        h('div', { class: 'dialog-text' },
          h('h3', { id: titleId }, title),
          h('p', { id: bodyId }, body),
          details && details.length ? h('ul', { class: 'dialog-list' }, details.map((d) => h('li', null, d))) : null)),
      requireText && h('div', { class: 'fld' },
        h('label', { class: 'lbl', for: input.id }, `Onaylamak için ${requireText} yaz`), input),
      h('div', { class: 'dialog-foot' },
        !alertOnly && h('button', { class: 'btn', onClick: () => close(false) }, cancelLabel),
        confirmBtn));

    const overlay = h('div', {
      class: 'overlay overlay-center',
      onMousedown: (e) => { if (e.target === overlay) close(false); },
    }, dialog);

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(false);
      } else trapFocus(dialog, e);
    }
    function close(result) {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      if (opener && opener.isConnected) opener.focus();
      resolve(result);
    }

    document.addEventListener('keydown', onKey, true);
    document.body.append(overlay);
    (input || (alertOnly ? confirmBtn : dialog.querySelector('.dialog-foot .btn'))).focus();
  });
}
