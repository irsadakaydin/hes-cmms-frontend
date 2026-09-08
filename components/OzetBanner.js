import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { istekAt, platformAdminMi } from "../lib/api";

const DONEM_ETIKETLERI = {
  GUNLUK: "Günlük",
  HAFTALIK: "Haftalık",
  AYLIK: "Aylık",
  YILLIK: "Yıllık",
  OZEL: "Tarih Seç…",
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
    case "YILLIK": {
      const d = new Date(bugun.getFullYear(), 0, 1);
      return { baslangic: gunFormatla(d), bitis };
    }
    case "AYLIK":
    default: {
      const d = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
      return { baslangic: gunFormatla(d), bitis };
    }
  }
}

function OzetDaire({ sayi, etiket, renkA, renkB, onClick }) {
  return (
    <div
      className={`ozetDaireKutu ${onClick ? "ozetDaireTiklanabilir" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div
        className="ozetDaire"
        style={{ background: `radial-gradient(circle at 35% 30%, ${renkB}, ${renkA})` }}
      >
        <span>{sayi}</span>
      </div>
      <div className="ozetDaireEtiket">{etiket}</div>
    </div>
  );
}

export default function OzetBanner() {
  const router = useRouter();
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;

  const [donem, setDonem] = useState("AYLIK");
  const [donemMenuAcik, setDonemMenuAcik] = useState(false);
  const donemMenuRef = useRef(null);
  const [ozelBaslangic, setOzelBaslangic] = useState("");
  const [ozelBitis, setOzelBitis] = useState("");
  const [holdingler, setHoldingler] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    if (platformAdminMi()) {
      istekAt("/api/v1/isletmeler")
        .then((veri) => setHoldingler(veri.veri))
        .catch((err) => setHata(err.message));
    }
  }, []);

  useEffect(() => {
    function disariTiklaninca(e) {
      if (donemMenuRef.current && !donemMenuRef.current.contains(e.target)) {
        setDonemMenuAcik(false);
      }
    }
    document.addEventListener("mousedown", disariTiklaninca);
    return () => document.removeEventListener("mousedown", disariTiklaninca);
  }, []);

  const yukle = useCallback(async () => {
    if (donem === "OZEL" && (!ozelBaslangic || !ozelBitis)) return;
    if (platformAdmin && !seciliHoldingId) {
      setVeri(null);
      return;
    }
    try {
      const { baslangic, bitis } =
        donem === "OZEL" ? { baslangic: ozelBaslangic, bitis: ozelBitis } : donemTarihAraligi(donem);
      const parametreler = new URLSearchParams({ baslangic, bitis });
      if (platformAdmin && seciliHoldingId) parametreler.set("isletme_id", seciliHoldingId);
      const sonuc = await istekAt(`/api/v1/raporlar/ozet-banner?${parametreler.toString()}`);
      setVeri(sonuc.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, [donem, ozelBaslangic, ozelBitis, platformAdmin, seciliHoldingId]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  return (
    <div className="ozetBanner">
      <div className="ozetBannerSol">
        {platformAdmin && (
          <>
            <label>Holding</label>
            <select value={seciliHoldingId} onChange={(e) => setSeciliHoldingId(e.target.value)}>
              <option value="">Bir holding seçin…</option>
              {holdingler &&
                holdingler.map((h) => (
                  <option key={h.isletme_id} value={h.isletme_id}>
                    {h.ad}
                  </option>
                ))}
            </select>
          </>
        )}
        <label>Dönem</label>
        <div className="donemSeciciSarmalayici" ref={donemMenuRef}>
          <button
            type="button"
            className="donemSeciciButon"
            onClick={() => setDonemMenuAcik((v) => !v)}
            aria-expanded={donemMenuAcik}
          >
            <svg className="donemSeciciIkon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3.5 9.5H20.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="8" cy="13.5" r="1.2" fill="currentColor" />
              <circle cx="12" cy="13.5" r="1.2" fill="currentColor" />
              <circle cx="16" cy="13.5" r="1.2" fill="currentColor" />
            </svg>
            <span>{DONEM_ETIKETLERI[donem]}</span>
            <svg
              className={`donemSeciciOk ${donemMenuAcik ? "donemSeciciOkAcik" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className={`donemSeciciMenu ${donemMenuAcik ? "donemSeciciMenuAcik" : ""}`}>
            {Object.entries(DONEM_ETIKETLERI).map(([deger, etiket]) => (
              <button
                type="button"
                key={deger}
                className={`donemSeciciSecenek ${donem === deger ? "donemSeciciSecenekAktif" : ""}`}
                onClick={() => {
                  setDonem(deger);
                  setDonemMenuAcik(false);
                }}
              >
                {etiket}
                {donem === deger && <span className="donemSeciciTik">✓</span>}
              </button>
            ))}
          </div>
        </div>
        {donem === "OZEL" && (
          <div className="ozetBannerTarihler">
            <input type="date" value={ozelBaslangic} onChange={(e) => setOzelBaslangic(e.target.value)} />
            <input type="date" value={ozelBitis} onChange={(e) => setOzelBitis(e.target.value)} />
          </div>
        )}
      </div>

      <div className="ozetBannerSag">
        {hata && <div className="hataKutusu">{hata}</div>}
        {platformAdmin && !seciliHoldingId && (
          <div className="gorevAlt">Özeti görmek için önce bir holding seçin.</div>
        )}
        {(!platformAdmin || seciliHoldingId) && !veri && !hata && <div className="gorevAlt">Yükleniyor…</div>}
        {veri && veri.length === 0 && <div className="gorevAlt">Gösterilecek santral yok.</div>}
        {veri &&
          veri.map((v) => (
            <div className="ozetSantralGrubu" key={v.santral_id}>
              <div className="ozetSantralAdi">{v.santral_adi}</div>
              <div className="ozetDaireSira">
                <OzetDaire
                  sayi={v.devam_eden}
                  etiket="Devam Eden"
                  renkA="#c17a24"
                  renkB="#f2c98a"
                  onClick={() => router.push(`/bakimlar?santral_id=${v.santral_id}&sekme=DEVAM_EDEN`)}
                />
                <OzetDaire
                  sayi={v.geciken}
                  etiket="Geciken"
                  renkA="#a83b2e"
                  renkB="#e79a8c"
                  onClick={() => router.push(`/bakimlar?santral_id=${v.santral_id}&sekme=GECIKEN`)}
                />
                <OzetDaire
                  sayi={v.tamamlanan}
                  etiket="Tamamlanan"
                  renkA="#2c7a4b"
                  renkB="#8fd1a8"
                  onClick={() => router.push(`/bakimlar?santral_id=${v.santral_id}&sekme=TAMAMLANAN`)}
                />
                <OzetDaire
                  sayi={v.durdurulan}
                  etiket="Durdurulan"
                  renkA="#5b6b62"
                  renkB="#b7c2bb"
                  onClick={() => router.push(`/bakimlar?santral_id=${v.santral_id}&sekme=DURDURULAN`)}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
