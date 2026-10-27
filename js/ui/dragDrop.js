// Haftalık ızgarada sürükle-bırak ile taşıma (fare/kalem; dokunmatikte kaydırma bozulmasın diye kapalı).
// Klavyeyle taşıma: popover › "Sadece bu haftayı düzenle" / "Tüm haftaları düzenle".

import { DAY_SHORT, minutesToTime, parseISODate, dayOfWeek } from '../dates.js';

const SNAP = 15;
const THRESHOLD = 5;

/**
 * section: WeekGrid öğesi; instances: key → örnek; days: görünen günler; range: saat aralığı
 * onDrop(inst, { date, start, end })
 */
export function enableDrag(section, { instances, days, range, onDrop }) {
  const scroller = section.querySelector('.wg-scroll');
  const cols = () => [...section.querySelectorAll('.wg-body > .dc')];
  const total = range.endMin - range.startMin;

  section.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    const el = e.target.closest('.ev');
    if (!el || !section.contains(el)) return;
    const inst = instances.get(el.dataset.fk);
    if (!inst || inst.cancelled) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const elRect = el.getBoundingClientRect();
    const grabY = e.clientY - elRect.top;
    const dur = inst.endMin - inst.startMin;
    let dragging = false;
    let clone = null;
    let tip = null;
    let target = null;

    const place = (x, y) => {
      const columns = cols();
      let idx = columns.findIndex((c) => {
        const r = c.getBoundingClientRect();
        return x >= r.left && x < r.right;
      });
      if (idx === -1) idx = x < columns[0].getBoundingClientRect().left ? 0 : columns.length - 1;
      const col = columns[idx];
      const r = col.getBoundingClientRect();
      let start = range.startMin + ((y - grabY - r.top) / r.height) * total;
      start = Math.round(start / SNAP) * SNAP;
      start = Math.max(range.startMin, Math.min(range.endMin - dur, start));
      const day = days[idx];
      target = { date: day.iso, start: minutesToTime(start), end: minutesToTime(start + dur), startMin: start };
      if (clone.parentNode !== col) col.append(clone, tip);
      const top = ((start - range.startMin) / total) * 100;
      clone.style.top = `${top}%`;
      clone.style.left = '3px';
      clone.style.width = 'calc(100% - 6px)';
      tip.style.top = `calc(${top}% - 20px)`;
      tip.textContent = `${DAY_SHORT[dayOfWeek(parseISODate(day.iso)) - 1]} ${target.start}–${target.end}`;
      const meta = clone.querySelector('.ev-m');
      if (meta) meta.textContent = `${target.start}–${target.end}`;
    };

    const autoScroll = (y) => {
      const r = scroller.getBoundingClientRect();
      if (y < r.top + 70) scroller.scrollTop -= 14;
      else if (y > r.bottom - 30) scroller.scrollTop += 14;
    };

    const onMove = (ev) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
        dragging = true;
        el.setPointerCapture(e.pointerId);
        clone = el.cloneNode(true);
        clone.classList.add('is-dragging');
        el.classList.add('is-drag-source');
        clone.removeAttribute('data-fk');
        clone.setAttribute('aria-hidden', 'true');
        clone.tabIndex = -1;
        tip = document.createElement('span');
        tip.className = 'drag-tip';
        tip.setAttribute('role', 'status');
        document.body.classList.add('is-dragging-ev');
      }
      ev.preventDefault();
      autoScroll(ev.clientY);
      place(ev.clientX, ev.clientY);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('is-dragging-ev');
      if (clone) {
        clone.remove();
        tip.remove();
        el.classList.remove('is-drag-source');
      }
    };

    const swallowClick = () => {
      const stop = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
    };

    const onUp = () => {
      cleanup();
      if (!dragging) return;
      swallowClick();
      if (target && (target.date !== inst.date || target.start !== inst.start)) {
        onDrop(inst, { date: target.date, start: target.start, end: target.end });
      }
    };

    const onKey = (ev) => {
      if (ev.key === 'Escape' && dragging) {
        ev.preventDefault();
        ev.stopPropagation();
        dragging = false;
        cleanup();
        swallowClick();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey, true);
  });
}
