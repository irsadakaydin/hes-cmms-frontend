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

function bosSablonDurumu() {
  return { acik: false, seciliKisiler: [], baslangic: "", bitis: "" };
}

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

  const [santraller, setSantraller] = useState(null);
  const [holdingler, setHoldingler] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
  const [seciliSantralId, setSeciliSantralId] = useState("");
  const [sablonlar, setSablonlar] = useState(null);
  const [sahaPersoneli, setSahaPersoneli] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [acikGrup, setAcikGrup] = useState(null);
  const [sablonDurumlari, setSablonDurumlari] = useState({}); // sablon_id -> {acik, seciliKisiler, baslangic, bitis}
  const [gonderiliyorGrup, setGonderiliyorGrup] = useState(null);

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

  const verileriGetir = useCallback(async () => {
    if (!seciliSantralId) return;
    setHata(null);
    try {
      const santral = santraller.find((s) => s.santral_id === seciliSantralId);
      const [sb, sp] = await Promise.all([
        istekAt(`/api/v1/bakim-sablonlari?hepsi=1&isletme_id=${santral.isletme_id}&santral_id=${seciliSantralId}`),
        istekAt(`/api/v1/bakim-sablonlari/saha-personeli?santral_id=${seciliSantralId}`),
      ]);
      setSablonlar(sb.veri.filter((s) => s.aktif_mi));
      setSahaPersoneli(sp.veri);
      setSablonDurumlari({});
      setAcikGrup(null);
    } catch (err) {
      setHata(err.message);
    }
  }, [seciliSantralId, santraller]);

  useEffect(() => {
    verileriGetir();
  }, [verileriGetir]);

  function sablonPaneliAcKapa(sablonId) {
    setSablonDurumlari((onceki) => {
      const mevcut = onceki[sablonId] || bosSablonDurumu();
      return { ...onceki, [sablonId]: { ...mevcut, acik: !mevcut.acik } };
    });
  }

  function sablonKisiSecimiDegistir(sablonId, kisiId) {
    setSablonDurumlari((onceki) => {
      const mevcut = onceki[sablonId] || bosSablonDurumu();
      const kisiler = mevcut.seciliKisiler.includes(kisiId)
        ? mevcut.seciliKisiler.filter((id) => id !== kisiId)
        : [...mevcut.seciliKisiler, kisiId];
      return { ...onceki, [sablonId]: { ...mevcut, seciliKisiler: kisiler } };
    });
  }

  function sablonTarihGuncelle(sablonId, alan, deger) {
    setSablonDurumlari((onceki) => {
      const mevcut = onceki[sablonId] || bosSablonDurumu();
      return { ...onceki, [sablonId]: { ...mevcut, [alan]: deger } };
    });
  }

  // Bir periyot grubundaki TÜM şablonları gönderir — her şablon KENDİ seçili
  // personelini ve (varsa) kendi başlangıç/bitiş tarihini kullanır.
  async function grubuGonder(periyot, sablonListesi) {
    for (const s of sablonListesi) {
      const durum = sablonDurumlari[s.sablon_id];
      if (!durum || durum.seciliKisiler.length === 0) {
        setHata(`"${s.ad}" için en az bir saha personeli seçmelisiniz.`);
        return;
      }
      if (!OTOMATIK_TARIHLI_PERIYOTLAR.includes(periyot) && !durum.baslangic) {
        setHata(`"${s.ad}" için Bakım Başlama Tarihi girmelisiniz.`);
        return;
      }
    }

    setGonderiliyorGrup(periyot);
    setHata(null);
    setBilgi(null);
    let toplamOlusturulan = 0;
    const hatalar = [];

    for (const s of sablonListesi) {
      const durum = sablonDurumlari[s.sablon_id];
      const govde = {
        santral_id: seciliSantralId,
        sorumlu_kullanici_idleri: durum.seciliKisiler,
        baslangic_tarihi: OTOMATIK_TARIHLI_PERIYOTLAR.includes(periyot) ? undefined : durum.baslangic,
        bitis_tarihi: OTOMATIK_TARIHLI_PERIYOTLAR.includes(periyot) ? undefined : durum.bitis || undefined,
      };
      try {
        const sonuc = await istekAt(`/api/v1/bakim-sablonlari/${s.sablon_id}/oto-planla`, {
          method: "POST",
          body: JSON.stringify(govde),
        });
        toplamOlusturulan += sonuc.olusturulan_sayisi || 0;
        if (!sonuc.olusturulan_sayisi) {
          hatalar.push(sonuc.mesaj);
        }
      } catch (err) {
        if (err.hata_kodu === "MUKERRER_TESPIT_EDILDI") {
          const tekrarGonderilsinMi = confirm(
            `"${s.ad}" daha önce gönderilmiştir. Tekrar göndermek istiyor musunuz?`
          );
          if (tekrarGonderilsinMi) {
            try {
              const zorlaSonuc = await istekAt(`/api/v1/bakim-sablonlari/${s.sablon_id}/oto-planla`, {
                method: "POST",
                body: JSON.stringify({ ...govde, zorla: true }),
              });
              toplamOlusturulan += zorlaSonuc.olusturulan_sayisi || 0;
            } catch (zorlaErr) {
              hatalar.push(`${s.ad}: ${zorlaErr.message}`);
            }
          } else {
            alert(`"${s.ad}" Bu Bakım Planı Oluşturulmadı`);
          }
        } else {
          hatalar.push(`${s.ad}: ${err.message}`);
        }
      }
    }

    setGonderiliyorGrup(null);
    setAcikGrup(null);
    setBilgi(
      `${sablonListesi.length} şablon işlendi, toplam ${toplamOlusturulan} bakım planı oluşturuldu.` +
        (hatalar.length > 0 ? ` Sorun çıkan şablonlar: ${hatalar.join(" · ")}` : "")
    );
  }

  const gosterilecekSantraller = platformAdmin
    ? (santraller || []).filter((s) => s.isletme_id === seciliHoldingId)
    : santraller;
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
          {!santraller && !hata && <div className="yukleniyor">Yükleniyor…</div>}

          {santraller && (
            <div className="yonetimFormu">
              {platformAdmin && (
                <div className="alan">
                  <label>Holding</label>
                  <select
                    value={seciliHoldingId}
                    onChange={(e) => {
                      setSeciliHoldingId(e.target.value);
                      setSeciliSantralId("");
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

              {(!platformAdmin || seciliHoldingId) && (
                <div className="alan">
                  <label>Santral</label>
                  <select value={seciliSantralId} onChange={(e) => setSeciliSantralId(e.target.value)}>
                    <option value="">Bir santral seçin…</option>
                    {gosterilecekSantraller &&
                      gosterilecekSantraller.map((s) => (
                        <option key={s.santral_id} value={s.santral_id}>
                          {s.ad}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {platformAdmin && !seciliHoldingId && (
            <div className="bosDurum">Devam etmek için önce bir holding seçin.</div>
          )}
          {(!platformAdmin || seciliHoldingId) && !seciliSantralId && (
            <div className="bosDurum">Şablonları görmek için bir santral seçin.</div>
          )}

          {seciliSantralId && !sablonlar && <div className="yukleniyor">Yükleniyor…</div>}

          {gruplar &&
            PERIYOT_SIRASI.filter((p) => gruplar.has(p)).map((periyot) => {
              const sablonListesi = gruplar.get(periyot);
              const acik = acikGrup === periyot;
              const otomatikTarihli = OTOMATIK_TARIHLI_PERIYOTLAR.includes(periyot);
              return (
                <div key={periyot} style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      type="button"
                      className="periyotGrupBasligi"
                      style={{ flex: 1, textAlign: "left" }}
                      onClick={() => setAcikGrup(acik ? null : periyot)}
                    >
                      {acik ? "▾" : "▸"} {PERIYOT_ETIKETLERI[periyot]} Bakımlar ({sablonListesi.length})
                    </button>
                    <button
                      className="birincilButon"
                      style={{ width: "auto", padding: "9px 18px" }}
                      disabled={gonderiliyorGrup !== null}
                      onClick={() => (acik ? grubuGonder(periyot, sablonListesi) : setAcikGrup(periyot))}
                    >
                      {gonderiliyorGrup === periyot ? "Gönderiliyor…" : "Otomatik Gönder"}
                    </button>
                  </div>

                  {acik && (
                    <div style={{ marginTop: "8px" }}>
                      {sablonListesi.map((s) => {
                        const durum = sablonDurumlari[s.sablon_id] || bosSablonDurumu();
                        return (
                          <div className="satirKart" key={s.sablon_id}>
                            <div>
                              <strong>{s.ad}</strong>
                            </div>
                            <div className="gorevAlt">
                              {s.ekipman_tipi}
                              {s.santral_adi ? ` · yalnızca ${s.santral_adi}` : ""}
                            </div>

                            <button
                              type="button"
                              className="linkButon"
                              onClick={() => sablonPaneliAcKapa(s.sablon_id)}
                            >
                              {durum.acik ? "▾" : "▸"} Görevlendirilecek personel
                              {durum.seciliKisiler.length > 0 ? ` (${durum.seciliKisiler.length} seçili)` : ""}
                            </button>

                            {durum.acik && (
                              <div style={{ marginTop: "8px" }}>
                                {!otomatikTarihli && (
                                  <div style={{ display: "flex", gap: "12px", marginBottom: "10px" }}>
                                    <div className="alan" style={{ flex: 1 }}>
                                      <label>Bakım Başlama Tarihi</label>
                                      <input
                                        type="date"
                                        value={durum.baslangic}
                                        onChange={(e) =>
                                          sablonTarihGuncelle(s.sablon_id, "baslangic", e.target.value)
                                        }
                                      />
                                    </div>
                                    <div className="alan" style={{ flex: 1 }}>
                                      <label>Bakım Bitiş Tarihi (isteğe bağlı)</label>
                                      <input
                                        type="date"
                                        value={durum.bitis}
                                        onChange={(e) => sablonTarihGuncelle(s.sablon_id, "bitis", e.target.value)}
                                      />
                                    </div>
                                  </div>
                                )}
                                <div className="aliciListesi">
                                  {sahaPersoneli &&
                                    sahaPersoneli.map((k) => (
                                      <label key={k.kullanici_id} className="aliciSatiri">
                                        <input
                                          type="checkbox"
                                          checked={durum.seciliKisiler.includes(k.kullanici_id)}
                                          onChange={() => sablonKisiSecimiDegistir(s.sablon_id, k.kullanici_id)}
                                        />
                                        {k.ad_soyad}
                                      </label>
                                    ))}
                                  {sahaPersoneli && sahaPersoneli.length === 0 && (
                                    <div className="gorevAlt">Bu santrale erişimi olan saha personeli yok.</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
