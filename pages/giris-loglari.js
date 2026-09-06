import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, isletmeYoneticisiMi, platformAdminMi, dosyaIndir } from "../lib/api";
import UstBar from "../components/UstBar";

const ROL_ETIKETLERI = {
  ADMIN: "Platform Admin",
  ISLETME_ADMIN: "İşletme Admin",
  SANTRAL_SORUMLUSU: "Santral Sorumlusu",
  SAHA_PERSONELI: "Saha Personeli",
  IZLEYICI: "İzleyici",
};

function tarihSaatFormatla(deger) {
  if (!deger) return "—";
  return new Date(deger).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GirisLoglariSayfasi() {
  const router = useRouter();
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;

  const [kisiler, setKisiler] = useState(null);
  const [holdingler, setHoldingler] = useState(null);
  const [santraller, setSantraller] = useState(null);
  const [kayitlar, setKayitlar] = useState(null);
  const [kayitlarAcik, setKayitlarAcik] = useState(false);
  const [hata, setHata] = useState(null);
  const [indiriliyor, setIndiriliyor] = useState(false);

  // Son seçilen holding/santral, tarayıcıda hatırlanır — sayfaya her
  // girişte "Tüm Holdingler"den başlamak yerine kaldığınız yerden devam edin.
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
  const [seciliSantralIdleri, setSeciliSantralIdleri] = useState([]);
  const [santralPaneliAcik, setSantralPaneliAcik] = useState(false);
  const [seciliKisiId, setSeciliKisiId] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!isletmeYoneticisiMi()) {
      router.replace("/gorevler");
      return;
    }
    try {
      const kayitliHolding = localStorage.getItem("girisLoglariHoldingId");
      const kayitliSantraller = JSON.parse(localStorage.getItem("girisLoglariSantralIdleri") || "[]");
      if (kayitliHolding) setSeciliHoldingId(kayitliHolding);
      if (Array.isArray(kayitliSantraller) && kayitliSantraller.length > 0) {
        setSeciliSantralIdleri(kayitliSantraller);
      }
    } catch {
      // localStorage okunamazsa sessizce geç, varsayılan (boş) filtrelerle devam et
    }
    istekAt("/api/v1/giris-loglari/filtre-secenekleri")
      .then((veri) => {
        setKisiler(veri.kisiler);
        setHoldingler(veri.holdingler);
        setSantraller(veri.santraller);
      })
      .catch((err) => setHata(err.message));
  }, [router]);

  // Platform Admin holding ve/veya santral seçtiğinde, Kişi kutusunu da
  // yalnızca o kapsamdaki kişilerle yeniden dolduruyoruz — aksi halde
  // kutuda sistemdeki HERKES görünüyordu, holding ayırt etmeksizin.
  useEffect(() => {
    if (!platformAdmin) return;
    const p = new URLSearchParams();
    if (seciliSantralIdleri.length > 0) {
      seciliSantralIdleri.forEach((id) => p.append("santral_idleri", id));
    } else if (seciliHoldingId) {
      p.set("isletme_id", seciliHoldingId);
    }
    setSeciliKisiId("");
    istekAt(`/api/v1/giris-loglari/filtre-secenekleri?${p.toString()}`)
      .then((veri) => setKisiler(veri.kisiler))
      .catch((err) => setHata(err.message));
  }, [platformAdmin, seciliHoldingId, seciliSantralIdleri]);

  const parametreOlustur = useCallback(() => {
    const p = new URLSearchParams();
    if (platformAdmin && seciliSantralIdleri.length > 0) {
      seciliSantralIdleri.forEach((id) => p.append("santral_idleri", id));
    } else if (platformAdmin && seciliHoldingId) {
      p.set("isletme_id", seciliHoldingId);
    }
    if (seciliKisiId) p.set("kullanici_id", seciliKisiId);
    if (baslangic) p.set("baslangic", baslangic);
    if (bitis) p.set("bitis", bitis);
    p.set("limit", "50");
    return p;
  }, [platformAdmin, seciliHoldingId, seciliSantralIdleri, seciliKisiId, baslangic, bitis]);

  const kayitlariGetir = useCallback(async () => {
    setHata(null);
    try {
      const sonuc = await istekAt(`/api/v1/giris-loglari?${parametreOlustur().toString()}`);
      setKayitlar(sonuc.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, [parametreOlustur]);

  useEffect(() => {
    kayitlariGetir();
  }, [kayitlariGetir]);

  function santralSecimiDegistir(santralId) {
    setSeciliSantralIdleri((onceki) => {
      const yeni = onceki.includes(santralId) ? onceki.filter((id) => id !== santralId) : [...onceki, santralId];
      localStorage.setItem("girisLoglariSantralIdleri", JSON.stringify(yeni));
      return yeni;
    });
  }

  async function pdfIndir() {
    setIndiriliyor(true);
    setHata(null);
    try {
      // PDF raporu ekrandaki "son 50" sınırına takılmasın — tüm filtrelenmiş
      // kayıtları içersin diye limit parametresini kaldırıyoruz.
      const p = parametreOlustur();
      p.delete("limit");
      await dosyaIndir(`/api/v1/giris-loglari/pdf?${p.toString()}`, "giris-loglari.pdf");
    } catch (err) {
      setHata(err.message);
    } finally {
      setIndiriliyor(false);
    }
  }

  const gosterilecekSantraller = seciliHoldingId
    ? (santraller || []).filter((s) => s.isletme_id === seciliHoldingId)
    : [];

  return (
    <>
      <Head>
        <title>Giriş Logları — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Giriş Logları</h2>
            <button className="kucukButon" onClick={pdfIndir} disabled={indiriliyor}>
              {indiriliyor ? "Hazırlanıyor…" : "PDF Rapor İndir"}
            </button>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}

          <div className="yonetimFormu">
            {platformAdmin && (
              <div className="alan">
                <label>Holding</label>
                <select
                  value={seciliHoldingId}
                  onChange={(e) => {
                    setSeciliHoldingId(e.target.value);
                    setSeciliSantralIdleri([]);
                    setSantralPaneliAcik(false);
                    localStorage.setItem("girisLoglariHoldingId", e.target.value);
                    localStorage.setItem("girisLoglariSantralIdleri", "[]");
                  }}
                >
                  <option value="">Tüm Holdingler</option>
                  {holdingler &&
                    holdingler.map((h) => (
                      <option key={h.isletme_id} value={h.isletme_id}>
                        {h.ad}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {platformAdmin && seciliHoldingId && (
              <div className="alan">
                <label>Santraller — birden fazla seçebilirsiniz</label>
                <button
                  type="button"
                  className="periyotGrupBasligi"
                  onClick={() => setSantralPaneliAcik((v) => !v)}
                >
                  {santralPaneliAcik ? "▾" : "▸"}{" "}
                  {seciliSantralIdleri.length > 0
                    ? `${seciliSantralIdleri.length} santral seçili`
                    : "Tüm Santraller (seçmek için tıklayın)"}
                </button>
                {santralPaneliAcik && (
                  <div className="aliciListesi">
                    {gosterilecekSantraller.map((s) => (
                      <label key={s.santral_id} className="aliciSatiri">
                        <input
                          type="checkbox"
                          checked={seciliSantralIdleri.includes(s.santral_id)}
                          onChange={() => santralSecimiDegistir(s.santral_id)}
                        />
                        {s.ad}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="alan">
              <label>Kişi</label>
              <select value={seciliKisiId} onChange={(e) => setSeciliKisiId(e.target.value)}>
                <option value="">Tüm Kişiler</option>
                {kisiler &&
                  kisiler.map((k) => (
                    <option key={k.kullanici_id} value={k.kullanici_id}>
                      {k.ad_soyad}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <div className="alan" style={{ flex: 1 }}>
                <label>Başlangıç tarihi</label>
                <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
              </div>
              <div className="alan" style={{ flex: 1 }}>
                <label>Bitiş tarihi</label>
                <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} />
              </div>
            </div>
          </div>

          {!kayitlar && <div className="yukleniyor">Yükleniyor…</div>}

          {kayitlar && (
            <button type="button" className="periyotGrupBasligi" onClick={() => setKayitlarAcik((v) => !v)}>
              {kayitlarAcik ? "▾" : "▸"} Giriş Kayıtları ({kayitlar.length}
              {kayitlar.length === 50 ? " — son 50" : ""})
            </button>
          )}

          {kayitlar && kayitlarAcik && kayitlar.length === 0 && (
            <div className="bosDurum">Seçilen filtrelerle eşleşen giriş kaydı yok.</div>
          )}
          {kayitlar &&
            kayitlarAcik &&
            kayitlar.map((k) => (
              <div className="satirKart" key={k.kayit_id}>
                <div>
                  <strong>{k.ad_soyad}</strong> — {k.eposta}
                </div>
                <div className="gorevAlt">
                  {ROL_ETIKETLERI[k.rol] || k.rol} · {k.isletme_adi} · {tarihSaatFormatla(k.giris_tarihi)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
