import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, kullaniciAl } from "../../lib/api";
import UstBar from "../../components/UstBar";

// Karekod okutulunca açılan sayfa — /depo-karekod/<malzeme_id>
// Oturum açık bir kullanıcı, taranan malzeme için doğrudan burada bir
// Malzeme Çıkış talebi oluşturabilir.
export default function DepoKarekodSayfasi() {
  const router = useRouter();
  const { malzeme_id } = router.query;
  const kullanici = typeof window !== "undefined" ? kullaniciAl() : null;
  const sahaVeUstu = !!kullanici && kullanici.rol !== "IZLEYICI";

  const [malzeme, setMalzeme] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [miktar, setMiktar] = useState("");
  const [kullanimYeri, setKullanimYeri] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (!tokenAl()) {
      router.replace(`/?sonra=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (!malzeme_id) return;
    istekAt(`/api/v1/depo/malzemeler/${malzeme_id}`)
      .then(setMalzeme)
      .catch((err) => setHata(err.message));
  }, [router, malzeme_id]);

  async function talepGonder(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    if (Number(malzeme.mevcut_miktar) < Number(miktar)) {
      setHata("Depoda talep ettiğiniz miktarda malzeme bulunmamaktadır.");
      return;
    }
    setGonderiliyor(true);
    try {
      await istekAt(`/api/v1/santraller/${malzeme.santral_id}/depo/cikis-talep`, {
        method: "POST",
        body: JSON.stringify({ malzeme_id, miktar: Number(miktar), kullanim_yeri: kullanimYeri || null }),
      });
      setBilgi("Çıkış talebi oluşturuldu — Santral Sorumlusu/İşletme Admin onayı bekleniyor.");
      setMiktar("");
      setKullanimYeri("");
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <>
      <Head>
        <title>Malzeme Çıkış Talebi — Bakım Yönetim Sistemi</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik" style={{ maxWidth: "520px" }}>
          <div className="bolumBaslik">
            <h2>Malzeme Çıkış Talebi</h2>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {!malzeme && !hata && <div className="yukleniyor">Yükleniyor…</div>}

          {malzeme && (
            <div className="yonetimFormu">
              <h3 style={{ marginTop: 0 }}>{malzeme.ad}</h3>
              <div className="gorevAlt" style={{ marginBottom: "14px" }}>
                SKU: {malzeme.sku} · Mevcut stok: {malzeme.mevcut_miktar} {malzeme.birim}
                {malzeme.konum && ` · Konum: ${malzeme.konum}`}
              </div>

              {!sahaVeUstu ? (
                <div className="bosDurum">Çıkış talebi oluşturma yetkiniz yok.</div>
              ) : (
                <form onSubmit={talepGonder}>
                  <div className="alan">
                    <label>Miktar</label>
                    <input
                      required
                      type="number"
                      step="any"
                      min="0.001"
                      value={miktar}
                      onChange={(e) => setMiktar(e.target.value)}
                    />
                  </div>
                  <div className="alan">
                    <label>Malzemenin Kullanım Yeri</label>
                    <input
                      value={kullanimYeri}
                      onChange={(e) => setKullanimYeri(e.target.value)}
                      placeholder="Ör. Ünite 2 Türbin Yatağı, Şalt Sahası…"
                    />
                  </div>
                  <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                    {gonderiliyor ? "Gönderiliyor…" : "Çıkış Talebi Gönder"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
