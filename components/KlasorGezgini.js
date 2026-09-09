import { useState, useEffect, useCallback } from "react";
import { istekAt } from "../lib/api";

/**
 * Klasör Gezgini — santral altındaki hiyerarşik ekipman/periyot klasör
 * ağacında gezinmeyi sağlar. Her seviye, soldan sağa dizilmiş sabit,
 * yumuşak geçişli kartlar olarak gösterilir. Bir karta tıklamak doğrudan
 * içine girer; kartın altındaki "Bunu Seç" ise (yalnızca uygun kartlarda)
 * o düğümü seçer. Üst seviyeye dönmek için breadcrumb kullanılır — en
 * baştaki isim santralin adıdır.
 *
 * mod="ekipman"  → yalnızca PERİYOT OLMAYAN düğümler seçilebilir.
 * mod="sablon"   → yalnızca PERİYOT YAPRAKLARI seçilebilir.
 */
export default function KlasorGezgini({ santralId, santralAdi, mod, onSecim, seciliKlasorId, gorunum }) {
  const listeGorunumu = gorunum === "liste";
  const [yol, setYol] = useState([]); // breadcrumb: [{klasor_id, ad}, ...]
  const [cocuklar, setCocuklar] = useState(null);
  const [hata, setHata] = useState(null);
  const [yeniKlasorAcik, setYeniKlasorAcik] = useState(false);
  const [yeniKlasorAdi, setYeniKlasorAdi] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [kurulumOneriliyor, setKurulumOneriliyor] = useState(false);

  const suankiKlasorId = yol.length > 0 ? yol[yol.length - 1].klasor_id : null;
  const kokAdi = santralAdi || "Santral";

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
    // index=-1 → kök (santral)
    const yeniYol = index < 0 ? [] : yol.slice(0, index + 1);
    setYol(yeniYol);
    cocuklariGetir(yeniYol.length > 0 ? yeniYol[yeniYol.length - 1].klasor_id : null);
    setYeniKlasorAcik(false);
  }

  function secilebilirMi(klasor) {
    if (mod === "sablon") return !!klasor.periyot_tipi;
    return !klasor.periyot_tipi;
  }

  function kartaTiklaninca(k) {
    // Ekipman modunda, bu düğümün altı doğrudan periyot yapraklarıysa
    // (Haftalık/Aylık/vb. — standart HES ağacındaki bir "Ünite" düğümü)
    // oraya inmenin bir anlamı yok — burada dur ve düğümün kendisini seç.
    if (mod === "ekipman" && k.alt_periyot_mu) {
      if (secilebilirMi(k)) onSecim(k);
      return;
    }
    // DİĞER TÜM durumlarda tıklama HER ZAMAN içine girer — alt klasörü
    // henüz hiç olmayan (yeni oluşturulmuş, boş) bir klasör için de aynı
    // şekilde: aksi halde boş bir klasörün içine girip alt klasör eklemek
    // imkansız olurdu. Doğrudan seçmek isteyen "Bunu Seç" düğmesini kullanır.
    icineGir(k);
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

  async function klasoruSil(k) {
    if (!confirm(`"${k.ad}" klasörünü silmek istediğinize emin misiniz? Altındaki tüm alt klasörler de silinecek.`)) {
      return;
    }
    setHata(null);
    try {
      await istekAt(`/api/v1/klasorler/${k.klasor_id}`, { method: "DELETE" });
      await cocuklariGetir(suankiKlasorId);
    } catch (err) {
      if (err.hata_kodu === "KLASOR_DOLU") {
        if (confirm(err.message)) {
          try {
            await istekAt(`/api/v1/klasorler/${k.klasor_id}?zorla=1`, { method: "DELETE" });
            await cocuklariGetir(suankiKlasorId);
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
    <div className="yonetimFormu" style={{ background: "var(--surface)" }}>
      {hata && <div className="hataKutusu">{hata}</div>}

      <div className="klasorBreadcrumb">
        <button
          type="button"
          className={yol.length === 0 ? "klasorBreadcrumbAktif" : "klasorBreadcrumbAdim"}
          onClick={() => breadcrumbaGit(-1)}
        >
          {kokAdi}
        </button>
        {yol.map((k, i) => (
          <span key={k.klasor_id} style={{ display: "inline-flex", alignItems: "center" }}>
            <span className="klasorBreadcrumbAyrac">/</span>
            <button
              type="button"
              className={i === yol.length - 1 ? "klasorBreadcrumbAktif" : "klasorBreadcrumbAdim"}
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

      {cocuklar && cocuklar.length > 0 && listeGorunumu && (
        <div>
          {cocuklar.map((k) => (
            <div key={k.klasor_id} style={{ marginBottom: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="periyotGrupBasligi"
                  style={{ flex: 1, textAlign: "left", fontWeight: seciliKlasorId === k.klasor_id ? 700 : 500 }}
                  onClick={() => kartaTiklaninca(k)}
                >
                  {mod === "ekipman" && k.alt_periyot_mu
                    ? seciliKlasorId === k.klasor_id
                      ? "▾"
                      : "▸"
                    : Number(k.alt_sayisi) > 0
                    ? "▸"
                    : "·"}{" "}
                  {k.ad}
                  {mod === "ekipman" && Number(k.ekipman_sayisi) > 0 && ` (${k.ekipman_sayisi} ekipman)`}
                  {mod === "sablon" && k.periyot_tipi && Number(k.sablon_sayisi) > 0 && ` (${k.sablon_sayisi} şablon)`}
                </button>
                {secilebilirMi(k) && seciliKlasorId !== k.klasor_id && (
                  <button type="button" className="klasorSecButon" onClick={() => onSecim(k)}>
                    Bunu Seç
                  </button>
                )}
                <button type="button" className="klasorSilButon" onClick={() => klasoruSil(k)} title="Klasörü sil">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cocuklar && cocuklar.length > 0 && !listeGorunumu && (
        <div className="klasorKartIzgara">
          {cocuklar.map((k) => (
            <div key={k.klasor_id} className="klasorKart">
              <button
                type="button"
                className={`klasorKartGovde ${seciliKlasorId === k.klasor_id ? "klasorKartGovdeSecili" : ""}`}
                onClick={() => kartaTiklaninca(k)}
                title={
                  mod === "ekipman" && k.alt_periyot_mu
                    ? "Bu ekipmanı seçmek için tıklayın"
                    : "İçine girmek için tıklayın"
                }
              >
                <svg className="klasorKartIkon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M3 6.5C3 5.67 3.67 5 4.5 5H9.5L11.5 7H19.5C20.33 7 21 7.67 21 8.5V17.5C21 18.33 20.33 19 19.5 19H4.5C3.67 19 3 18.33 3 17.5V6.5Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="klasorKartAd">{k.ad}</span>
                {k.periyot_tipi && <span className="klasorKartEtiket">periyot</span>}
                {mod === "ekipman" && Number(k.ekipman_sayisi) > 0 && (
                  <span className="klasorKartEtiket">{k.ekipman_sayisi} ekipman</span>
                )}
                {mod === "sablon" && k.periyot_tipi && Number(k.sablon_sayisi) > 0 && (
                  <span className="klasorKartEtiket">{k.sablon_sayisi} şablon</span>
                )}
              </button>
              {secilebilirMi(k) && (
                <button
                  type="button"
                  className={seciliKlasorId === k.klasor_id ? "klasorSecButonAktif" : "klasorSecButon"}
                  onClick={() => onSecim(k)}
                >
                  {seciliKlasorId === k.klasor_id ? "✓ Seçili" : "Bunu Seç"}
                </button>
              )}
              <button type="button" className="klasorSilButon" onClick={() => klasoruSil(k)} title="Klasörü sil">
                🗑 Klasörü Sil
              </button>
            </div>
          ))}
        </div>
      )}

      {cocuklar && cocuklar.length === 0 && !kurulumOneriliyor && (
        <div className="bosDurum">Bu klasörün altında başka klasör yok.</div>
      )}

      {(
        <div style={{ marginTop: "10px" }}>
          {!yeniKlasorAcik ? (
            <button type="button" className="linkButon" onClick={() => setYeniKlasorAcik(true)}>
              + Yeni Klasör Ekle
            </button>
          ) : (
            <form onSubmit={yeniKlasorEkle} style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <div className="alan" style={{ flex: 1, marginBottom: 0 }}>
                <label>Yeni klasör adı (bu seviyeye eklenir: {yol.length > 0 ? yol[yol.length - 1].ad : kokAdi})</label>
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
