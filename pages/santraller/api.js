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

/**
 * Backend'e istek atar. Token varsa otomatik Authorization başlığı ekler.
 * Hata durumunda backend'in döndürdüğü {hata_kodu, mesaj} yapısını fırlatır.
 */
async function istekAt(yol, secenekler = {}) {
  const token = tokenAl();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(secenekler.headers || {}),
  };

  const yanit = await fetch(`${API_URL}${yol}`, { ...secenekler, headers });
  const veri = await yanit.json().catch(() => ({}));

  if (!yanit.ok) {
    const hata = new Error(veri.mesaj || "Bilinmeyen bir hata oluştu.");
    hata.hata_kodu = veri.hata_kodu;
    hata.durum = yanit.status;
    throw hata;
  }
  return veri;
}

async function girisYap(eposta, sifre) {
  const veri = await istekAt("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ eposta, sifre }),
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

function cikisYap() {
  tokenSil();
  window.localStorage.removeItem("hes_cmms_kullanici");
}

export { API_URL, istekAt, girisYap, cikisYap, tokenAl, kullaniciAl, yoneticiMi, isletmeYoneticisiMi, dosyaIndir };
