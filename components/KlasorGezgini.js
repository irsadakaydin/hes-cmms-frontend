import { useState, useEffect, useCallback } from "react";
import { istekAt } from "../lib/api";

/**
 * Klasör Gezgini — santral altındaki hiyerarşik ekipman/periyot klasör
 * ağacında gezinmeyi sağlar. Aynı anda tek bir seviyeyi listeler (hepsi alt
 * alta dökülmez), üst klasöre dönmek için breadcrumb kullanılır.
 *
 * mod="ekipman"  → yalnızca PERİYOT OLMAYAN düğümler seçilebilir (ekipman
 *                  buraya bağlanır, tipik olarak bir "Ünite" düzeyi).
 * mod="sablon"   → yalnızca PERİYOT YAPRAKLARI (Haftalık/Aylık/vb.)
 *                  seçilebilir (şablon buraya yüklenir).
 *
 * onSecim(klasor) — kullanıcı uygun bir düğümü seçtiğinde çağrılır.
 */
export default function KlasorGezgini({ santralId, mod, onSecim, seciliKlasorId }) {
  const [yol, setYol] = useState([]); // breadcrumb: [{klasor_id, ad}, ...]
  const [cocuklar, setCocuklar] = useState(null);
  const [hata, setHata] = useState(null);
  const [yeniKlasorAcik, setYeniKlasorAcik] = useState(false);
  const [yeniKlasorAdi, setYeniKlasorAdi] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [kurulumOneriliyor, setKurulumOneriliyor] = useState(false);

  const suankiKlasorId = yol.length > 0 ? yol[yol.length - 1].klasor_id : null;

  const cocuklariGetir = useCallback(
    async (ustId) => {
      if (!santralId) return;
      setCocuklar(null);
      setHata(null);
      try {
        const p = ustId ? `?ust_klasor_id=${ustId}` : "";
        const veri = await istekAt(`/api/v1/santraller/${santralId}/klasorler${p}`);
        setCocuklar(veri.veri);
        setKurulumOneriliyor(!ustId && veri.veri.length === 0);
      } catch (err) {
        setHata(err.message);
      }
    },
    [santralId]
  );

  useEffect(() => {
    setYol([]);
    cocuklariGetir(null);
  }, [santralId, cocuklariGetir]);

  function icineGir(klasor) {
    setYol((y) => [...y, { klasor_id: klasor.klasor_id, ad: klasor.ad }]);
    cocuklariGetir(klasor.klasor_id);
    setYeniKlasorAcik(false);
  }

  function breadcrumbaGit(index) {
    // index=-1 → kök
    const yeniYol = index < 0 ? [] : yol.slice(0, index + 1);
    setYol(yeniYol);
    cocuklariGetir(yeniYol.length > 0 ? yeniYol[yeniYol.length - 1].klasor_id : null);
    setYeniKlasorAcik(false);
  }

  function secilebilirMi(klasor) {
    if (mod === "sablon") return !!klasor.periyot_tipi;
    return !klasor.periyot_tipi; // ekipman modunda periyot yaprakları seçilemez
  }

  async function yeniKlasorEkle(e) {
    e.preventDefault();
    if (!yeniKlasorAdi.trim()) return;
    setGonderiliyor(true);
    setHata(null);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/klasorler`, {
        method: "POST",
        body: JSON.stringify({ ust_klasor_id: suankiKlasorId, ad: yeniKlasorAdi.trim() }),
      });
      setYeniKlasorAdi("");
      setYeniKlasorAcik(false);
      await cocuklariGetir(suankiKlasorId);
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function standartAgaciKur() {
    setGonderiliyor(true);
    setHata(null);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/klasor-agaci-yukle`, { method: "POST" });
      await cocuklariGetir(null);
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <div className="yonetimFormu" style={{ background: "var(--surface)" }}>
      {hata && <div className="hataKutusu">{hata}</div>}

      <div style={{ marginBottom: "10px", fontSize: "13.5px" }}>
        <button
          type="button"
          className="linkButon"
          style={{ fontWeight: yol.length === 0 ? 700 : 400 }}
          onClick={() => breadcrumbaGit(-1)}
        >
          Kök
        </button>
        {yol.map((k, i) => (
          <span key={k.klasor_id}>
            {" "}
            /{" "}
            <button
              type="button"
              className="linkButon"
              style={{ fontWeight: i === yol.length - 1 ? 700 : 400 }}
              onClick={() => breadcrumbaGit(i)}
            >
              {k.ad}
            </button>
          </span>
        ))}
      </div>

      {kurulumOneriliyor && (
        <div className="bosDurum" style={{ marginBottom: "10px" }}>
          Bu santralde henüz klasör yok.{" "}
          <button type="button" className="linkButon" onClick={standartAgaciKur} disabled={gonderiliyor}>
            {gonderiliyor ? "Kuruluyor…" : "Standart HES klasör ağacını kur"}
          </button>
        </div>
      )}

      {!cocuklar && !kurulumOneriliyor && <div className="yukleniyor">Yükleniyor…</div>}

      {cocuklar && cocuklar.length > 0 && (
        <div>
          {cocuklar.map((k) => (
            <div
              key={k.klasor_id}
              className="satirKart"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: seciliKlasorId === k.klasor_id ? "var(--paper)" : undefined,
              }}
            >
              <div>
                <strong>{k.ad}</strong>
                {k.periyot_tipi && <span className="gorevAlt"> — periyot yaprağı</span>}
                {mod === "ekipman" && Number(k.ekipman_sayisi) > 0 && (
                  <span className="gorevAlt"> · {k.ekipman_sayisi} ekipman bağlı</span>
                )}
                {mod === "sablon" && k.periyot_tipi && Number(k.sablon_sayisi) > 0 && (
                  <span className="gorevAlt"> · {k.sablon_sayisi} şablon var</span>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {secilebilirMi(k) && (
                  <button type="button" className="linkButon" onClick={() => onSecim(k)}>
                    {seciliKlasorId === k.klasor_id ? "✓ Seçili" : "Bunu Seç"}
                  </button>
                )}
                {Number(k.alt_sayisi) > 0 && (
                  <button type="button" className="linkButon" onClick={() => icineGir(k)}>
                    İçine Gir ({k.alt_sayisi}) →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {cocuklar && cocuklar.length === 0 && !kurulumOneriliyor && (
        <div className="bosDurum">Bu klasörün altında başka klasör yok.</div>
      )}

      {!kurulumOneriliyor && (
        <div style={{ marginTop: "10px" }}>
          {!yeniKlasorAcik ? (
            <button type="button" className="linkButon" onClick={() => setYeniKlasorAcik(true)}>
              + Yeni Klasör Ekle
            </button>
          ) : (
            <form onSubmit={yeniKlasorEkle} style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <div className="alan" style={{ flex: 1, marginBottom: 0 }}>
                <label>Yeni klasör adı (bu seviyeye eklenir: {yol.length > 0 ? yol[yol.length - 1].ad : "Kök"})</label>
                <input
                  autoFocus
                  value={yeniKlasorAdi}
                  onChange={(e) => setYeniKlasorAdi(e.target.value)}
                  placeholder="Ör. Ünite 5, ya da yeni bir ekipman grubu…"
                />
              </div>
              <button className="birincilButon" style={{ width: "auto" }} disabled={gonderiliyor}>
                Ekle
              </button>
              <button
                type="button"
                className="kucukButon"
                style={{ background: "var(--ink-soft)" }}
                onClick={() => setYeniKlasorAcik(false)}
              >
                Vazgeç
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
