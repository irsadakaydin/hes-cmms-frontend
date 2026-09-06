import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, yoneticiMi, platformAdminMi, dosyaIndir } from "../lib/api";
import UstBar from "../components/UstBar";

const PERIYOT_ETIKETLERI = {
  GUNLUK: "Günlük",
  HAFTALIK: "Haftalık",
  AYLIK: "Aylık",
  UC_AYLIK: "3 Ayda Bir",
  ALTI_AYLIK: "6 Ayda Bir",
  YILLIK: "Yıllık",
};

const DONEM_ETIKETLERI = {
  TUM_ZAMANLAR: "Tüm Zamanlar",
  GUNLUK: "Bugün",
  HAFTALIK: "Son 7 Gün",
  AYLIK: "Bu Ay",
  YILLIK: "Bu Yıl",
  OZEL: "Özel Tarih Aralığı…",
};

function donemTarihAraligi(donem) {
  const bugun = new Date();
  const gunFormatla = (d) => d.toISOString().slice(0, 10);
  const bitis = gunFormatla(bugun);

  switch (donem) {
    case "GUNLUK":
      return { baslangic: bitis, bitis };
    case "HAFTALIK": {
      const d = new Date(bugun);
      d.setDate(d.getDate() - 6);
      return { baslangic: gunFormatla(d), bitis };
    }
    case "AYLIK": {
      const d = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
      return { baslangic: gunFormatla(d), bitis };
    }
    case "YILLIK": {
      const d = new Date(bugun.getFullYear(), 0, 1);
      return { baslangic: gunFormatla(d), bitis };
    }
    default:
      return {};
  }
}

export default function RaporOlusturSayfasi() {
  const router = useRouter();
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;
  const [sekme, setSekme] = useState("OZET");
  const [santraller, setSantraller] = useState(null);
  const [holdingler, setHoldingler] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
  const [personel, setPersonel] = useState(null);
  const [hata, setHata] = useState(null);
  const [indiriliyor, setIndiriliyor] = useState(false);

  // Kutulardan hiçbiri seçilmezse ("") o filtre hiç uygulanmaz — hepsi dahil olur.
  const [santralId, setSantralId] = useState("");
  const [periyot, setPeriyot] = useState("");
  const [sorumluId, setSorumluId] = useState("");
  const [durum, setDurum] = useState("");
  const [donem, setDonem] = useState("TUM_ZAMANLAR");
  const [ozelBaslangic, setOzelBaslangic] = useState("");
  const [ozelBitis, setOzelBitis] = useState("");

  // "PDF Çıktı Al" sekmesi — tek bir tamamlanmış görevin tam checklist
  // formunu (soru+cevap, not, imza, fotoğraf) PDF olarak üretir.
  const [ciktiSantralId, setCiktiSantralId] = useState("");
  const [ciktiBaslangic, setCiktiBaslangic] = useState("");
  const [ciktiBitis, setCiktiBitis] = useState("");
  const [tamamlananGorevler, setTamamlananGorevler] = useState(null);
  const [ciktiIndiriliyorId, setCiktiIndiriliyorId] = useState(null);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!yoneticiMi()) {
      router.replace("/gorevler");
      return;
    }
    const istekler = [istekAt("/api/v1/raporlar/filtre-secenekleri")];
    if (platformAdminMi()) istekler.push(istekAt("/api/v1/isletmeler"));
    Promise.all(istekler)
      .then(([veri, h]) => {
        setSantraller(veri.santraller);
        setPersonel(veri.personel);
        if (h) setHoldingler(h.veri);
      })
      .catch((err) => setHata(err.message));
  }, [router]);

  const gosterilecekSantraller = platformAdmin
    ? (santraller || []).filter((s) => s.isletme_id === seciliHoldingId)
    : santraller;
  const gosterilecekPersonel = platformAdmin
    ? (personel || []).filter((p) => p.isletme_id === seciliHoldingId)
    : personel;

  async function raporOlustur(format) {
    setHata(null);
    if (donem === "OZEL" && (!ozelBaslangic || !ozelBitis)) {
      setHata("Özel tarih aralığı için başlangıç ve bitiş tarihini seçmelisiniz.");
      return;
    }
    setIndiriliyor(true);
    try {
      const { baslangic, bitis } =
        donem === "OZEL" ? { baslangic: ozelBaslangic, bitis: ozelBitis } : donemTarihAraligi(donem);
      const parametreler = new URLSearchParams();
      if (santralId) parametreler.set("santral_id", santralId);
      else if (platformAdmin && seciliHoldingId) parametreler.set("isletme_id", seciliHoldingId);
      if (periyot) parametreler.set("periyot", periyot);
      if (sorumluId) parametreler.set("sorumlu_kullanici_id", sorumluId);
      if (durum) parametreler.set("durum", durum);
      if (baslangic) parametreler.set("baslangic", baslangic);
      if (bitis) parametreler.set("bitis", bitis);
      const sorguMetni = parametreler.toString() ? `?${parametreler.toString()}` : "";

      const uzanti = format === "pdf" ? "pdf" : "xlsx";

      const santralAdi = santralId
        ? gosterilecekSantraller.find((s) => s.santral_id === santralId)?.ad || "Santral"
        : "Tüm Santraller";
      const periyotAdi = periyot ? PERIYOT_ETIKETLERI[periyot] || periyot : "Tüm Periyotlar";
      const dosyaAdi = `${santralAdi} (${periyotAdi}) Bakım Raporu.${uzanti}`;

      await dosyaIndir(`/api/v1/raporlar/${format}${sorguMetni}`, dosyaAdi);
    } catch (err) {
      setHata(err.message);
    } finally {
      setIndiriliyor(false);
    }
  }

  async function tamamlananlariGetir() {
    setHata(null);
    if (!ciktiBaslangic || !ciktiBitis) {
      setHata("Tarih aralığı için başlangıç ve bitiş tarihini seçmelisiniz.");
      return;
    }
    try {
      const p = new URLSearchParams({ baslangic: ciktiBaslangic, bitis: ciktiBitis });
      if (ciktiSantralId) p.set("santral_id", ciktiSantralId);
      else if (platformAdmin && seciliHoldingId) p.set("isletme_id", seciliHoldingId);
      const sonuc = await istekAt(`/api/v1/raporlar/tamamlanan-gorevler?${p.toString()}`);
      setTamamlananGorevler(sonuc.veri);
    } catch (err) {
      setHata(err.message);
    }
  }

  async function gorevPdfIndir(gorev) {
    setCiktiIndiriliyorId(gorev.gorev_id);
    setHata(null);
    try {
      await dosyaIndir(
        `/api/v1/raporlar/gorev-detay-pdf/${gorev.gorev_id}`,
        `${gorev.ekipman_adi} - ${gorev.bakim_adi}.pdf`
      );
    } catch (err) {
      setHata(err.message);
    } finally {
      setCiktiIndiriliyorId(null);
    }
  }

  return (
    <>
      <Head>
        <title>Rapor Oluştur — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Rapor Oluştur</h2>
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <button
              type="button"
              className={sekme === "OZET" ? "planSekmeAktif" : "planSekme"}
              onClick={() => setSekme("OZET")}
            >
              Özet Rapor
            </button>
            <button
              type="button"
              className={sekme === "PDF_CIKTI" ? "planSekmeAktif" : "planSekme"}
              onClick={() => setSekme("PDF_CIKTI")}
            >
              PDF Çıktı Al
            </button>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {!santraller && !hata && <div className="yukleniyor">Yükleniyor…</div>}

          {sekme === "OZET" && santraller && (
            <div className="yonetimFormu">
              {platformAdmin && (
                <div className="alan">
                  <label>Holding</label>
                  <select
                    value={seciliHoldingId}
                    onChange={(e) => {
                      setSeciliHoldingId(e.target.value);
                      setSantralId("");
                      setSorumluId("");
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
                <>
                  <div className="alan">
                    <label>Santral</label>
                    <select value={santralId} onChange={(e) => setSantralId(e.target.value)}>
                      <option value="">Tüm Santraller</option>
                      {gosterilecekSantraller.map((s) => (
                        <option key={s.santral_id} value={s.santral_id}>
                          {s.ad} {!platformAdmin && s.isletme_adi ? `(${s.isletme_adi})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="alan">
                    <label>Bakım Periyodu</label>
                    <select value={periyot} onChange={(e) => setPeriyot(e.target.value)}>
                      <option value="">Tüm Periyotlar</option>
                      {Object.entries(PERIYOT_ETIKETLERI).map(([deger, etiket]) => (
                        <option key={deger} value={deger}>
                          {etiket}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="alan">
                    <label>Durum</label>
                    <select value={durum} onChange={(e) => setDurum(e.target.value)}>
                      <option value="">Tümü</option>
                      <option value="TAMAMLANDI">Tamamlanan</option>
                      <option value="GECIKTI">Geciken</option>
                      <option value="BEKLIYOR">Bekleyen</option>
                    </select>
                  </div>

                  <div className="alan">
                    <label>Bakım Sorumlusu</label>
                    <select value={sorumluId} onChange={(e) => setSorumluId(e.target.value)}>
                      <option value="">Tüm Personel</option>
                      {gosterilecekPersonel &&
                        gosterilecekPersonel.map((p) => (
                          <option key={p.kullanici_id} value={p.kullanici_id}>
                            {p.ad_soyad}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="alan">
                    <label>Rapor Aralığı</label>
                    <select value={donem} onChange={(e) => setDonem(e.target.value)}>
                      {Object.entries(DONEM_ETIKETLERI).map(([deger, etiket]) => (
                        <option key={deger} value={deger}>
                          {etiket}
                        </option>
                      ))}
                    </select>
                  </div>

                  {donem === "OZEL" && (
                    <div style={{ display: "flex", gap: "12px" }}>
                      <div className="alan" style={{ flex: 1 }}>
                        <label>Başlangıç tarihi</label>
                        <input
                          type="date"
                          value={ozelBaslangic}
                          onChange={(e) => setOzelBaslangic(e.target.value)}
                        />
                      </div>
                      <div className="alan" style={{ flex: 1 }}>
                        <label>Bitiş tarihi</label>
                        <input type="date" value={ozelBitis} onChange={(e) => setOzelBitis(e.target.value)} />
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                    <button className="birincilButon" onClick={() => raporOlustur("pdf")} disabled={indiriliyor}>
                      {indiriliyor ? "Hazırlanıyor…" : "PDF Rapor Oluştur"}
                    </button>
                    <button className="birincilButon" onClick={() => raporOlustur("excel")} disabled={indiriliyor}>
                      {indiriliyor ? "Hazırlanıyor…" : "Excel Rapor Oluştur"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {sekme === "PDF_CIKTI" && santraller && (
            <div className="yonetimFormu">
              {platformAdmin && (
                <div className="alan">
                  <label>Holding</label>
                  <select
                    value={seciliHoldingId}
                    onChange={(e) => {
                      setSeciliHoldingId(e.target.value);
                      setCiktiSantralId("");
                      setTamamlananGorevler(null);
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
                <>
                  <div className="alan">
                    <label>Santral</label>
                    <select value={ciktiSantralId} onChange={(e) => setCiktiSantralId(e.target.value)}>
                      <option value="">Tüm Santraller</option>
                      {gosterilecekSantraller.map((s) => (
                        <option key={s.santral_id} value={s.santral_id}>
                          {s.ad} {!platformAdmin && s.isletme_adi ? `(${s.isletme_adi})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: "12px" }}>
                    <div className="alan" style={{ flex: 1 }}>
                      <label>Başlangıç tarihi</label>
                      <input
                        type="date"
                        value={ciktiBaslangic}
                        onChange={(e) => setCiktiBaslangic(e.target.value)}
                      />
                    </div>
                    <div className="alan" style={{ flex: 1 }}>
                      <label>Bitiş tarihi</label>
                      <input type="date" value={ciktiBitis} onChange={(e) => setCiktiBitis(e.target.value)} />
                    </div>
                  </div>

                  <button className="birincilButon" type="button" onClick={tamamlananlariGetir}>
                    Tamamlanan Görevleri Listele
                  </button>

                  {tamamlananGorevler && tamamlananGorevler.length === 0 && (
                    <div className="bosDurum" style={{ marginTop: "16px" }}>
                      Seçilen tarih aralığında tamamlanmış görev yok.
                    </div>
                  )}

                  {tamamlananGorevler &&
                    tamamlananGorevler.map((g) => (
                      <div className="satirKart" key={g.gorev_id} style={{ marginTop: "12px" }}>
                        <div>
                          <strong>{g.ekipman_adi}</strong> — {g.bakim_adi}
                        </div>
                        <div className="gorevAlt">
                          {g.santral_adi} · Tamamlayan: {g.tamamlayan_adi} ·{" "}
                          {new Date(g.tamamlanma_tarihi).toLocaleDateString("tr-TR")}
                        </div>
                        <button
                          className="linkButon"
                          onClick={() => gorevPdfIndir(g)}
                          disabled={ciktiIndiriliyorId === g.gorev_id}
                        >
                          {ciktiIndiriliyorId === g.gorev_id ? "Hazırlanıyor…" : "PDF Çıktı Al"}
                        </button>
                      </div>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
