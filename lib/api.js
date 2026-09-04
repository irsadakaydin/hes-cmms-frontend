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

function cikisYap() {
  tokenSil();
  window.localStorage.removeItem("hes_cmms_kullanici");
}

export { API_URL, istekAt, girisYap, cikisYap, tokenAl, kullaniciAl };
