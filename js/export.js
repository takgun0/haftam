// Dışa aktarma: JSON yedek ve yazdırma.

import { toISODate } from './dates.js';

export function backupFileName(now = new Date()) {
  return `haftam-yedek-${toISODate(now)}.json`;
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Verinin JSON yedeğini indirir; dosya adını döndürür. */
export function downloadBackup(data, now = new Date()) {
  const name = backupFileName(now);
  download(name, JSON.stringify(data, null, 2), 'application/json');
  return name;
}

/** Kullanıcıdan bir .json dosyası seçmesini ister; metnini döndürür (iptalde null). */
export function pickJSONFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      if (file.size > 5 * 1024 * 1024) return resolve({ error: 'Dosya çok büyük (en fazla 5 MB).' });
      try {
        resolve({ name: file.name, text: await file.text() });
      } catch {
        resolve({ error: 'Dosya okunamadı.' });
      }
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export function printWeek() {
  window.print();
}
