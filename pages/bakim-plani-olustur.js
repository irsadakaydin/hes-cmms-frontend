import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, yoneticiMi, platformAdminMi } from "../lib/api";
import UstBar from "../components/UstBar";
import KlasorGezgini from "../components/KlasorGezgini";

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
  const [tumSablonlar, setTumSablonlar] = useState(null);
  const [atanabilirKullanicilar, setAtanabilirKullanicilar] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [taslak, setTaslak] = useState(bosForm());

  // Yeni akış: klasör ağacından seçim (varsayılan) — ağaç yoksa/istenirse
  // eski elle seçim yöntemine geçilebilir.
  const [secimModu, setSecimModu] = useState("klasor"); // "klasor" | "elle"
  const [klasorYolu, setKlasorYolu] = useState("");
  const [klasorEkipmanlari, setKlasorEkipmanlari] = useState(null);
  const [klasorSablonlari, setKlasorSablonlari] = useState(null);

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
      setTumSablonlar(null);
      setAtanabilirKullanicilar(null);
      setKlasorYolu("");
      setKlasorEkipmanlari(null);
      setKlasorSablonlari(null);
      if (!santral_id) return;

      try {
        const santral = santraller.find((s) => s.santral_id === santral_id);
        const [e, sb, ak] = await Promise.all([
          istekAt(`/api/v1/santraller/${santral_id}/ekipmanlar`),
          istekAt(`/api/v1/bakim-sablonlari?isletme_id=${santral.isletme_id}&santral_id=${santral_id}`),
          istekAt(`/api/v1/santraller/${santral_id}/atanabilir-kullanicilar`),
        ]);
        setEkipmanlar(e.veri);
        setTumSablonlar(sb.veri);
        setAtanabilirKullanicilar(ak.veri);
      } catch (err) {
        setHata(err.message);
      }
    },
    [santraller]
  );

  // Klasör ağacından bir PERİYOT YAPRAĞI seçildiğinde: o yaprağın üst
  // düğümüne (ekipman düğümü) bağlı ekipmanları ve o yaprağa yüklenmiş
  // şablon(lar)ı getirir — eşleşme artık kimlik (ID) bazlı, hatasız.
  async function klasorSecildi(k) {
    setHata(null);
    try {
      const yol = await istekAt(`/api/v1/klasorler/${k.klasor_id}/yol`);
      setKlasorYolu(yol.veri.map((y) => y.ad).join(" > "));
      const ustDugum = yol.veri[yol.veri.length - 2]; // yaprağın hemen üstü = ekipman düğümü
      const [ekipmanSonuc, sablonSonuc] = await Promise.all([
        ustDugum ? istekAt(`/api/v1/klasorler/${ustDugum.klasor_id}/ekipmanlar`) : Promise.resolve({ veri: [] }),
        istekAt(`/api/v1/bakim-sablonlari?klasor_id=${k.klasor_id}&isletme_id=${taslak.isletme_id || ""}`),
      ]);
      setKlasorEkipmanlari(ekipmanSonuc.veri);
      setKlasorSablonlari(sablonSonuc.veri.filter((s) => s.aktif_mi));
      setTaslak((t) => ({
        ...t,
        periyot: k.periyot_tipi,
        sablon_id: sablonSonuc.veri.length === 1 ? sablonSonuc.veri[0].sablon_id : "",
        ekipman_id: ekipmanSonuc.veri.length === 1 ? ekipmanSonuc.veri[0].ekipman_id : "",
      }));
    } catch (err) {
      setHata(err.message);
    }
  }

  // ESKİ AKIŞ (elle seçim) — klasör ağacı henüz kurulmamış santraller için
  // yedek yöntem. Seçilen ekipmanın tipine göre şablon listesini süzer.
  const seciliEkipman = (ekipmanlar || []).find((ek) => ek.ekipman_id === taslak.ekipman_id);
  const gosterilecekSablonlar = (tumSablonlar || []).filter((sb) => {
    if (seciliEkipman && sb.ekipman_tipi !== seciliEkipman.tip) return false;
    return true;
  });

  function ekipmanSecildi(ekipmanId) {
    setTaslak((t) => ({ ...t, ekipman_id: ekipmanId, sablon_id: "" }));
  }
  function sablonSecildi(sablonId) {
    const sb = (tumSablonlar || []).find((s) => s.sablon_id === sablonId);
    setTaslak((t) => ({ ...t, sablon_id: sablonId, periyot: sb ? sb.periyot_tipi : t.periyot }));
  }

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
      setKlasorYolu("");
      setKlasorEkipmanlari(null);
      setKlasorSablonlari(null);
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
                  <div style={{ marginBottom: "10px" }}>
                    <button
                      type="button"
                      className="linkButon"
                      onClick={() => setSecimModu(secimModu === "klasor" ? "elle" : "klasor")}
                    >
                      {secimModu === "klasor"
                        ? "Klasör ağacı yerine elle seçmek istiyorum →"
                        : "← Klasör ağacından seçmek istiyorum"}
                    </button>
                  </div>

                  {secimModu === "klasor" ? (
                    <>
                      <div className="alan">
                        <label>
                          Klasör konumu — bakımı yapılacak periyot yaprağını seçin.
                          {klasorYolu && <strong> Seçili: {klasorYolu}</strong>}
                        </label>
                        <KlasorGezgini santralId={taslak.santral_id} mod="sablon" onSecim={klasorSecildi} />
                      </div>

                      {klasorYolu && (
                        <>
                          <div className="alan">
                            <label>Ekipman — bu klasöre bağlı ekipmanlardan seçin</label>
                            <select
                              required
                              value={taslak.ekipman_id}
                              onChange={(e) => setTaslak({ ...taslak, ekipman_id: e.target.value })}
                            >
                              <option value="">Seçin…</option>
                              {(klasorEkipmanlari || []).map((ek) => (
                                <option key={ek.ekipman_id} value={ek.ekipman_id}>
                                  {ek.ad} ({ek.tip})
                                </option>
                              ))}
                            </select>
                            {klasorEkipmanlari && klasorEkipmanlari.length === 0 && (
                              <div className="kutuphaneBosUyari">
                                Bu klasör konumuna bağlı ekipman yok — önce{" "}
                                <a href="/ekipman-olustur">Ekipman Oluştur</a>'dan, bu klasörü seçerek ekleyin.
                              </div>
                            )}
                          </div>
                          <div className="alan">
                            <label>Bakım şablonu — bu klasöre yüklenmiş şablon(lar)</label>
                            <select
                              required
                              value={taslak.sablon_id}
                              onChange={(e) => setTaslak({ ...taslak, sablon_id: e.target.value })}
                            >
                              <option value="">Seçin…</option>
                              {(klasorSablonlari || []).map((sb) => (
                                <option key={sb.sablon_id} value={sb.sablon_id}>
                                  {sb.ad}
                                </option>
                              ))}
                            </select>
                            {klasorSablonlari && klasorSablonlari.length === 0 && (
                              <div className="kutuphaneBosUyari">
                                Bu klasöre henüz şablon yüklenmemiş —{" "}
                                <a href="/sablonlar">Bakım Şablonları</a>'ndan bu klasörü seçerek yükleyin.
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="alan">
                        <label>Ekipman</label>
                        <select required value={taslak.ekipman_id} onChange={(e) => ekipmanSecildi(e.target.value)}>
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
                        <label>Bakım şablonu — seçilen ekipman tipine göre süzülür</label>
                        <select required value={taslak.sablon_id} onChange={(e) => sablonSecildi(e.target.value)}>
                          <option value="">Seçin…</option>
                          {gosterilecekSablonlar.map((sb) => (
                            <option key={sb.sablon_id} value={sb.sablon_id}>
                              {sb.ad} ({PERIYOT_ETIKETLERI[sb.periyot_tipi] || sb.periyot_tipi})
                            </option>
                          ))}
                        </select>
                        {taslak.ekipman_id && gosterilecekSablonlar.length === 0 && (
                          <div className="kutuphaneBosUyari">
                            Bu ekipman tipi için henüz bir bakım şablonu yok —{" "}
                            <a href="/sablonlar">Bakım Şablonları</a>'ndan ekleyin.
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="alan">
                    <label>Periyot — seçtiğiniz şablona göre otomatik dolar</label>
                    <select value={taslak.periyot} disabled>
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
