const API_URL = process.env.NEXT_PUBLIC_API_URL;

function tokenAl() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("hes_cmms_token");
}

function tokenKaydet(token) {
  window.localStorage.setItem("hes_cmms_token", token);
}

function tokenSil() {
  window.localStorage.removeItem("hes_cmms_token");
}

function kullaniciKaydet(kullanici) {
  window.localStorage.setItem("hes_cmms_kullanici", JSON.stringify(kullanici));
}

function kullaniciAl() {
  if (typeof window === "undefined") return null;
  const ham = window.localStorage.getItem("hes_cmms_kullanici");
  return ham ? JSON.parse(ham) : null;
}

const YONETICI_ROLLERI = ["SANTRAL_SORUMLUSU", "ISLETME_ADMIN", "ADMIN"];
const ISLETME_YONETICI_ROLLERI = ["ISLETME_ADMIN", "ADMIN"];

function yoneticiMi() {
  const kullanici = kullaniciAl();
  return !!kullanici && YONETICI_ROLLERI.includes(kullanici.rol);
}

function isletmeYoneticisiMi() {
  const kullanici = kullaniciAl();
  return !!kullanici && ISLETME_YONETICI_ROLLERI.includes(kullanici.rol);
}

function platformAdminMi() {
  const kullanici = kullaniciAl();
  return !!kullanici && kullanici.rol === "ADMIN";
}

/**
 * Backend'e istek atar. Token varsa otomatik Authorization başlığı ekler.
 * Hata durumunda backend'in döndürdüğü {hata_kodu, mesaj} yapısını fırlatır.
 * Token GEÇERSİZ/SÜRESİ DOLMUŞ dönerse, oturumu temizleyip TEK SEFERLİK
 * olarak giriş sayfasına yönlendirir — aksi halde eski (artık geçersiz)
 * token'la her sayfa kendi başına tekrar tekrar başarısız istek atmaya
 * devam eder, bu da "sürekli yenileniyor" hissi veren tutarsız bir duruma
 * yol açar.
 */
let oturumSonlandirmaTetiklendi = false;
async function istekAt(yol, secenekler = {}) {
  const token = tokenAl();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(secenekler.headers || {}),
  };

  // Zaman aşımı — ağ isteği herhangi bir sebeple asılı kalırsa (sunucu
  // yanıt vermiyor, DNS sorunu, vb.) sonsuza kadar beklemek yerine net bir
  // hata fırlatır. 60 saniye olarak ayarlandı: Render'ın ücretsiz planı
  // bir süre kullanılmayınca "uykuya" geçiyor ve ilk isteğe uyanması
  // 20-50 saniye sürebiliyor — kısa bir zaman aşımı bu uyanmayı tam
  // ortasında keserdi.
  const controller = new AbortController();
  const zamanAsimi = setTimeout(() => controller.abort(), 60000);

  let yanit;
  try {
    yanit = await fetch(`${API_URL}${yol}`, { ...secenekler, headers, signal: controller.signal });
  } catch (agHatasi) {
    if (agHatasi.name === "AbortError") {
      throw new Error(
        "Sunucuya bağlanılamadı (60 saniye içinde yanıt gelmedi). Sunucu uykuda olabilir, birkaç saniye sonra tekrar deneyin."
      );
    }
    throw new Error(`Sunucuya bağlanılamadı: ${agHatasi.message}`);
  } finally {
    clearTimeout(zamanAsimi);
  }

  const veri = await yanit.json().catch(() => ({}));

  if (!yanit.ok) {
    if (
      yanit.status === 401 &&
      (veri.hata_kodu === "TOKEN_GECERSIZ" || veri.hata_kodu === "TOKEN_EKSIK" || veri.hata_kodu === "OTURUM_SONLANDIRILDI") &&
      typeof window !== "undefined"
    ) {
      if (!oturumSonlandirmaTetiklendi) {
        oturumSonlandirmaTetiklendi = true;
        tokenSil();
        window.localStorage.removeItem("hes_cmms_kullanici");
        if (window.location.pathname !== "/") {
          window.location.href = "/";
        }
      }
    }
    const hata = new Error(veri.mesaj || "Bilinmeyen bir hata oluştu.");
    hata.hata_kodu = veri.hata_kodu;
    hata.durum = yanit.status;
    hata.detay = veri;
    throw hata;
  }
  return veri;
}

async function girisYap(eposta, sifre, isletme_id, oturumu_sonlandir) {
  const veri = await istekAt("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      eposta,
      sifre,
      isletme_id: isletme_id || undefined,
      oturumu_sonlandir: oturumu_sonlandir || undefined,
    }),
  });
  tokenKaydet(veri.access_token);
  kullaniciKaydet(veri.kullanici);
  return veri;
}

/**
 * PDF/Excel gibi ikili (binary) dosya indiren uç noktalar için — normal
 * istekAt() yalnızca JSON bekler, bu yüzden ayrı bir fonksiyon gerekiyor.
 * Tarayıcı <a href> ile Authorization başlığı gönderilemediğinden, dosyayı
 * fetch ile alıp geçici bir indirme linkiyle tetikliyoruz.
 */
async function dosyaIndir(yol, dosyaAdi) {
  const token = tokenAl();
  const yanit = await fetch(`${API_URL}${yol}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!yanit.ok) {
    const veri = await yanit.json().catch(() => ({}));
    throw new Error(veri.mesaj || "Rapor indirilemedi.");
  }
  const blob = await yanit.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

async function cikisYap() {
  try {
    // Sunucudaki oturum kaydını da temizle — aksi halde kullanıcı "tek
    // cihaz" hakkını serbest bırakmamış olur ve başka bir cihazdan giriş
    // yapmak istediğinde gereksiz yere "başka oturum var" uyarısı alır.
    await istekAt("/api/v1/auth/cikis", { method: "POST" });
  } catch {
    // sunucuya ulaşılamasa bile yerel oturumu temizlemeye devam et
  }
  tokenSil();
  window.localStorage.removeItem("hes_cmms_kullanici");
}

/**
 * Sistem genelindeki (GM tarafından programdan değiştirilebilen) arka plan
 * resmini çekip sayfaya uygular. Oturum açılmadan önce (giriş sayfası)
 * dahil her sayfada çağrılmalıdır — bu yüzden auth gerektirmeyen bir uç
 * noktayı kullanır. Bir hata olursa sessizce geçilir (statik varsayılan
 * arka plan zaten CSS'te tanımlı).
 */
async function arkaPlaniUygula() {
  // KASITLI OLARAK istekAt() KULLANILMIYOR — bu çağrı tamamen izole olmalı,
  // başarısız olması (401/500/ağ hatası fark etmeksizin) sayfadaki BAŞKA
  // HİÇBİR ŞEYİ (özellikle giriş formunu) etkilememeli.
  try {
    const yanit = await fetch(`${API_URL}/api/v1/sistem-ayarlari/arkaplan`);
    if (!yanit.ok) return;
    const veri = await yanit.json();
    if (veri.arkaplan_resmi) {
      document.documentElement.style.setProperty("--sayfa-arkaplan-resmi", `url("${veri.arkaplan_resmi}")`);
    }
  } catch {
    // sessizce geç — CSS'teki statik varsayılan görsel zaten gösterilir
  }
}

export {
  API_URL,
  istekAt,
  girisYap,
  cikisYap,
  tokenAl,
  kullaniciAl,
  yoneticiMi,
  isletmeYoneticisiMi,
  platformAdminMi,
  dosyaIndir,
  arkaPlaniUygula,
};
