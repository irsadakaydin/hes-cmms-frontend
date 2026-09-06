import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, platformAdminMi } from "../lib/api";
import UstBar from "../components/UstBar";

function bosForm() {
  return { ad: "", alan_adi: "", ilk_admin_ad_soyad: "", ilk_admin_eposta: "", ilk_admin_sifre: "" };
}

export default function HoldinglerSayfasi() {
  const router = useRouter();
  const [holdingler, setHoldingler] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [formuAcik, setFormuAcik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [taslak, setTaslak] = useState(bosForm());

  const verileriYukle = useCallback(async () => {
    try {
      const veri = await istekAt("/api/v1/isletmeler");
      setHoldingler(veri.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, []);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!platformAdminMi()) {
      router.replace("/gorevler");
      return;
    }
    verileriYukle();
  }, [verileriYukle, router]);

  async function holdingEkle(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    setGonderiliyor(true);
    try {
      const sonuc = await istekAt("/api/v1/isletmeler", {
        method: "POST",
        body: JSON.stringify({
          ad: taslak.ad,
          alan_adi: taslak.alan_adi,
          ilk_admin: {
            ad_soyad: taslak.ilk_admin_ad_soyad,
            eposta: taslak.ilk_admin_eposta,
            sifre: taslak.ilk_admin_sifre || undefined,
          },
        }),
      });
      if (sonuc.uretilen_sifre) {
        setBilgi(
          `Holding oluşturuldu. İlk İşletme Admin şifresi (otomatik üretildi): "${sonuc.uretilen_sifre}" — şimdi not edin, tekrar görüntülenemeyecek.`
        );
      } else {
        setBilgi("Holding oluşturuldu.");
      }
      setTaslak(bosForm());
      setFormuAcik(false);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function durumDegistir(holding) {
    setHata(null);
    setBilgi(null);
    try {
      const yol =
        holding.durum === "AKTIF"
          ? `/api/v1/isletmeler/${holding.isletme_id}/pasiflestir`
          : `/api/v1/isletmeler/${holding.isletme_id}/aktiflestir`;
      await istekAt(yol, { method: "POST" });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function holdingSil(holding) {
    if (
      !confirm(
        `"${holding.ad}" holdingini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
      )
    )
      return;
    setHata(null);
    setBilgi(null);
    try {
      await istekAt(`/api/v1/isletmeler/${holding.isletme_id}`, { method: "DELETE" });
      setBilgi("Holding silindi.");
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  return (
    <>
      <Head>
        <title>Holdingler — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Holdingler</h2>
            <button className="kucukButon" onClick={() => setFormuAcik((v) => !v)}>
              {formuAcik ? "Vazgeç" : "+ Yeni Holding"}
            </button>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {formuAcik && (
            <form onSubmit={holdingEkle} className="yonetimFormu">
              <div className="alan">
                <label>Holding adı</label>
                <input
                  required
                  value={taslak.ad}
                  onChange={(e) => setTaslak({ ...taslak, ad: e.target.value })}
                  placeholder="Ör. Energo-Pro Holding"
                />
              </div>
              <div className="alan">
                <label>Alan adı (slug — küçük harf, boşluksuz)</label>
                <input
                  required
                  value={taslak.alan_adi}
                  onChange={(e) => setTaslak({ ...taslak, alan_adi: e.target.value })}
                  placeholder="Ör. energo-pro-holding"
                />
              </div>
              <div className="alan">
                <label>İlk İşletme Admin — Ad Soyad</label>
                <input
                  required
                  value={taslak.ilk_admin_ad_soyad}
                  onChange={(e) => setTaslak({ ...taslak, ilk_admin_ad_soyad: e.target.value })}
                />
              </div>
              <div className="alan">
                <label>İlk İşletme Admin — E-posta</label>
                <input
                  required
                  type="email"
                  value={taslak.ilk_admin_eposta}
                  onChange={(e) => setTaslak({ ...taslak, ilk_admin_eposta: e.target.value })}
                />
              </div>
              <div className="alan">
                <label>İlk İşletme Admin — Şifre (boş bırakılırsa otomatik üretilir)</label>
                <input
                  type="text"
                  value={taslak.ilk_admin_sifre}
                  onChange={(e) => setTaslak({ ...taslak, ilk_admin_sifre: e.target.value })}
                  placeholder="En az 6 karakter"
                />
              </div>
              <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                {gonderiliyor ? "Oluşturuluyor…" : "Holdingi Oluştur"}
              </button>
            </form>
          )}

          {!holdingler && <div className="yukleniyor">Yükleniyor…</div>}

          {holdingler &&
            holdingler.map((h) => (
              <div className="satirKart" key={h.isletme_id}>
                <div>
                  <strong>{h.ad}</strong>
                  {h.durum !== "AKTIF" && (
                    <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>
                      Pasif
                    </span>
                  )}
                </div>
                <div className="gorevAlt">/{h.alan_adi}</div>
                <div className="kullaniciAlt">
                  <button className="linkButon" onClick={() => durumDegistir(h)}>
                    {h.durum === "AKTIF" ? "Pasifleştir" : "Yeniden aktifleştir"}
                  </button>
                  <button className="linkButon" onClick={() => holdingSil(h)}>
                    Sil
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
