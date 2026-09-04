import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, isletmeYoneticisiMi } from "../lib/api";
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

const TIP_ETIKETLERI = {
  evet_hayir: "Evet / Hayır",
  olcum: "Ölçüm (sayı)",
  metin: "Serbest metin",
};

function bosSablon() {
  return { ad: "", ekipman_tipi: "", periyot_tipi: "AYLIK", kalemler: [] };
}

function bosKalem(sira) {
  return { id: `k${sira}`, soru: "", tip: "evet_hayir", birim: "", zorunlu: true };
}

export default function SablonlarSayfasi() {
  const router = useRouter();
  const dosyaInputRef = useRef(null);

  const [sablonlar, setSablonlar] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);

  const [formuAcik, setFormuAcik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [taslak, setTaslak] = useState(bosSablon());

  const verileriYukle = useCallback(async () => {
    try {
      const s = await istekAt("/api/v1/bakim-sablonlari");
      setSablonlar(s.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, []);

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

  function yeniSablonBaslat() {
    setTaslak(bosSablon());
    setFormuAcik(true);
    setBilgi(null);
    setHata(null);
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
      setTaslak({
        ad: sonuc.ad || "",
        ekipman_tipi: sonuc.ekipman_tipi || "",
        periyot_tipi: sonuc.periyot_tipi || "AYLIK",
        kalemler: sonuc.kalemler.map((k) => ({ ...k, birim: "", zorunlu: true })),
      });
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
      await istekAt("/api/v1/bakim-sablonlari", {
        method: "POST",
        body: JSON.stringify({
          ad: taslak.ad,
          ekipman_tipi: taslak.ekipman_tipi,
          periyot_tipi: taslak.periyot_tipi,
          checklist_json: { kalemler: taslak.kalemler },
        }),
      });
      setBilgi("Bakım şablonu kaydedildi.");
      setFormuAcik(false);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

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
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="kucukButon" onClick={() => dosyaInputRef.current.click()}>
                Excel'den İçe Aktar
              </button>
              <button className="kucukButon" onClick={yeniSablonBaslat}>
                + Elle Oluştur
              </button>
            </div>
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

          {formuAcik && (
            <form onSubmit={sablonuKaydet} className="yonetimFormu">
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

              <div>
                <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                  {gonderiliyor ? "Kaydediliyor…" : "Şablonu Kaydet"}
                </button>
              </div>
            </form>
          )}

          {!sablonlar && !formuAcik && <div className="yukleniyor">Yükleniyor…</div>}
          {sablonlar && sablonlar.length === 0 && !formuAcik && (
            <div className="bosDurum">Henüz bir bakım şablonu eklenmemiş.</div>
          )}
          {sablonlar &&
            sablonlar.map((s) => (
              <div className="satirKart" key={s.sablon_id}>
                <div>
                  <strong>{s.ad}</strong>
                </div>
                <div className="gorevAlt">
                  {s.ekipman_tipi} · {PERIYOT_ETIKETLERI[s.periyot_tipi] || s.periyot_tipi} · v{s.versiyon}
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
