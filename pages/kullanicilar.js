import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, kullaniciAl, isletmeYoneticisiMi } from "../lib/api";
import UstBar from "../components/UstBar";

const ROL_ETIKETLERI = {
  ADMIN: "Platform Admin",
  ISLETME_ADMIN: "İşletme Admin",
  SANTRAL_SORUMLUSU: "Santral Sorumlusu",
  SAHA_PERSONELI: "Saha Personeli",
  IZLEYICI: "İzleyici",
};

// Platform Admin (ADMIN) seçeneği yalnızca oturum açan kullanıcı zaten
// Platform Admin ise gösterilir — bir İşletme Admin başka birini
// Platform Admin yapamaz (bu, backend'de de ayrıca zorlanıyor).
function rolSecenekleri() {
  const kendiRol = kullaniciAl()?.rol;
  if (kendiRol === "ADMIN") return ROL_ETIKETLERI;
  const { ADMIN, ...digerleri } = ROL_ETIKETLERI;
  return digerleri;
}

export default function KullanicilarSayfasi() {
  const router = useRouter();
  const [kullanicilar, setKullanicilar] = useState(null);
  const [santraller, setSantraller] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);

  const [formuAcik, setFormuAcik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [yeniKullanici, setYeniKullanici] = useState({
    ad_soyad: "",
    eposta: "",
    telefon: "",
    rol: "SAHA_PERSONELI",
    sifre: "",
  });

  const isletmeId = typeof window !== "undefined" ? kullaniciAl()?.isletme_id : null;

  const verileriYukle = useCallback(async () => {
    if (!isletmeId) return;
    try {
      const [k, s] = await Promise.all([
        istekAt(`/api/v1/isletmeler/${isletmeId}/kullanicilar`),
        istekAt(`/api/v1/santraller`),
      ]);
      setKullanicilar(k.veri);
      setSantraller(s.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, [isletmeId]);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!isletmeYoneticisiMi()) {
      router.replace("/gorevler");
      return;
    }
    verileriYukle();
  }, [verileriYukle, router]);

  async function kullaniciEkle(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    setGonderiliyor(true);
    try {
      const gonderilecek = { ...yeniKullanici };
      if (!gonderilecek.sifre) delete gonderilecek.sifre;

      const sonuc = await istekAt(`/api/v1/isletmeler/${isletmeId}/kullanicilar`, {
        method: "POST",
        body: JSON.stringify(gonderilecek),
      });

      if (sonuc.uretilen_sifre) {
        setBilgi(
          `Kullanıcı oluşturuldu. Otomatik üretilen şifre: "${sonuc.uretilen_sifre}" — bu şifreyi şimdi not edin, tekrar görüntülenemeyecek.`
        );
      } else {
        setBilgi("Kullanıcı oluşturuldu.");
      }

      setYeniKullanici({ ad_soyad: "", eposta: "", telefon: "", rol: "SAHA_PERSONELI", sifre: "" });
      setFormuAcik(false);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function sifreSifirla(kullaniciId) {
    const yeniSifre = prompt("Bu kullanıcı için yeni şifre girin (en az 6 karakter):");
    if (!yeniSifre) return;
    setHata(null);
    setBilgi(null);
    try {
      await istekAt(`/api/v1/kullanicilar/${kullaniciId}/sifre-sifirla`, {
        method: "POST",
        body: JSON.stringify({ yeni_sifre: yeniSifre }),
      });
      setBilgi("Şifre güncellendi — yeni şifreyi kullanıcıya iletmeyi unutmayın.");
    } catch (err) {
      setHata(err.message);
    }
  }

  async function rolDegistir(kullaniciId, yeniRol) {
    setHata(null);
    try {
      await istekAt(`/api/v1/kullanicilar/${kullaniciId}`, {
        method: "PATCH",
        body: JSON.stringify({ rol: yeniRol }),
      });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function engelleAcKapa(kullanici) {
    setHata(null);
    try {
      const yol = kullanici.aktif_mi
        ? `/api/v1/kullanicilar/${kullanici.kullanici_id}/engelle`
        : `/api/v1/kullanicilar/${kullanici.kullanici_id}/engeli-kaldir`;
      await istekAt(yol, { method: "POST" });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function santralErisimiEkle(kullaniciId, santralId) {
    if (!santralId) return;
    setHata(null);
    try {
      await istekAt(`/api/v1/kullanicilar/${kullaniciId}/santral-erisimi`, {
        method: "POST",
        body: JSON.stringify({ santral_id: santralId }),
      });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function santralErisimiKaldir(kullaniciId, santralId) {
    setHata(null);
    try {
      await istekAt(`/api/v1/kullanicilar/${kullaniciId}/santral-erisimi/${santralId}`, {
        method: "DELETE",
      });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  return (
    <>
      <Head>
        <title>Kullanıcılar — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Kullanıcılar</h2>
            <button className="kucukButon" onClick={() => setFormuAcik((v) => !v)}>
              {formuAcik ? "Vazgeç" : "+ Yeni Kullanıcı"}
            </button>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {formuAcik && (
            <form onSubmit={kullaniciEkle} className="yonetimFormu">
              <div className="alan">
                <label>Ad Soyad</label>
                <input
                  required
                  value={yeniKullanici.ad_soyad}
                  onChange={(e) => setYeniKullanici({ ...yeniKullanici, ad_soyad: e.target.value })}
                />
              </div>
              <div className="alan">
                <label>E-posta (kullanıcı adı)</label>
                <input
                  required
                  type="email"
                  value={yeniKullanici.eposta}
                  onChange={(e) => setYeniKullanici({ ...yeniKullanici, eposta: e.target.value })}
                />
              </div>
              <div className="alan">
                <label>Telefon (isteğe bağlı)</label>
                <input
                  value={yeniKullanici.telefon}
                  onChange={(e) => setYeniKullanici({ ...yeniKullanici, telefon: e.target.value })}
                />
              </div>
              <div className="alan">
                <label>Rol</label>
                <select
                  value={yeniKullanici.rol}
                  onChange={(e) => setYeniKullanici({ ...yeniKullanici, rol: e.target.value })}
                >
                  {Object.entries(rolSecenekleri()).map(([deger, etiket]) => (
                    <option key={deger} value={deger}>
                      {etiket}
                    </option>
                  ))}
                </select>
              </div>
              <div className="alan">
                <label>Şifre (boş bırakılırsa otomatik üretilir)</label>
                <input
                  type="text"
                  value={yeniKullanici.sifre}
                  onChange={(e) => setYeniKullanici({ ...yeniKullanici, sifre: e.target.value })}
                  placeholder="En az 6 karakter"
                />
              </div>
              <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                {gonderiliyor ? "Ekleniyor…" : "Kullanıcıyı Ekle"}
              </button>
            </form>
          )}

          {!kullanicilar && <div className="yukleniyor">Yükleniyor…</div>}

          {kullanicilar &&
            kullanicilar.map((k) => (
              <div className="satirKart" key={k.kullanici_id}>
                <div className="kullaniciUst">
                  <div>
                    <strong>{k.ad_soyad}</strong> — {k.eposta}
                    {!k.aktif_mi && <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>Engelli</span>}
                  </div>
                </div>

                <div className="kullaniciSatir">
                  <label>Rol:</label>
                  <select
                    value={k.rol}
                    disabled={k.rol === "ADMIN" && kullaniciAl()?.rol !== "ADMIN"}
                    onChange={(e) => rolDegistir(k.kullanici_id, e.target.value)}
                  >
                    {Object.entries(k.rol === "ADMIN" ? ROL_ETIKETLERI : rolSecenekleri()).map(
                      ([deger, etiket]) => (
                        <option key={deger} value={deger}>
                          {etiket}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {k.rol !== "ISLETME_ADMIN" && (
                  <div className="kullaniciSatir">
                    <label>Santral erişimi:</label>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        santralErisimiEkle(k.kullanici_id, e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>
                        + Santral ekle…
                      </option>
                      {santraller &&
                        santraller.map((s) => (
                          <option key={s.santral_id} value={s.santral_id}>
                            {s.ad}
                          </option>
                        ))}
                    </select>
                    <span className="santralEtiketleri">
                      {(k.santral_erisimleri || []).map((s) => (
                        <span key={s.santral_id} className="santralEtiket">
                          {s.ad}
                          <button onClick={() => santralErisimiKaldir(k.kullanici_id, s.santral_id)}>×</button>
                        </span>
                      ))}
                    </span>
                  </div>
                )}

                <div className="kullaniciAlt">
                  <button className="linkButon" onClick={() => sifreSifirla(k.kullanici_id)}>
                    Şifreyi sıfırla
                  </button>
                  <button className="linkButon" onClick={() => engelleAcKapa(k)}>
                    {k.aktif_mi ? "Hesabı engelle" : "Engeli kaldır"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
