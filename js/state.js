// Uygulama durumu: kalıcı veri (data) + arayüz durumu (ui).
// Her değişiklik abonelere bildirilir; data değişince localStorage'a yazılır.

import { save } from './storage.js';

let state = { data: null, ui: {} };
const listeners = new Set();
let undoSnapshot = null;
let saveFailed = false;

export function initState(data, ui) {
  state = { data, ui };
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(state);
}

/**
 * Veriyi günceller. updater bir kopya alır ve değiştirir (ya da yenisini döndürür).
 * Dönüş: kayıt başarılı mı.
 */
export function updateData(updater, { undoable = true } = {}) {
  const before = state.data;
  const draft = structuredClone(before);
  const next = updater(draft) || draft;
  if (undoable) undoSnapshot = before;
  state = { ...state, data: next };
  saveFailed = !save(next);
  emit();
  return !saveFailed;
}

export function replaceData(next) {
  return updateData(() => next);
}

export function canUndo() {
  return undoSnapshot !== null;
}

export function undo() {
  if (!undoSnapshot) return false;
  const snap = undoSnapshot;
  undoSnapshot = null;
  state = { ...state, data: snap };
  saveFailed = !save(snap);
  emit();
  return true;
}

export function lastSaveFailed() {
  return saveFailed;
}

export function setUI(patch) {
  state = { ...state, ui: { ...state.ui, ...patch } };
  emit();
}
