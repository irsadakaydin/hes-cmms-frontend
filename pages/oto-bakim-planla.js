import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, yoneticiMi, platformAdminMi, kullaniciAl } from "../lib/api";
import UstBar from "../components/UstBar";

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
const PERIYOT_SIRASI = [
  "GUNLUK", "HAFTALIK", "AYLIK", "UC_AYLIK", "ALTI_AYLIK", "YILLIK",
  "IKI_YILLIK", "UC_YILLIK", "BES_YILLIK", "ON_YILLIK",
];
// Bu iki periyot için başlangıç tarihi otomatik hesaplanır (Pazartesi / ayın
// 1'i) — diğer tüm periyotlarda kullanıcı elle başlangıç+bitiş tarihi girer.
const OTOMATIK_TARIHLI_PERIYOTLAR = ["HAFTALIK", "AYLIK"];

function periyodaGoreGrupla(sablonlar) {
  const gruplar = new Map();
  for (const s of sablonlar) {
    if (!gruplar.has(s.periyot_tipi)) gruplar.set(s.periyot_tipi, []);
    gruplar.get(s.periyot_tipi).push(s);
  }
  return gruplar;
}

export default function OtoBakimPlanlaSayfasi() {
  const router = useRouter();
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;
  const kendiIsletmeId = typeof window !== "undefined" ? kullaniciAl()?.isletme_id : null;

  const [holdingler, setHoldingler] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
  const [sablonlar, setSablonlar] = useState(null);
  const [sahaPersoneli, setSahaPersoneli] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);

  const [acikPeriyot, setAcikPeriyot] = useState(null);
  const [seciliKisiler, setSeciliKisiler] = useState([]);
  const [elleBaslangic, setElleBaslangic] = useState("");
  const [elleBitis, setElleBitis] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!yoneticiMi()) {
      router.replace("/gorevler");
      return;
    }
    if (platformAdminMi()) {
      istekAt("/api/v1/isletmeler")
        .then((veri) => setHoldingler(veri.veri))
        .catch((err) => setHata(err.message));
    }
  }, [router]);

  const verileriGetir = useCallback(async () => {
    const hedefId = platformAdmin ? seciliHoldingId : kendiIsletmeId;
    if (!hedefId) return;
    setHata(null);
    try {
      const [sb, sp] = await Promise.all([
        istekAt(`/api/v1/bakim-sablonlari?hepsi=1&isletme_id=${hedefId}`),
        istekAt(`/api/v1/bakim-sablonlari/saha-personeli?isletme_id=${hedefId}`),
      ]);
      setSablonlar(sb.veri.filter((s) => s.aktif_mi));
      setSahaPersoneli(sp.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, [platformAdmin, seciliHoldingId, kendiIsletmeId]);

  useEffect(() => {
    verileriGetir();
  }, [verileriGetir]);

  function grubuAcKapa(periyot) {
    if (acikPeriyot === periyot) {
      setAcikPeriyot(null);
      return;
    }
    setAcikPeriyot(periyot);
    setSeciliKisiler([]);
    setElleBaslangic("");
    setElleBitis("");
    setBilgi(null);
    setHata(null);
  }

  function kisiSecimiDegistir(kisiId) {
    setSeciliKisiler((onceki) =>
      onceki.includes(kisiId) ? onceki.filter((id) => id !== kisiId) : [...onceki, kisiId]
    );
  }

  // Bir periyot grubundaki TÜM şablonları tek seferde, aynı personel/tarih
  // seçimiyle otomatik planlar — tek tek göndermeye gerek kalmaz.
  async function grubuOtomatikGonder(periyot, sablonListesi) {
    if (acikPeriyot !== periyot) {
      grubuAcKapa(periyot);
      return;
    }
    if (seciliKisiler.length === 0) {
      setHata("En az bir saha personeli seçmelisiniz.");
      return;
    }
    const otomatikTarihli = OTOMATIK_TARIHLI_PERIYOTLAR.includes(periyot);
    if (!otomatikTarihli && !elleBaslangic) {
      setHata("Bu periyot için Bakım Başlama Tarihi girmelisiniz.");
      return;
    }

    setGonderiliyor(true);
    setHata(null);
    setBilgi(null);
    let toplamOlusturulan = 0;
    const hatalar = [];

    for (const sablon of sablonListesi) {
      try {
        const sonuc = await istekAt(`/api/v1/bakim-sablonlari/${sablon.sablon_id}/oto-planla`, {
          method: "POST",
          body: JSON.stringify({
            sorumlu_kullanici_idleri: seciliKisiler,
            baslangic_tarihi: otomatikTarihli ? undefined : elleBaslangic,
            bitis_tarihi: otomatikTarihli ? undefined : elleBitis || undefined,
          }),
        });
        toplamOlusturulan += sonuc.olusturulan_sayisi || 0;
      } catch (err) {
        hatalar.push(`${sablon.ad}: ${err.message}`);
      }
    }

    setGonderiliyor(false);
    setAcikPeriyot(null);
    setBilgi(
      `${sablonListesi.length} şablon işlendi, toplam ${toplamOlusturulan} bakım planı oluşturuldu.` +
        (hatalar.length > 0 ? ` Sorun çıkan şablonlar: ${hatalar.join(" · ")}` : "")
    );
  }

  const gruplar = sablonlar ? periyodaGoreGrupla(sablonlar) : null;

  return (
    <>
      <Head>
        <title>Oto Bakım Planla — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Oto Bakım Planla</h2>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {platformAdmin && (
            <div className="alan" style={{ maxWidth: "340px" }}>
              <label>Holding</label>
              <select
                value={seciliHoldingId}
                onChange={(e) => {
                  setSeciliHoldingId(e.target.value);
                  setAcikPeriyot(null);
                }}
              >
                <option value="">Bir holding seçin…</option>
                {holdingler &&
                  holdingler.map((h) => (
                    <option key={h.isletme_id} value={h.isletme_id}>
                      {h.ad}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {platformAdmin && !seciliHoldingId && (
            <div className="bosDurum">Şablonları görmek için önce bir holding seçin.</div>
          )}

          {!sablonlar && (!platformAdmin || seciliHoldingId) && (
            <div className="yukleniyor">Yükleniyor…</div>
          )}

          {gruplar &&
            PERIYOT_SIRASI.filter((p) => gruplar.has(p)).map((periyot) => {
              const sablonListesi = gruplar.get(periyot);
              const acik = acikPeriyot === periyot;
              const otomatikTarihli = OTOMATIK_TARIHLI_PERIYOTLAR.includes(periyot);
              return (
                <div key={periyot} style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      type="button"
                      className="periyotGrupBasligi"
                      style={{ flex: 1, textAlign: "left" }}
                      onClick={() => grubuAcKapa(periyot)}
                    >
                      {acik ? "▾" : "▸"} {PERIYOT_ETIKETLERI[periyot]} Bakımlar ({sablonListesi.length})
                    </button>
                    <button
                      className="birincilButon"
                      style={{ width: "auto", padding: "9px 18px" }}
                      disabled={gonderiliyor}
                      onClick={() => grubuOtomatikGonder(periyot, sablonListesi)}
                    >
                      {gonderiliyor && acik ? "Gönderiliyor…" : "Otomatik Gönder"}
                    </button>
                  </div>

                  {acik && (
                    <div className="yonetimFormu" style={{ marginTop: "8px" }}>
                      {otomatikTarihli ? (
                        <div className="gorevAlt" style={{ marginBottom: "10px" }}>
                          {periyot === "HAFTALIK"
                            ? "Başlangıç tarihi otomatik: içinde bulunulan haftanın Pazartesi günü."
                            : "Başlangıç tarihi otomatik: içinde bulunulan ayın 1'i."}
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "12px" }}>
                          <div className="alan" style={{ flex: 1 }}>
                            <label>Bakım Başlama Tarihi</label>
                            <input
                              type="date"
                              value={elleBaslangic}
                              onChange={(e) => setElleBaslangic(e.target.value)}
                            />
                          </div>
                          <div className="alan" style={{ flex: 1 }}>
                            <label>Bakım Bitiş Tarihi (isteğe bağlı)</label>
                            <input
                              type="date"
                              value={elleBitis}
                              onChange={(e) => setElleBitis(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      <div className="alan">
                        <label>Görevlendirilecek saha personeli — birden fazla seçebilirsiniz</label>
                        <div className="aliciListesi">
                          {sahaPersoneli &&
                            sahaPersoneli.map((k) => (
                              <label key={k.kullanici_id} className="aliciSatiri">
                                <input
                                  type="checkbox"
                                  checked={seciliKisiler.includes(k.kullanici_id)}
                                  onChange={() => kisiSecimiDegistir(k.kullanici_id)}
                                />
                                {k.ad_soyad}
                              </label>
                            ))}
                          {sahaPersoneli && sahaPersoneli.length === 0 && (
                            <div className="gorevAlt">Bu holdingde tanımlı saha personeli yok.</div>
                          )}
                        </div>
                      </div>

                      <div className="gorevAlt" style={{ marginBottom: "4px" }}>
                        Bu grupta gönderilecek şablonlar:
                      </div>
                      {sablonListesi.map((s) => (
                        <div className="gorevAlt" key={s.sablon_id}>
                          · {s.ad} ({s.ekipman_tipi}
                          {s.santral_adi ? ` — yalnızca ${s.santral_adi}` : " — holding geneli"})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
