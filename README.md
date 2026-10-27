# Haftam

Üniversite öğrencileri için tarayıcıda çalışan, sade bir haftalık program uygulaması.

- **Rutinler:** Ders programı gibi tekrarlayan etkinlikleri bir kez gir, dönem boyunca her hafta (ya da 2 haftada bir) kendiliğinden görünsün.
- **Tek seferlik etkinlikler:** Yalnızca kendi haftasında görünür.
- **Haftalık değişiklik:** Bir rutinin tek bir haftasını düzenle ya da iptal et; diğer haftalar etkilenmez.
- **Yaklaşan paneli:** Bildirim yok. Önümüzdeki 7 gün "Şu an / Bugün / Yarın / tarih" olarak gruplanır, sıradaki etkinlik öne çıkar.
- **Tatiller:** Sabit resmî tatiller işaretlenir. O günkü rutinler kendiliğinden iptal görünür, istersen yine de gösterebilirsin.
- **Sürükle-bırak:** Masaüstünde bir bloğu fareyle başka bir saate ya da güne taşı. Rutinlerde "sadece bu hafta mı, tüm haftalar mı" diye sorulur. Klavyeyle aynı işlem için detay penceresindeki "Sadece bu haftayı düzenle" / "Tüm haftaları düzenle" seçeneklerini kullan.
- **Haftalık özet:** Görüntülenen haftanın kategori bazında toplam saatleri, çakışma ve iptal sayısı.
- **Ayarlar:** Dönem tarihleri, gün başlangıç/bitiş saati, hafta sonunu göster/gizle, tema (sistem/açık/koyu), kendi tatil günlerin (dini bayramlar gibi), veri işlemleri. 14 günden uzun süredir yedek alınmadıysa uyarı gösterilir.
- **Yedek ve dışa aktarma:** JSON yedek al/yükle; **Takvime aktar (.ics)** ile Google, Apple veya Outlook takvimine aktar; A4 yatay, tek sayfalık haftalık tablo yazdır ya da PDF'e kaydet.
- **Açık / koyu tema**, masaüstü ve mobil (< 768 px) yerleşim, klavye kısayolları.

### .ics dosyasını Google Takvim'e aktarma

1. Haftam'da **Ayarlar › Veri › Takvime aktar (.ics)** ile dosyayı indir.
2. Google Takvim'de **Ayarlar › İçe ve dışa aktar › İçe aktar**'ı aç, dosyayı seç ve hedef takvimi belirle.

Rutinler tekrarlayan etkinlik (`RRULE`) olarak gelir. İptal edilen haftalar ve tatil günleri çıkarılır (`EXDATE`), sadece o hafta değiştirilenler ayrı örnek (`RECURRENCE-ID`) olur. Saatler Europe/Istanbul saat dilimindedir. İçe aktarma tek seferliktir: Haftam'da sonradan yaptığın değişiklikler takvime kendiliğinden yansımaz. Önce ayrı bir takvime aktarman önerilir; böylece gerekirse o takvimi silip yeniden aktarabilirsin.

> **Verilerin yalnızca bu tarayıcıda saklanır.** Hesap yok, sunucu yok; hiçbir şey dışarı gönderilmez.
> Tarayıcı verilerini temizlersen ya da başka bir cihaz/tarayıcı kullanırsan programın görünmez.
> **Ayarlar › Veri › Yedek al** ile düzenli olarak JSON yedeği indir.

**Yayın adresi:** https://takgun0.github.io/haftam/

## Klavye kısayolları

| Tuş | İşlem |
| --- | --- |
| ← / → | Önceki / sonraki hafta |
| T | Bugüne dön |
| N | Yeni etkinlik |
| Esc | Açık pencereyi kapat |

## Yerelde çalıştırma

Derleme adımı yok; ama tarayıcılar ES modüllerini `file://` üzerinden yüklemediği için dosyaları küçük bir yerel sunucuyla açman gerekir. Proje klasöründe şunlardan birini çalıştır:

```bash
npx serve .
```

```bash
python -m http.server 8000
```

Ya da VS Code'da **Live Server** eklentisiyle `index.html` dosyasını aç.

## Testler

`schedule.js`, `dates.js` ve .ics çıktısı için testler:

- **Tarayıcıda:** yerel sunucu açıkken `tests/schedule.test.html` sayfasını aç.
- **Node ile (isteğe bağlı):**

```bash
node tests/run.js
```

Testler (.ics dahil) hafta başlangıcını, 2 haftada bir tekrarı, geçerlilik sınırlarını, iptal/değişiklik override'larını, tatilleri, çakışma yerleşimini, ay ve yıl geçişi olan haftaları ve yaklaşanlar listesini kapsar.

## Dosya yapısı

```
index.html            Uygulama kabuğu (CSP meta etiketi, satır içi script yok)
css/tokens.css        Tasarım değişkenleri (açık + koyu tema)
css/app.css           Bileşen stilleri
css/print.css         Yazdırma (A4 yatay)
js/main.js            Başlatma, olay bağlama, klavye
js/state.js           Uygulama durumu; değişince yeniden çizim
js/storage.js         localStorage ("haftam:v1"), kalıcı depolama isteği
js/schedule.js        Hafta hesaplama (saf fonksiyonlar)
js/dates.js           Tarih yardımcıları (yerel tarih bileşenleri; toISOString yok)
js/holidays.js        Resmî tatiller
js/export.js          JSON yedek, .ics, yazdırma
js/validate.js        İçe aktarılan verinin şema doğrulaması
js/ui/                Bileşenler (AppHeader, WeekGrid, EventBlock, UpcomingPanel, EventModal …)
tests/                Tarayıcıda (ve Node'da) çalışan testler
```

## Notlar

- Font: Tasarım **Inter** kullanıyor. Harici bağımlılık olmaması için font sayfaya yüklenmiyor; Inter cihazında yüklüyse o, değilse sistem yazı tipi kullanılır.
- Güvenlik: Kullanıcıdan ya da yedek dosyasından gelen metinler yalnızca `textContent` ile basılır. İçe aktarılan veri tip, biçim (`SS:DD`, `YYYY-AA-GG`), kategori ve uzunluk açısından doğrulanır; bilinmeyen alanlar atılır.
