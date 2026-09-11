import { useState, useEffect, useCallback } from "react";
import { istekAt } from "../lib/api";

/**
 * Ekipman Listesi için özel klasör ağacı — "Oto Bakım Planla" sayfasındaki
 * gibi sade, tek satırlık akordeon listesi. Ayrı bir "Bunu Seç" düğmesi
 * yok: bir klasöre tıklamak hem içine girer (varsa alt klasörleri gösterir)
 * hem de o klasörü ANINDA seçer (o klasördeki ekipmanları listeler) —
 * tıkladığınız an zaten seçmiş olursunuz.
 */
export default function EkipmanKlasorAgaci({ santralId, santralAdi, onSecim, seciliKlasorId }) {
  const [kokDugumler, setKokDugumler] = useState(null);
  const [hata, setHata] = useState(null);
  const [kurulumOneriliyor, setKurulumOneriliyor] = useState(false);
  const [kuruluyor, setKuruluyor] = useState(false);
  const [yenilemeSayaci, setYenilemeSayaci] = useState(0);
  const [aktifYol, setAktifYol] = useState([]);

  const kokleriGetir = useCallback(async () => {
    if (!santralId) return;
    setKokDugumler(null);
    setHata(null);
    try {
      const veri = await istekAt(`/api/v1/santraller/${santralId}/klasorler`);
      setKokDugumler(veri.veri);
      setKurulumOneriliyor(veri.veri.length === 0);
    } catch (err) {
      setHata(err.message);
    }
  }, [santralId]);

  const anahtarli = `${santralId || ""}-${yenilemeSayaci}`;
  useEffect(() => {
    kokleriGetir();
    setAktifYol([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtarli]);

  async function standartAgaciKur() {
    setKuruluyor(true);
    setHata(null);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/klasor-agaci-yukle`, { method: "POST" });
      await kokleriGetir();
    } catch (err) {
      setHata(err.message);
    } finally {
      setKuruluyor(false);
    }
  }

  return (
    <div className="yonetimFormu" style={{ background: "var(--surface)" }}>
      {hata && <div className="hataKutusu">{hata}</div>}
      <div className="agacKokEtiketi">{santralAdi || "Santral"}</div>

      {kurulumOneriliyor && (
        <div className="klasorBosDurumKutusu">
          <svg className="klasorBosDurumIkon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 6.5C3 5.67 3.67 5 4.5 5H9.5L11.5 7H19.5C20.33 7 21 7.67 21 8.5V17.5C21 18.33 20.33 19 19.5 19H4.5C3.67 19 3 18.33 3 17.5V6.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M12 10.5V15.5M9.5 13H14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <div>
            <div className="klasorBosDurumMetin">Bu santralde henüz klasör yok.</div>
            <button type="button" className="klasorSecButon" onClick={standartAgaciKur} disabled={kuruluyor}>
              {kuruluyor ? "Kuruluyor…" : "Standart HES klasör ağacını kur"}
            </button>
          </div>
        </div>
      )}

      {!kokDugumler && !kurulumOneriliyor && <div className="yukleniyor">Yükleniyor…</div>}

      {kokDugumler &&
        kokDugumler.map((k) => (
          <EkipmanKlasorSatiri
            key={k.klasor_id}
            klasor={k}
            seviye={0}
            santralId={santralId}
            onSecim={onSecim}
            seciliKlasorId={seciliKlasorId}
            onDegisiklik={() => setYenilemeSayaci((n) => n + 1)}
            aktifYol={aktifYol}
            setAktifYol={setAktifYol}
          />
        ))}
    </div>
  );
}

function EkipmanKlasorSatiri({ klasor, seviye, santralId, onSecim, seciliKlasorId, onDegisiklik, aktifYol, setAktifYol }) {
  const [cocuklar, setCocuklar] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);

  const acik = aktifYol[seviye] === klasor.klasor_id;
  const secilebilir = !klasor.periyot_tipi;

  async function tiklaninca() {
    if (secilebilir) onSecim(klasor);
    if (klasor.periyot_tipi) return; // periyot yaprağının altı yok
    if (acik) {
      setAktifYol((y) => y.slice(0, seviye));
      return;
    }
    setAktifYol((y) => [...y.slice(0, seviye), klasor.klasor_id]);
    if (cocuklar === null) {
      setYukleniyor(true);
      try {
        const veri = await istekAt(`/api/v1/santraller/${santralId}/klasorler?ust_klasor_id=${klasor.klasor_id}`);
        setCocuklar(veri.veri);
      } catch (err) {
        setHata(err.message);
      } finally {
        setYukleniyor(false);
      }
    }
  }

  async function klasoruSil(e) {
    e.stopPropagation();
    if (!confirm(`"${klasor.ad}" klasörünü silmek istediğinize emin misiniz? Altındaki tüm alt klasörler de silinecek.`)) {
      return;
    }
    setHata(null);
    try {
      await istekAt(`/api/v1/klasorler/${klasor.klasor_id}`, { method: "DELETE" });
      onDegisiklik();
    } catch (err) {
      if (err.hata_kodu === "KLASOR_DOLU") {
        if (confirm(err.message)) {
          try {
            await istekAt(`/api/v1/klasorler/${klasor.klasor_id}?zorla=1`, { method: "DELETE" });
            onDegisiklik();
          } catch (err2) {
            setHata(err2.message);
          }
        }
      } else {
        setHata(err.message);
      }
    }
  }

  return (
    <div>
      {hata && (
        <div className="hataKutusu" style={{ marginLeft: seviye * 20 }}>
          {hata}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: `${seviye * 20}px` }}>
        <button
          type="button"
          className="periyotGrupBasligi"
          style={{
            flex: 1,
            textAlign: "left",
            background: seciliKlasorId === klasor.klasor_id ? "var(--paper)" : undefined,
          }}
          onClick={tiklaninca}
        >
          {klasor.periyot_tipi ? "· " : acik ? "▾ " : "▸ "}
          {klasor.ad}
          {Number(klasor.ekipman_sayisi) > 0 && ` (${klasor.ekipman_sayisi} ekipman)`}
        </button>
        <button type="button" className="klasorSilButon" onClick={klasoruSil} title="Klasörü sil">
          🗑
        </button>
      </div>

      {yukleniyor && (
        <div className="yukleniyor" style={{ paddingLeft: `${(seviye + 1) * 20}px` }}>
          Yükleniyor…
        </div>
      )}

      {acik && cocuklar && (
        <div>
          {cocuklar.map((c) => (
            <EkipmanKlasorSatiri
              key={c.klasor_id}
              klasor={c}
              seviye={seviye + 1}
              santralId={santralId}
              onSecim={onSecim}
              seciliKlasorId={seciliKlasorId}
              onDegisiklik={onDegisiklik}
              aktifYol={aktifYol}
              setAktifYol={setAktifYol}
            />
          ))}
        </div>
      )}
    </div>
  );
}
