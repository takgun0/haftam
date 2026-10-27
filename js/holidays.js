// Tatil verisi. Sabit tarihli resmî tatiller her yıl aynı günde;
// dini bayramlar yıla göre değiştiği için kullanıcı ayarlardan ekler.

export const FIXED_HOLIDAYS = [
  { md: '01-01', name: 'Yılbaşı' },
  { md: '04-23', name: 'Ulusal Egemenlik ve Çocuk Bayramı' },
  { md: '05-01', name: 'Emek ve Dayanışma Günü' },
  { md: '05-19', name: 'Atatürk’ü Anma, Gençlik ve Spor Bayramı' },
  { md: '07-15', name: 'Demokrasi ve Millî Birlik Günü' },
  { md: '08-30', name: 'Zafer Bayramı' },
  { md: '10-29', name: 'Cumhuriyet Bayramı' },
];

/**
 * Verilen ISO tarih tatilse adını döndürür, değilse null.
 * Kullanıcının kendi tatilleri resmî tatillerden önce gelir.
 */
export function getHoliday(iso, customHolidays = []) {
  const custom = customHolidays.find((h) => h.date === iso);
  if (custom) return { name: custom.name, custom: true };
  const md = iso.slice(5);
  const fixed = FIXED_HOLIDAYS.find((h) => h.md === md);
  return fixed ? { name: fixed.name, custom: false } : null;
}
