import { useState, useEffect, useCallback } from "react";
import { istekAt } from "../lib/api";

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

function OzetDaire({ sayi, etiket, renkA, renkB }) {
  return (
    <div className="ozetDaireKutu">
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
  const [donem, setDonem] = useState("AYLIK");
  const [ozelBaslangic, setOzelBaslangic] = useState("");
  const [ozelBitis, setOzelBitis] = useState("");
  const [veri, setVeri] = useState(null);
  const [hata, setHata] = useState(null);

  const yukle = useCallback(async () => {
    if (donem === "OZEL" && (!ozelBaslangic || !ozelBitis)) return;
    try {
      const { baslangic, bitis } = donem === "OZEL" ? { baslangic: ozelBaslangic, bitis: ozelBitis } : donemTarihAraligi(donem);
      const sonuc = await istekAt(`/api/v1/raporlar/ozet-banner?baslangic=${baslangic}&bitis=${bitis}`);
      setVeri(sonuc.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, [donem, ozelBaslangic, ozelBitis]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  return (
    <div className="ozetBanner">
      <div className="ozetBannerSol">
        <label>Dönem</label>
        <select value={donem} onChange={(e) => setDonem(e.target.value)}>
          {Object.entries(DONEM_ETIKETLERI).map(([deger, etiket]) => (
            <option key={deger} value={deger}>
              {etiket}
            </option>
          ))}
        </select>
        {donem === "OZEL" && (
          <div className="ozetBannerTarihler">
            <input type="date" value={ozelBaslangic} onChange={(e) => setOzelBaslangic(e.target.value)} />
            <input type="date" value={ozelBitis} onChange={(e) => setOzelBitis(e.target.value)} />
          </div>
        )}
      </div>

      <div className="ozetBannerSag">
        {hata && <div className="hataKutusu">{hata}</div>}
        {!veri && !hata && <div className="gorevAlt">Yükleniyor…</div>}
        {veri && veri.length === 0 && <div className="gorevAlt">Gösterilecek santral yok.</div>}
        {veri &&
          veri.map((v) => (
            <div className="ozetSantralGrubu" key={v.santral_id}>
              <div className="ozetSantralAdi">{v.santral_adi}</div>
              <div className="ozetDaireSira">
                <OzetDaire sayi={v.devam_eden} etiket="Devam Eden" renkA="#c17a24" renkB="#f2c98a" />
                <OzetDaire sayi={v.geciken} etiket="Geciken" renkA="#a83b2e" renkB="#e79a8c" />
                <OzetDaire sayi={v.tamamlanan} etiket="Tamamlanan" renkA="#2c7a4b" renkB="#8fd1a8" />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
