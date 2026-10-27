// localStorage kaydet/yükle. Veri yalnızca bu tarayıcıda tutulur.

import { DEFAULT_SETTINGS, SCHEMA_VERSION, validateData } from './validate.js';

export const STORAGE_KEY = 'haftam:v1';

export function emptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, customHolidays: [] },
    routines: [],
    events: [],
    overrides: [],
  };
}

/**
 * Kayıtlı veriyi yükler.
 * Dönüş: { data, status: 'new' | 'ok' | 'corrupt' | 'unavailable', errors }
 * Bozuk veri silinmez; ayrı bir anahtara kopyalanır.
 */
export function load() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { data: emptyData(), status: 'unavailable', errors: [] };
  }
  if (raw === null) return { data: emptyData(), status: 'new', errors: [] };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: emptyData(), status: 'corrupt', errors: ['Kayıtlı veri okunamadı.'], ...keepCorrupt(raw) };
  }
  const result = validateData(parsed);
  if (!result.ok) return { data: emptyData(), status: 'corrupt', errors: result.errors, ...keepCorrupt(raw) };
  return { data: result.data, status: 'ok', errors: [] };
}

function keepCorrupt(raw) {
  const key = `${STORAGE_KEY}:bozuk:${Date.now()}`;
  try {
    localStorage.setItem(key, raw);
    localStorage.removeItem(STORAGE_KEY);
    return { corruptKey: key };
  } catch {
    return {};
  }
}

/** Kaydeder; başarısızsa (kota, gizli mod) false döner. */
export function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearAll() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* yok say */
  }
}

/** Tarayıcıdan verinin kendiliğinden silinmemesini ister. */
export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* desteklenmiyor */
  }
  return false;
}

export function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
