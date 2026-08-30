# Türkmençe Ýazuw Barlagçy

Chrome ve Chromium tabanlı tarayıcılar için yerel çalışan Turkmence yazım
denetleme extension'ı. Sosyal medya sayfalarındaki muhtemel Turkmence metinleri
algılar ve sözlükte bulunmayan kelimeleri kırmızı dalgalı çizgiyle işaretler.
Sözlük cihazdan ayrılmaz; uzak API veya sunucu kullanılmaz.

## Chrome'a yükleme

1. Repository'yi indir veya clone et.
2. Chrome'da `chrome://extensions` adresini aç.
3. Sağ üstten **Developer mode** seçeneğini aç.
4. **Load unpacked** seçeneğine basıp repository klasörünü seç.
5. Bir sosyal medya sayfasını yenile.

Extension dinamik yüklenen gönderileri izler. Bir metin bloğunu Turkmence kabul
etmek için sözlük eşleşme oranına ve Turkmence karakterlere bakar. Morfoloji
motoru henüz olmadığı için bazı doğru çekimli kelimeler yanlış işaretlenebilir.

## Yapı

- `data/dictionary.json`: Yerel sözlük verisi
- `background.js`: Sözlüğü yükleyen ve sorgulayan service worker
- `content.js`: Sayfadaki metinleri algılayan ve işaretleyen kod
- `popup.*`: Extension açma/kapatma arayüzü
