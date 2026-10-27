// İlk girişte birkaç adımlı tanıtım: hedef öğeyi vurgular, yanına kısa bir kart koyar.
// Hedef görünmüyorsa (ör. tablette gizli panel) kart ortada açılır.

import { h, icon, trapFocus } from './dom.js';

const ONBOARDING_KEY = 'haftam:tanitim';

export function onboardingSeen() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'tamam';
  } catch {
    return true; // depolama yoksa her açılışta göstermeyelim
  }
}

function markSeen() {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'tamam');
  } catch {
    /* yok say */
  }
}

function steps(mobile) {
  return [
    {
      title: 'Haftam’a hoş geldin',
      body: 'Ders programını bir kez gir, dönem boyunca her hafta kendiliğinden görünsün. Kısa bir turla nelerin nerede olduğunu gösterelim.',
      icon: 'calendar',
    },
    {
      target: mobile ? '[data-fk="fab"]' : '[data-fk="add"]',
      title: 'Rutin ya da tek seferlik ekle',
      body: mobile
        ? 'Dersler gibi her hafta tekrarlananları Rutin olarak gir. Bir toplantı gibi tek seferlikler yalnızca kendi haftasında görünür.'
        : 'Dersler gibi her hafta tekrarlananları Rutin olarak gir. Bir toplantı gibi tek seferlikler yalnızca kendi haftasında görünür. Kısayol: N',
    },
    {
      target: mobile ? '.mdp' : '.wg-scroll',
      title: mobile ? 'Günler arasında geç' : 'Haftalık ızgara',
      body: mobile
        ? 'Gün seçiciden bir güne dokun; o günün çizelgesi altta açılır. Bir etkinliğe dokununca detayı gelir.'
        : 'Bir bloğa tıkla: sadece bu haftayı düzenleyebilir ya da bu hafta iptal edebilirsin. Blokları fareyle sürükleyerek de taşıyabilirsin.',
    },
    {
      target: mobile ? '.m-week-nav' : '.wnav',
      title: 'Haftalar arasında gezin',
      body: mobile
        ? 'Oklarla önceki ve sonraki haftaya geç; “Bugün” seni bu haftaya döndürür.'
        : '← → tuşlarıyla hafta değiştir, T ile bugüne dön. Çakışan etkinlikler yan yana daralır ve uyarı işareti taşır.',
    },
    {
      target: mobile ? '[data-fk="tab:yaklasan"]' : ['.up', '[data-fk="upcoming"]'],
      title: 'Yaklaşan',
      body: 'Bildirim yok; onun yerine sıradaki etkinlik ve önümüzdeki 7 gün burada. Altında bu haftanın kategori özeti var.',
    },
    {
      target: mobile ? '[data-fk="tab:ayarlar"]' : '[data-fk="settings"]',
      title: 'Verilerin sende',
      body: 'Her şey yalnızca bu tarayıcıda saklanır; hesap yok. Ayarlar › Veri’den düzenli yedek al, istersen .ics ile takvimine aktar.',
      icon: 'lock',
    },
  ];
}

function findTarget(sel) {
  if (!sel) return null;
  for (const s of Array.isArray(sel) ? sel : [sel]) {
    const el = document.querySelector(s);
    if (el && el.offsetParent !== null) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return r;
    }
  }
  return null;
}

/**
 * Tanıtımı açar. options: { mobile, hasData, onAddRoutine }
 * Kapatınca (bitir, atla ya da Esc) bir daha kendiliğinden açılmaz.
 */
export function openOnboarding({ mobile, hasData, onAddRoutine }) {
  const list = steps(mobile);
  const opener = document.activeElement;
  let i = 0;

  const hole = h('div', { class: 'tour-hole', 'aria-hidden': 'true' });
  const stepEl = h('span', { class: 'eyebrow tour-step' });
  const titleEl = h('h2', { id: 'tour-t' });
  const bodyEl = h('p', { id: 'tour-d' });
  const dots = h('div', { class: 'tour-dots', 'aria-hidden': 'true' }, list.map(() => h('span')));
  const backBtn = h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => go(i - 1) }, icon('chev-l', 'sm'), 'Geri');
  const nextBtn = h('button', { type: 'button', class: 'btn btn-primary', onClick: () => (i === list.length - 1 ? finish(false) : go(i + 1)) });
  const addBtn = !hasData && h('button', { type: 'button', class: 'btn', onClick: () => finish(true) }, icon('repeat', 'sm'), 'İlk rutini ekle');
  const skipBtn = h('button', { type: 'button', class: 'link tour-skip', onClick: () => finish(false) }, 'Turu atla');
  const iconBox = h('span', { class: 'tour-ic', 'aria-hidden': 'true' });

  const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tour-t', 'aria-describedby': 'tour-d' },
    h('div', { class: 'tour-top' }, iconBox, stepEl, skipBtn),
    titleEl, bodyEl,
    h('div', { class: 'tour-foot' }, dots, h('div', { class: 'grow' }), backBtn, addBtn, nextBtn));
  const root = h('div', { class: 'tour', onMousedown: (e) => { if (e.target === root) e.preventDefault(); } }, hole, card);

  function position() {
    const step = list[i];
    const r = findTarget(step.target);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 6;
    root.classList.toggle('is-centered', !r);
    if (!r) {
      hole.style.left = `${vw / 2}px`;
      hole.style.top = `${vh / 2}px`;
      hole.style.width = '0px';
      hole.style.height = '0px';
      card.style.left = `${Math.max(12, (vw - card.offsetWidth) / 2)}px`;
      card.style.top = `${Math.max(12, (vh - card.offsetHeight) / 2)}px`;
      return;
    }
    const hx = Math.max(4, r.left - pad);
    const hy = Math.max(4, r.top - pad);
    const hw = Math.min(vw - 8, r.width + pad * 2);
    const hh = Math.min(vh - 8, r.height + pad * 2);
    Object.assign(hole.style, { left: `${hx}px`, top: `${hy}px`, width: `${hw}px`, height: `${hh}px` });

    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const gap = 14;
    let top;
    let left;
    if (hy + hh + gap + ch <= vh - 12) top = hy + hh + gap; // altına
    else if (hy - gap - ch >= 12) top = hy - gap - ch; // üstüne
    else {
      // büyük hedef (ızgara): içine, sol üst köşeye
      top = Math.min(vh - ch - 12, hy + 16);
      left = Math.min(vw - cw - 12, hx + 16);
    }
    if (left === undefined) left = Math.min(Math.max(12, hx + hw / 2 - cw / 2), vw - cw - 12);
    card.style.left = `${left}px`;
    card.style.top = `${Math.max(12, top)}px`;
  }

  function go(n) {
    i = Math.max(0, Math.min(list.length - 1, n));
    const step = list[i];
    const last = i === list.length - 1;
    stepEl.textContent = i === 0 ? 'Tanıtım' : `${i} / ${list.length - 1}`;
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    iconBox.replaceChildren(icon(step.icon || 'info', 'sm'));
    backBtn.hidden = i === 0;
    nextBtn.replaceChildren(i === 0 ? 'Turu başlat' : last ? 'Başla' : 'İleri');
    if (!last && i !== 0) nextBtn.append(icon('chev-r', 'sm'));
    if (addBtn) addBtn.hidden = !last;
    skipBtn.hidden = last;
    [...dots.children].forEach((d, k) => d.classList.toggle('is-on', k === i));
    position();
    nextBtn.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    } else if (e.key === 'ArrowRight' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      e.stopPropagation();
      if (i < list.length - 1) go(i + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      if (i > 0) go(i - 1);
    } else trapFocus(card, e);
  }
  const onResize = () => position();

  function finish(addRoutine) {
    markSeen();
    root.remove();
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    if (addRoutine) onAddRoutine();
    else if (opener && opener.isConnected && opener !== document.body) opener.focus();
  }

  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  document.body.append(root);
  go(0);
}
