import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl } from "../../lib/api";

const PERIYOT_ETIKETLERI = {
  GUNLUK: "Günlük",
  HAFTALIK: "Haftalık",
  AYLIK: "Aylık",
  UC_AYLIK: "3 Ayda Bir",
  ALTI_AYLIK: "6 Ayda Bir",
  YILLIK: "Yıllık",
  IKI_YILLIK: "2 Yılda Bir",
  UC_YILLIK: "3 Yılda Bir",
  BES_YILLIK: "5 Yılda Bir",
  ON_YILLIK: "10 Yılda Bir",
};

export default function KarekodSablonSayfasi() {
  const router = useRouter();
  const { sablon_id } = router.query;

  const [veri, setVeri] = useState(null);
  const [seciliEkipmanId, setSeciliEkipmanId] = useState("");
  const [hata, setHata] = useState(null);
  const [baslatiliyor, setBaslatiliyor] = useState(false);
  const [baslatildi, setBaslatildi] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (!tokenAl()) {
      router.replace(`/?sonra=${encodeURIComponent(router.asPath)}`);
      return;
    }
    if (!sablon_id) return;
    istekAt(`/api/v1/bakim-sablonlari/${sablon_id}/karekod-ekipmanlari`)
      .then((v) => {
        setVeri(v);
        if (v.ekipmanlar.length === 1) setSeciliEkipmanId(v.ekipmanlar[0].ekipman_id);
      })
      .catch((err) => setHata(err.message));
  }, [router.isReady, sablon_id]);

  async function baslat() {
    setBaslatiliyor(true);
    setHata(null);
    try {
      const sonuc = await istekAt(`/api/v1/ekipmanlar/${seciliEkipmanId}/karekod-baslat`, {
        method: "POST",
        body: JSON.stringify({ sablon_id }),
      });
      setBaslatildi(true);
      setTimeout(() => router.push(`/gorevler/${sonuc.gorev_id}`), 600);
    } catch (err) {
      setHata(err.message);
      setBaslatiliyor(false);
    }
  }

  const seciliEkipman = veri?.ekipmanlar.find((e) => e.ekipman_id === seciliEkipmanId);

  return (
    <>
      <Head>
        <title>Bakım Başlat — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <div className="icerik" style={{ maxWidth: "480px", margin: "60px auto" }}>
          {hata && <div className="hataKutusu">{hata}</div>}

          {!veri && !hata && <div className="yukleniyor">Yükleniyor…</div>}

          {veri && (
            <div className="yonetimFormu">
              <h2 style={{ marginTop: 0 }}>{veri.sablon.ad}</h2>
              <div className="gorevAlt" style={{ marginBottom: "16px" }}>
                {PERIYOT_ETIKETLERI[veri.sablon.periyot_tipi] || veri.sablon.periyot_tipi} · {veri.sablon.ekipman_tipi}
              </div>

              {veri.ekipmanlar.length === 0 && (
                <div className="bosDurum">Bu şablonun ekipman tipiyle eşleşen aktif bir ekipman yok.</div>
              )}

              {veri.ekipmanlar.length > 1 && !baslatildi && (
                <div className="alan">
                  <label>Hangi ekipman için başlatıyorsunuz?</label>
                  <select value={seciliEkipmanId} onChange={(e) => setSeciliEkipmanId(e.target.value)}>
                    <option value="">Seçin…</option>
                    {veri.ekipmanlar.map((e) => (
                      <option key={e.ekipman_id} value={e.ekipman_id}>
                        {e.ad}
                        {e.unite_no ? ` (${e.unite_no})` : ""} — {e.santral_adi}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {seciliEkipmanId && !baslatildi && (
                <>
                  <div style={{ fontSize: "16px", margin: "18px 0" }}>
                    <strong>{seciliEkipman?.ad}</strong>
                    {seciliEkipman?.unite_no ? ` (${seciliEkipman.unite_no})` : ""} — {seciliEkipman?.santral_adi}{" "}
                    için bu bakımı başlatmak istiyor musunuz?
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button className="birincilButon" onClick={baslat} disabled={baslatiliyor}>
                      {baslatiliyor ? "Başlatılıyor…" : "Evet, Başlat"}
                    </button>
                    <button
                      type="button"
                      className="kucukButon"
                      style={{ background: "var(--ink-soft)" }}
                      onClick={() => router.push("/gorevler")}
                      disabled={baslatiliyor}
                    >
                      Hayır
                    </button>
                  </div>
                </>
              )}

              {baslatildi && <div className="basariliKutu">Görev başlatıldı, açılıyor…</div>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
