import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { istekAt, tokenAl } from "../../lib/api";
import UstBar from "../../components/UstBar";

export default function GorevDetaySayfasi() {
  const router = useRouter();
  const { id } = router.query;

  const [gorev, setGorev] = useState(null);
  const [hata, setHata] = useState(null);
  const [cevaplar, setCevaplar] = useState({});
  const [notlar, setNotlar] = useState("");
  const [imza, setImza] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [basarili, setBasarili] = useState(false);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!id) return;

    istekAt(`/api/v1/gorevler/${id}`)
      .then((veri) => setGorev(veri))
      .catch((err) => setHata(err.message));
  }, [id, router]);

  function cevapGuncelle(kalemId, alan, deger) {
    setCevaplar((onceki) => ({
      ...onceki,
      [kalemId]: { ...onceki[kalemId], [alan]: deger },
    }));
  }

  function kabulDurumu(kalem, deger) {
    if (!kalem.kabul_araligi || deger === "" || deger === undefined) return undefined;
    const sayi = Number(deger);
    const [min, max] = kalem.kabul_araligi;
    return sayi >= min && sayi <= max ? "uygun" : "uygun_degil";
  }

  async function formuGonder(e) {
    e.preventDefault();
    setHata(null);

    if (!imza.trim()) {
      setHata("Onaylamak için ad soyadınızı imza alanına yazmanız gerekiyor.");
      return;
    }

    const kalemler = gorev.checklist_json?.kalemler || [];
    const eksikZorunlu = kalemler.find(
      (k) => k.zorunlu !== false && (cevaplar[k.id]?.deger === undefined || cevaplar[k.id]?.deger === "")
    );
    if (eksikZorunlu) {
      setHata(`"${eksikZorunlu.soru}" alanı doldurulmadan kayıt tamamlanamaz.`);
      return;
    }

    setGonderiliyor(true);
    try {
      await istekAt(`/api/v1/gorevler/${id}/kaydi-tamamla`, {
        method: "POST",
        body: JSON.stringify({
          checklist_sonuclari: cevaplar,
          notlar: notlar || null,
          fotograf_urlleri: [],
          // NOT: Bu MVP'de gerçek bir imza/çizim bileşeni yok — yazılan ad-soyad
          // metni onay olarak kaydediliyor. İleride buraya gerçek bir imza
          // yakalama (canvas) veya dosya yükleme bileşeni eklenebilir.
          imza_url: `yazili-onay:${imza.trim()}`,
        }),
      });
      setBasarili(true);
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  if (hata && !gorev) {
    return (
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="hataKutusu">{hata}</div>
        </div>
      </div>
    );
  }

  if (!gorev) {
    return (
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="yukleniyor">Yükleniyor…</div>
        </div>
      </div>
    );
  }

  const kalemler = gorev.checklist_json?.kalemler || [];
  const tamamlanmisMi = gorev.durum === "TAMAMLANDI" || basarili;

  return (
    <>
      <Head>
        <title>{gorev.sablon_adi} — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <Link href="/gorevler" className="geriLink">
            ← Görev listesine dön
          </Link>

          <div className="detayUst">
            <h2>{gorev.sablon_adi}</h2>
            <div className="detayAlt">
              {gorev.santral_adi} — {gorev.ekipman_adi}
            </div>
          </div>

          {tamamlanmisMi ? (
            <div className="basariliKutu">
              Bu bakım kaydı tamamlandı ve kilitlendi — artık değiştirilemez.
            </div>
          ) : (
            <form onSubmit={formuGonder}>
              {hata && <div className="hataKutusu">{hata}</div>}

              {kalemler.map((kalem) => (
                <div className="kalem" key={kalem.id}>
                  <div className="kalemSoru">
                    {kalem.soru}
                    {kalem.zorunlu === false ? " (isteğe bağlı)" : ""}
                  </div>

                  {kalem.tip === "evet_hayir" && (
                    <div className="evetHayirGrup">
                      <button
                        type="button"
                        className={cevaplar[kalem.id]?.deger === true ? "secili-evet" : ""}
                        onClick={() => cevapGuncelle(kalem.id, "deger", true)}
                      >
                        Evet
                      </button>
                      <button
                        type="button"
                        className={cevaplar[kalem.id]?.deger === false ? "secili-hayir" : ""}
                        onClick={() => cevapGuncelle(kalem.id, "deger", false)}
                      >
                        Hayır
                      </button>
                    </div>
                  )}

                  {kalem.tip === "olcum" && (
                    <div className="olcumSatiri">
                      <input
                        type="number"
                        step="any"
                        value={cevaplar[kalem.id]?.deger ?? ""}
                        onChange={(e) => {
                          const deger = e.target.value;
                          cevapGuncelle(kalem.id, "deger", deger === "" ? "" : Number(deger));
                          cevapGuncelle(kalem.id, "durum", kabulDurumu(kalem, deger));
                        }}
                      />
                      {kalem.birim && <span className="olcumBirim">{kalem.birim}</span>}
                      {kalem.kabul_araligi && (
                        <span className="olcumBirim">
                          (kabul aralığı: {kalem.kabul_araligi[0]}–{kalem.kabul_araligi[1]})
                        </span>
                      )}
                    </div>
                  )}

                  {kalem.tip === "metin" && (
                    <textarea
                      value={cevaplar[kalem.id]?.deger ?? ""}
                      onChange={(e) => cevapGuncelle(kalem.id, "deger", e.target.value)}
                    />
                  )}
                </div>
              ))}

              <div className="kalem">
                <div className="kalemSoru">Genel not (isteğe bağlı)</div>
                <textarea value={notlar} onChange={(e) => setNotlar(e.target.value)} />
              </div>

              <div className="kalem">
                <div className="kalemSoru">Onay — ad soyadınızı yazın</div>
                <input
                  type="text"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    border: "1px solid var(--line-strong)",
                    fontFamily: "var(--font-body)",
                    fontSize: "14px",
                  }}
                  value={imza}
                  onChange={(e) => setImza(e.target.value)}
                  placeholder="Ör. Ayşe Kara"
                />
              </div>

              <button className="tamamlaButon" type="submit" disabled={gonderiliyor}>
                {gonderiliyor ? "Kaydediliyor…" : "Bakımı Tamamla"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
