import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, yoneticiMi, kullaniciAl } from "../lib/api";
import { excelDenSablonCikar } from "../lib/excelSablonImport";
import UstBar from "../components/UstBar";

const PERIYOT_ETIKETLERI = {
  GUNLUK: "Günlük",
  HAFTALIK: "Haftalık",
  AYLIK: "Aylık",
  UC_AYLIK: "3 Ayda Bir",
  ALTI_AYLIK: "6 Ayda Bir",
  YILLIK: "Yıllık",
};
const PERIYOT_SIRASI = ["GUNLUK", "HAFTALIK", "AYLIK", "UC_AYLIK", "ALTI_AYLIK", "YILLIK"];

const TIP_ETIKETLERI = {
  evet_hayir: "Evet / Hayır",
  olcum: "Ölçüm (sayı)",
  metin: "Serbest metin",
};

function bosSablon(varsayilanIsletmeId, varsayilanSantralId) {
  return {
    ad: "",
    ekipman_tipi: "",
    periyot_tipi: "AYLIK",
    kalemler: [],
    isletme_id: varsayilanIsletmeId,
    santral_id: varsayilanSantralId || "",
  };
}

function bosKalem(sira) {
  return { id: `k${sira}`, soru: "", tip: "evet_hayir", birim: "", zorunlu: true };
}

/** Şablonları önce santral (ya da "Genel"), sonra periyot bazında gruplar. */
function santralVePeriyodaGoreGrupla(sablonlar) {
  const santralGruplari = new Map();
  for (const s of sablonlar) {
    const anahtar = s.santral_id || "__genel__";
    if (!santralGruplari.has(anahtar)) {
      santralGruplari.set(anahtar, { santral_id: s.santral_id, santral_adi: s.santral_adi, periyotlar: new Map() });
    }
    const grup = santralGruplari.get(anahtar);
    if (!grup.periyotlar.has(s.periyot_tipi)) {
      grup.periyotlar.set(s.periyot_tipi, []);
    }
    grup.periyotlar.get(s.periyot_tipi).push(s);
  }
  // Genel (santral_id yok) grubu her zaman başta, diğerleri isme göre sıralı
  const sonuc = [...santralGruplari.values()].sort((a, b) => {
    if (!a.santral_id) return -1;
    if (!b.santral_id) return 1;
    return (a.santral_adi || "").localeCompare(b.santral_adi || "");
  });
  return sonuc;
}

export default function SablonlarSayfasi() {
  const router = useRouter();
  const dosyaInputRef = useRef(null);
  const kendiIsletmeId = typeof window !== "undefined" ? kullaniciAl()?.isletme_id : null;
  const platformAdminMi = typeof window !== "undefined" && kullaniciAl()?.rol === "ADMIN";

  const [sablonlar, setSablonlar] = useState(null);
  const [isletmeler, setIsletmeler] = useState(null);
  const [tumSantraller, setTumSantraller] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState(kendiIsletmeId || "");
  const [digerHoldingSablonlari, setDigerHoldingSablonlari] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [acikGruplar, setAcikGruplar] = useState({}); // "santralAnahtari|periyot" -> bool
  const [kopyaAcikSablonId, setKopyaAcikSablonId] = useState(null);
  const [kopyaHedefHoldingId, setKopyaHedefHoldingId] = useState("");

  const [formuAcik, setFormuAcik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [taslak, setTaslak] = useState(bosSablon(kendiIsletmeId));
  const [duzenlenenSablonId, setDuzenlenenSablonId] = useState(null);

  const verileriYukle = useCallback(async () => {
    try {
      const istekler = [istekAt("/api/v1/santraller")];
      if (platformAdminMi) istekler.push(istekAt("/api/v1/bakim-sablonlari/diger-holdingler"));
      if (platformAdminMi) istekler.push(istekAt("/api/v1/isletmeler"));
      const sonuclar = await Promise.all(istekler);
      setTumSantraller(sonuclar[0].veri);
      if (platformAdminMi) {
        setDigerHoldingSablonlari(sonuclar[1].veri);
        setIsletmeler(sonuclar[2].veri);
      }

      if (!platformAdminMi || seciliHoldingId) {
        const hedefId = platformAdminMi ? seciliHoldingId : kendiIsletmeId;
        const s = await istekAt(`/api/v1/bakim-sablonlari?hepsi=1&isletme_id=${hedefId}`);
        setSablonlar(s.veri);
      } else {
        setSablonlar(null);
      }
    } catch (err) {
      setHata(err.message);
    }
  }, [platformAdminMi, seciliHoldingId, kendiIsletmeId]);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!yoneticiMi()) {
      router.replace("/gorevler");
      return;
    }
    verileriYukle();
  }, [verileriYukle, router]);

  const gosterilecekSantraller = (tumSantraller || []).filter(
    (s) => s.isletme_id === (platformAdminMi ? seciliHoldingId : kendiIsletmeId)
  );

  function grupAnahtari(santralId, periyot) {
    return `${santralId || "genel"}|${periyot}`;
  }
  function grupToggle(santralId, periyot) {
    const anahtar = grupAnahtari(santralId, periyot);
    setAcikGruplar((onceki) => ({ ...onceki, [anahtar]: !onceki[anahtar] }));
  }

  function yeniSablonBaslat() {
    setTaslak(bosSablon(platformAdminMi ? seciliHoldingId : kendiIsletmeId));
    setDuzenlenenSablonId(null);
    setFormuAcik(true);
    setBilgi(null);
    setHata(null);
  }

  async function duzenlemeyiBaslat(sablonOzet) {
    setHata(null);
    setBilgi(null);
    try {
      const s = await istekAt(`/api/v1/bakim-sablonlari/${sablonOzet.sablon_id}`);
      setTaslak({
        ad: s.ad,
        ekipman_tipi: s.ekipman_tipi,
        periyot_tipi: s.periyot_tipi,
        isletme_id: s.isletme_id,
        santral_id: s.santral_id || "",
        kalemler: (s.checklist_json?.kalemler || []).map((k) => ({ ...k })),
      });
      setDuzenlenenSablonId(s.sablon_id);
      setFormuAcik(true);
    } catch (err) {
      setHata(err.message);
    }
  }

  function kalemEkle() {
    setTaslak((t) => ({ ...t, kalemler: [...t.kalemler, bosKalem(t.kalemler.length + 1)] }));
  }
  function kalemGuncelle(index, alan, deger) {
    setTaslak((t) => {
      const kalemler = [...t.kalemler];
      kalemler[index] = { ...kalemler[index], [alan]: deger };
      return { ...t, kalemler };
    });
  }
  function kalemSil(index) {
    setTaslak((t) => ({ ...t, kalemler: t.kalemler.filter((_, i) => i !== index) }));
  }

  async function dosyaSecildi(e) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setHata(null);
    try {
      const buffer = await dosya.arrayBuffer();
      const sonuc = excelDenSablonCikar(buffer);
      if (sonuc.kalemler.length === 0) {
        setHata(
          'Dosyada "Kontrol" başlıklı bir bölüm bulunamadı, otomatik çıkarım yapılamadı. Maddeleri aşağıya elle ekleyebilirsiniz.'
        );
      } else {
        setBilgi(
          `Dosyadan ${sonuc.kalemler.length} kontrol maddesi bulundu. Kaydetmeden önce aşağıdan gözden geçirip düzeltebilirsiniz.`
        );
      }
      setTaslak((t) => ({
        ...t,
        ad: sonuc.ad || "",
        ekipman_tipi: sonuc.ekipman_tipi || "",
        periyot_tipi: sonuc.periyot_tipi || "AYLIK",
        kalemler: sonuc.kalemler.map((k) => ({ ...k, birim: "", zorunlu: true })),
      }));
      setFormuAcik(true);
    } catch (err) {
      setHata("Dosya okunamadı — geçerli bir .xlsx dosyası olduğundan emin olun.");
    } finally {
      e.target.value = "";
    }
  }

  async function sablonuKaydet(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);

    if (taslak.kalemler.length === 0) {
      setHata("En az bir kontrol maddesi eklemelisiniz.");
      return;
    }
    const eksikSoru = taslak.kalemler.find((k) => !k.soru.trim());
    if (eksikSoru) {
      setHata("Boş bırakılmış bir kontrol maddesi var — doldurun ya da silin.");
      return;
    }

    setGonderiliyor(true);
    try {
      if (duzenlenenSablonId) {
        await istekAt(`/api/v1/bakim-sablonlari/${duzenlenenSablonId}`, {
          method: "PATCH",
          body: JSON.stringify({
            ad: taslak.ad,
            ekipman_tipi: taslak.ekipman_tipi,
            periyot_tipi: taslak.periyot_tipi,
            checklist_json: { kalemler: taslak.kalemler },
            santral_id: taslak.santral_id || null,
          }),
        });
        setBilgi("Şablon güncellendi — yeni bir versiyon olarak kaydedildi, eski versiyon pasifleşti.");
      } else {
        await istekAt("/api/v1/bakim-sablonlari", {
          method: "POST",
          body: JSON.stringify({
            ad: taslak.ad,
            ekipman_tipi: taslak.ekipman_tipi,
            periyot_tipi: taslak.periyot_tipi,
            checklist_json: { kalemler: taslak.kalemler },
            isletme_id: taslak.isletme_id,
            santral_id: taslak.santral_id || null,
          }),
        });
        setBilgi("Bakım şablonu kaydedildi.");
      }
      setFormuAcik(false);
      setDuzenlenenSablonId(null);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function sablonDurumDegistir(sablon) {
    setHata(null);
    try {
      const yol = sablon.aktif_mi
        ? `/api/v1/bakim-sablonlari/${sablon.sablon_id}/pasiflestir`
        : `/api/v1/bakim-sablonlari/${sablon.sablon_id}/aktiflestir`;
      await istekAt(yol, { method: "POST" });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function sablonSil(sablon) {
    if (!confirm(`"${sablon.ad}" şablonunu kalıcı olarak silmek istediğinize emin misiniz?`)) return;
    setHata(null);
    try {
      await istekAt(`/api/v1/bakim-sablonlari/${sablon.sablon_id}`, { method: "DELETE" });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function sablonKopyala(sablon, hedefHoldingId) {
    setHata(null);
    setBilgi(null);
    try {
      await istekAt(`/api/v1/bakim-sablonlari/${sablon.sablon_id}/kopyala`, {
        method: "POST",
        body: JSON.stringify({ hedef_isletme_id: hedefHoldingId }),
      });
      const hedefAdi = isletmeler?.find((h) => h.isletme_id === hedefHoldingId)?.ad || "seçilen holdinge";
      setBilgi(`"${sablon.ad}" ${hedefAdi} kopyalandı.`);
      setKopyaAcikSablonId(null);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  const gruplar = sablonlar ? santralVePeriyodaGoreGrupla(sablonlar) : null;
  const seciliHoldingAdi = isletmeler?.find((h) => h.isletme_id === seciliHoldingId)?.ad;

  return (
    <>
      <Head>
        <title>Bakım Şablonları — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Bakım Şablonları</h2>
            {(!platformAdminMi || seciliHoldingId) && (
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="kucukButon" onClick={() => dosyaInputRef.current.click()}>
                  Excel'den İçe Aktar
                </button>
                <button className="kucukButon" onClick={yeniSablonBaslat}>
                  + Elle Oluştur
                </button>
              </div>
            )}
            <input
              ref={dosyaInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={dosyaSecildi}
            />
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {platformAdminMi && (
            <div className="alan" style={{ maxWidth: "340px" }}>
              <label>Holding</label>
              <select value={seciliHoldingId} onChange={(e) => setSeciliHoldingId(e.target.value)}>
                <option value="">Bir holding seçin…</option>
                {isletmeler &&
                  isletmeler.map((h) => (
                    <option key={h.isletme_id} value={h.isletme_id}>
                      {h.ad}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {formuAcik && (
            <form onSubmit={sablonuKaydet} className="yonetimFormu">
              {platformAdminMi && isletmeler && !duzenlenenSablonId && (
                <div className="alan">
                  <label>Holding</label>
                  <select
                    value={taslak.isletme_id || ""}
                    onChange={(e) => setTaslak({ ...taslak, isletme_id: e.target.value, santral_id: "" })}
                  >
                    {isletmeler.map((i) => (
                      <option key={i.isletme_id} value={i.isletme_id}>
                        {i.ad}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="alan">
                <label>Santral (isteğe bağlı — boş bırakılırsa holding genelinde geçerli olur)</label>
                <select
                  value={taslak.santral_id}
                  onChange={(e) => setTaslak({ ...taslak, santral_id: e.target.value })}
                >
                  <option value="">Genel (Tüm Santraller)</option>
                  {(tumSantraller || [])
                    .filter((s) => s.isletme_id === taslak.isletme_id)
                    .map((s) => (
                      <option key={s.santral_id} value={s.santral_id}>
                        {s.ad}
                      </option>
                    ))}
                </select>
              </div>
              <div className="alan">
                <label>Şablon adı</label>
                <input
                  required
                  value={taslak.ad}
                  onChange={(e) => setTaslak({ ...taslak, ad: e.target.value })}
                  placeholder="Ör. Türbin Aylık Periyodik Bakım"
                />
              </div>
              <div className="alan">
                <label>Ekipman tipi</label>
                <input
                  required
                  value={taslak.ekipman_tipi}
                  onChange={(e) => setTaslak({ ...taslak, ekipman_tipi: e.target.value })}
                  placeholder="Ör. Türbin"
                />
              </div>
              <div className="alan">
                <label>Periyot</label>
                <select
                  value={taslak.periyot_tipi}
                  onChange={(e) => setTaslak({ ...taslak, periyot_tipi: e.target.value })}
                >
                  {Object.entries(PERIYOT_ETIKETLERI).map(([deger, etiket]) => (
                    <option key={deger} value={deger}>
                      {etiket}
                    </option>
                  ))}
                </select>
              </div>

              <div className="kalemSoru" style={{ marginTop: "18px", marginBottom: "10px" }}>
                Kontrol Maddeleri ({taslak.kalemler.length})
              </div>

              {taslak.kalemler.map((k, i) => (
                <div className="sablonKalemSatiri" key={i}>
                  <input
                    className="sablonKalemSoru"
                    value={k.soru}
                    onChange={(e) => kalemGuncelle(i, "soru", e.target.value)}
                    placeholder="Kontrol maddesi metni"
                  />
                  <select value={k.tip} onChange={(e) => kalemGuncelle(i, "tip", e.target.value)}>
                    {Object.entries(TIP_ETIKETLERI).map(([deger, etiket]) => (
                      <option key={deger} value={deger}>
                        {etiket}
                      </option>
                    ))}
                  </select>
                  {k.tip === "olcum" && (
                    <input
                      className="sablonKalemBirim"
                      value={k.birim || ""}
                      onChange={(e) => kalemGuncelle(i, "birim", e.target.value)}
                      placeholder="Birim (ör. °C)"
                    />
                  )}
                  <button type="button" className="fotografKarti-sil" onClick={() => kalemSil(i)}>
                    ×
                  </button>
                </div>
              ))}

              <button type="button" className="fotografEkleButon" onClick={kalemEkle} style={{ marginTop: "8px" }}>
                + Madde Ekle
              </button>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                  {gonderiliyor
                    ? "Kaydediliyor…"
                    : duzenlenenSablonId
                    ? "Yeni Versiyon Olarak Kaydet"
                    : "Şablonu Kaydet"}
                </button>
                <button
                  type="button"
                  className="kucukButon"
                  style={{ background: "var(--ink-soft)" }}
                  onClick={() => {
                    setFormuAcik(false);
                    setDuzenlenenSablonId(null);
                  }}
                >
                  Vazgeç
                </button>
              </div>
            </form>
          )}

          {platformAdminMi && !seciliHoldingId && !formuAcik && (
            <div className="bosDurum">Şablonları görmek için yukarıdan bir holding seçin.</div>
          )}

          {(!platformAdminMi || seciliHoldingId) && (
            <>
              {!gruplar && !formuAcik && <div className="yukleniyor">Yükleniyor…</div>}
              {gruplar && gruplar.length === 0 && !formuAcik && (
                <div className="bosDurum">Bu holdingde henüz bir bakım şablonu eklenmemiş.</div>
              )}

              {gruplar &&
                gruplar.map((santralGrubu) => (
                  <div key={santralGrubu.santral_id || "genel"} style={{ marginBottom: "22px" }}>
                    <h3 className="holdingBasligi">
                      {platformAdminMi && seciliHoldingAdi ? `${seciliHoldingAdi} — ` : ""}
                      {santralGrubu.santral_adi || "Genel (Tüm Santraller)"}
                    </h3>

                    {PERIYOT_SIRASI.filter((p) => santralGrubu.periyotlar.has(p)).map((periyot) => {
                      const sablonListesi = santralGrubu.periyotlar.get(periyot);
                      const acik = acikGruplar[grupAnahtari(santralGrubu.santral_id, periyot)];
                      return (
                        <div key={periyot} style={{ marginBottom: "8px" }}>
                          <button
                            type="button"
                            className="periyotGrupBasligi"
                            onClick={() => grupToggle(santralGrubu.santral_id, periyot)}
                          >
                            {acik ? "▾" : "▸"} {PERIYOT_ETIKETLERI[periyot]} Bakımlar ({sablonListesi.length})
                          </button>
                          {acik &&
                            sablonListesi.map((s) => (
                              <div className="satirKart" key={s.sablon_id} style={{ marginLeft: "18px" }}>
                                <div>
                                  <strong>{s.ad}</strong>
                                  {!s.aktif_mi && (
                                    <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>
                                      Pasif
                                    </span>
                                  )}
                                </div>
                                <div className="gorevAlt">
                                  {s.ekipman_tipi} · v{s.versiyon}
                                </div>
                                <div className="kullaniciAlt">
                                  <button className="linkButon" onClick={() => duzenlemeyiBaslat(s)}>
                                    Düzenle
                                  </button>
                                  <button className="linkButon" onClick={() => sablonDurumDegistir(s)}>
                                    {s.aktif_mi ? "Pasifleştir" : "Yeniden aktifleştir"}
                                  </button>
                                  <button className="linkButon" onClick={() => sablonSil(s)}>
                                    Sil
                                  </button>
                                </div>
                              </div>
                            ))}
                        </div>
                      );
                    })}
                  </div>
                ))}

              {platformAdminMi &&
                digerHoldingSablonlari &&
                digerHoldingSablonlari.filter((s) => s.isletme_id !== seciliHoldingId).length > 0 && (
                  <div style={{ marginTop: "28px" }}>
                    <h3 className="holdingBasligi">Diğer Holdinglerden Kopyala</h3>
                    {digerHoldingSablonlari
                      .filter((s) => s.isletme_id !== seciliHoldingId)
                      .map((s) => (
                      <div className="satirKart" key={s.sablon_id}>
                        <div>
                          <strong>{s.ad}</strong>
                          <span className="gorevAlt"> — {s.isletme_adi}</span>
                        </div>
                        <div className="gorevAlt">
                          {s.ekipman_tipi} · {PERIYOT_ETIKETLERI[s.periyot_tipi] || s.periyot_tipi}
                        </div>
                        <div className="kullaniciAlt">
                          {kopyaAcikSablonId === s.sablon_id ? (
                            <>
                              <select
                                value={kopyaHedefHoldingId}
                                onChange={(e) => setKopyaHedefHoldingId(e.target.value)}
                                style={{ fontSize: "12px", padding: "4px", marginRight: "10px" }}
                              >
                                <option value="">Hedef holding seçin…</option>
                                {isletmeler &&
                                  isletmeler
                                    .filter((h) => h.isletme_id !== s.isletme_id)
                                    .map((h) => (
                                      <option key={h.isletme_id} value={h.isletme_id}>
                                        {h.ad}
                                      </option>
                                    ))}
                              </select>
                              <button
                                className="linkButon"
                                disabled={!kopyaHedefHoldingId}
                                onClick={() => sablonKopyala(s, kopyaHedefHoldingId)}
                              >
                                Kopyala
                              </button>
                              <button className="linkButon" onClick={() => setKopyaAcikSablonId(null)}>
                                Vazgeç
                              </button>
                            </>
                          ) : (
                            <button
                              className="linkButon"
                              onClick={() => {
                                setKopyaAcikSablonId(s.sablon_id);
                                setKopyaHedefHoldingId(seciliHoldingId || "");
                              }}
                            >
                              Bir Holdinge Kopyala
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
