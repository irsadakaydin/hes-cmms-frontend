import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, yoneticiMi, platformAdminMi } from "../lib/api";
import UstBar from "../components/UstBar";

const PERIYOT_ETIKETLERI = {
  GUNLUK: "Günlük",
  HAFTALIK: "Haftalık",
  AYLIK: "Aylık",
  UC_AYLIK: "3 Ayda Bir",
  ALTI_AYLIK: "6 Ayda Bir",
  YILLIK: "Yıllık",
};

function bosForm() {
  return {
    santral_id: "",
    ekipman_id: "",
    sablon_id: "",
    periyot: "AYLIK",
    baslangic_tarihi: "",
    sorumlu_kullanici_idleri: [],
  };
}

export default function BakimPlaniOlusturSayfasi() {
  const router = useRouter();
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;

  const [santraller, setSantraller] = useState(null);
  const [holdingler, setHoldingler] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
  const [ekipmanlar, setEkipmanlar] = useState(null);
  const [sablonlar, setSablonlar] = useState(null);
  const [atanabilirKullanicilar, setAtanabilirKullanicilar] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [taslak, setTaslak] = useState(bosForm());

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!yoneticiMi()) {
      router.replace("/gorevler");
      return;
    }
    const istekler = [istekAt("/api/v1/santraller")];
    if (platformAdminMi()) istekler.push(istekAt("/api/v1/isletmeler"));
    Promise.all(istekler)
      .then(([s, h]) => {
        setSantraller(s.veri);
        if (h) setHoldingler(h.veri);
      })
      .catch((err) => setHata(err.message));
  }, [router]);

  const santralSecildi = useCallback(
    async (santral_id) => {
      setTaslak((t) => ({ ...bosForm(), santral_id }));
      setEkipmanlar(null);
      setSablonlar(null);
      setAtanabilirKullanicilar(null);
      if (!santral_id) return;

      try {
        const santral = santraller.find((s) => s.santral_id === santral_id);
        const [e, sb, ak] = await Promise.all([
          istekAt(`/api/v1/santraller/${santral_id}/ekipmanlar`),
          istekAt(`/api/v1/bakim-sablonlari?isletme_id=${santral.isletme_id}&santral_id=${santral_id}`),
          istekAt(`/api/v1/santraller/${santral_id}/atanabilir-kullanicilar`),
        ]);
        setEkipmanlar(e.veri);
        setSablonlar(sb.veri);
        setAtanabilirKullanicilar(ak.veri);
      } catch (err) {
        setHata(err.message);
      }
    },
    [santraller]
  );

  function sorumluSecimiDegistir(kullaniciId) {
    setTaslak((t) => ({
      ...t,
      sorumlu_kullanici_idleri: t.sorumlu_kullanici_idleri.includes(kullaniciId)
        ? t.sorumlu_kullanici_idleri.filter((id) => id !== kullaniciId)
        : [...t.sorumlu_kullanici_idleri, kullaniciId],
    }));
  }

  async function planEkle(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    if (taslak.sorumlu_kullanici_idleri.length === 0) {
      setHata("En az bir sorumlu kullanıcı seçmelisiniz.");
      return;
    }
    setGonderiliyor(true);
    try {
      const { santral_id, ...gonderilecek } = taslak;
      await istekAt(`/api/v1/santraller/${santral_id}/bakim-planlari`, {
        method: "POST",
        body: JSON.stringify(gonderilecek),
      });
      setBilgi("Bakım planı oluşturuldu.");
      setTaslak({ ...bosForm(), santral_id });
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  const gosterilecekSantraller = platformAdmin
    ? (santraller || []).filter((s) => s.isletme_id === seciliHoldingId)
    : santraller;

  return (
    <>
      <Head>
        <title>Bakım Planı Oluştur — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Bakım Planı Oluştur</h2>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}
          {!santraller && !hata && <div className="yukleniyor">Yükleniyor…</div>}

          {santraller && (
            <form onSubmit={planEkle} className="yonetimFormu">
              {platformAdmin && (
                <div className="alan">
                  <label>Holding</label>
                  <select
                    required
                    value={seciliHoldingId}
                    onChange={(e) => {
                      setSeciliHoldingId(e.target.value);
                      santralSecildi("");
                    }}
                  >
                    <option value="">Seçin…</option>
                    {holdingler &&
                      holdingler.map((h) => (
                        <option key={h.isletme_id} value={h.isletme_id}>
                          {h.ad}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {(!platformAdmin || seciliHoldingId) && (
                <div className="alan">
                  <label>Santral</label>
                  <select required value={taslak.santral_id} onChange={(e) => santralSecildi(e.target.value)}>
                    <option value="">Seçin…</option>
                    {gosterilecekSantraller &&
                      gosterilecekSantraller.map((s) => (
                        <option key={s.santral_id} value={s.santral_id}>
                          {s.ad} {s.isletme_adi ? `(${s.isletme_adi})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {taslak.santral_id && (
                <>
                  <div className="alan">
                    <label>Ekipman</label>
                    <select
                      required
                      value={taslak.ekipman_id}
                      onChange={(e) => setTaslak({ ...taslak, ekipman_id: e.target.value })}
                    >
                      <option value="">Seçin…</option>
                      {ekipmanlar &&
                        ekipmanlar.map((ek) => (
                          <option key={ek.ekipman_id} value={ek.ekipman_id}>
                            {ek.ad} ({ek.tip})
                          </option>
                        ))}
                    </select>
                    {ekipmanlar && ekipmanlar.length === 0 && (
                      <div className="kutuphaneBosUyari">
                        Bu santralde henüz ekipman yok — önce{" "}
                        <a href="/ekipman-olustur">Ekipman Oluştur</a>'dan ekleyin.
                      </div>
                    )}
                  </div>

                  <div className="alan">
                    <label>Bakım şablonu</label>
                    <select
                      required
                      value={taslak.sablon_id}
                      onChange={(e) => setTaslak({ ...taslak, sablon_id: e.target.value })}
                    >
                      <option value="">Seçin…</option>
                      {sablonlar &&
                        sablonlar.map((sb) => (
                          <option key={sb.sablon_id} value={sb.sablon_id}>
                            {sb.ad} ({sb.ekipman_tipi})
                          </option>
                        ))}
                    </select>
                    {sablonlar && sablonlar.length === 0 && (
                      <div className="kutuphaneBosUyari">
                        Bu holdingde henüz bakım şablonu yok —{" "}
                        <a href="/sablonlar">Bakım Şablonları</a>'ndan ekleyin.
                      </div>
                    )}
                  </div>

                  <div className="alan">
                    <label>Periyot</label>
                    <select value={taslak.periyot} onChange={(e) => setTaslak({ ...taslak, periyot: e.target.value })}>
                      {Object.entries(PERIYOT_ETIKETLERI).map(([deger, etiket]) => (
                        <option key={deger} value={deger}>
                          {etiket}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="alan">
                    <label>Başlangıç tarihi</label>
                    <input
                      required
                      type="date"
                      value={taslak.baslangic_tarihi}
                      onChange={(e) => setTaslak({ ...taslak, baslangic_tarihi: e.target.value })}
                    />
                  </div>

                  <div className="alan">
                    <label>Sorumlu kullanıcı(lar) — birden fazla seçebilirsiniz</label>
                    <div className="aliciListesi">
                      {atanabilirKullanicilar &&
                        atanabilirKullanicilar.map((k) => (
                          <label key={k.kullanici_id} className="aliciSatiri">
                            <input
                              type="checkbox"
                              checked={taslak.sorumlu_kullanici_idleri.includes(k.kullanici_id)}
                              onChange={() => sorumluSecimiDegistir(k.kullanici_id)}
                            />
                            {k.ad_soyad}
                          </label>
                        ))}
                    </div>
                  </div>

                  <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                    {gonderiliyor ? "Oluşturuluyor…" : "Planı Oluştur"}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </>
  );
}
