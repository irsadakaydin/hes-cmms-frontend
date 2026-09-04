# HES CMMS — Frontend (Web Arayüzü)

Bu, `hes_cmms_backend` API'sini kullanan, saha personelinin görevlerini görüp
tamamlayabildiği web arayüzünün ilk sürümüdür. Next.js (Pages Router) ile
yazılmıştır.

## İçindeki sayfalar

| Sayfa | Yol | Açıklama |
|---|---|---|
| Giriş | `/` | E-posta + şifre ile giriş |
| Görevlerim | `/gorevler` | Oturum açan kullanıcıya atanmış açık görevler |
| Görev Detayı | `/gorevler/[id]` | Checklist doldurup bakımı tamamlama |

Henüz eklenmeyen (sonraki aşamalar): İşletme/Ekipman/Bakım Planı yönetim
ekranları, raporlama ekranları, kullanıcı yönetimi — bunlar backend'de zaten
hazır (`hes_cmms_api_endpoints.md`), yalnızca arayüzleri eksik.

## Kurulum — yerel bilgisayarınızda test etme

```bash
npm install
cp .env.local.example .env.local
```

`.env.local` dosyasını açıp `NEXT_PUBLIC_API_URL` değerini backend'inizin
**Render'daki canlı adresiyle** doldurun (ör. `https://hes-cmms-backend.onrender.com`
— sonunda `/` OLMADAN).

```bash
npm run dev
```

Tarayıcıda `http://localhost:3000` adresini açın. `hes_cmms_seed_data.sql`'deki
kullanıcılardan biriyle giriş yapabilirsiniz (daha önce backend'i test ederken
bcrypt şifre atadığınız kullanıcı, ör. `ayse.kara@aydem.com.tr` / `test1234`).

> **Not:** `NEXT_PUBLIC_` önekli ortam değişkenleri Next.js'te **derleme
> anında** koda gömülür. `.env.local` dosyasını değiştirdikten sonra
> `npm run dev` sürecini durdurup yeniden başlatmanız gerekir.

## Vercel'e dağıtım (deploy)

Backend'i Render'a nasıl taşıdıysanız, bu da aynı mantıkla Vercel'e taşınır:

1. Bu klasörün içeriğini (backend'de yaptığınız gibi) yeni bir GitHub deposuna
   (`hes-cmms-frontend`) yükleyin — `node_modules` ve `.env.local` HARİÇ.
2. [vercel.com](https://vercel.com)'a GitHub hesabınızla giriş yapın.
3. "Add New" → "Project" ile `hes-cmms-frontend` deposunu seçin.
4. Framework Preset otomatik "Next.js" algılanır, dokunmanıza gerek yok.
5. "Environment Variables" bölümüne `NEXT_PUBLIC_API_URL` değişkenini
   backend'inizin Render adresiyle ekleyin.
6. "Deploy" butonuna basın — birkaç dakika içinde canlı bir adres
   (ör. `https://hes-cmms-frontend.vercel.app`) alırsınız.

## Bilinen sınırlamalar (bu ilk sürümde)

- **İmza:** Gerçek bir imza çizme bileşeni yok — kullanıcı ad-soyadını yazarak
  onaylıyor. İleride bir `<canvas>` tabanlı imza yakalama bileşeni eklenebilir.
- **Fotoğraf yükleme:** Bakım kaydına fotoğraf ekleme arayüzü henüz yok
  (backend bunu destekliyor, `fotograf_urlleri` alanı şu an her zaman boş
  gönderiliyor). Dosya yükleme için Supabase Storage veya benzeri bir servis
  entegre edilmeli.
- **Rol bazlı ekranlar yok:** Şu an herkes aynı "Görevlerim" ekranını görüyor.
  Santral Sorumlusu/İşletme Admin için plan/ekipman yönetim ekranları
  eklenmedi.

## Bağımlılıklar

`next`, `react`, `react-dom` — hepsi `npm install` ile otomatik kurulur.
