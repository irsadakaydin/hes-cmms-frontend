import { useState, useEffect, useCallback } from "react";
import { istekAt } from "../lib/api";

/**
 * Klasör Gezgini — santral altındaki hiyerarşik ekipman/periyot klasör
 * ağacını, dosya gezgini benzeri, yumuşak geçişli AÇILIR/KAPANIR bir
 * ağaç olarak gösterir. Bir düğüme tıklamak onu YERİNDE genişletir (yeni
 * bir sayfaya/karta geçmez), tekrar tıklamak kapatır. Alt düğümler ilk
 * açılışta (lazy) çekilir.
 *
 * mod="ekipman"  → yalnızca PERİYOT OLMAYAN düğümler seçilebilir (ekipman
 *                  buraya bağlanır, tipik olarak bir "Ünite" düzeyi).
 * mod="sablon"   → yalnızca PERİYOT YAPRAKLARI (Haftalık/Aylık/vb.)
 *                  seçilebilir (şablon buraya yüklenir).
 */
export default function KlasorGezgini({ santralId, santralAdi, mod, onSecim, seciliKlasorId }) {
  const [kokDugumler, setKokDugumler] = useState(null);
  const [hata, setHata] = useState(null);
  const [kurulumOneriliyor, setKurulumOneriliyor] = useState(false);
  const [kuruluyor, setKuruluyor] = useState(false);
  const [kokYeniKlasorAcik, setKokYeniKlasorAcik] = useState(false);
  const [yenilemeSayaci, setYenilemeSayaci] = useState(0);

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

  // santralId değiştiğinde ya da dışarıdan tetiklenen bir yenilemede kökü
  // yeniden çek.
  const anahtarli = `${santralId || ""}-${yenilemeSayaci}`;
  useEffect(() => {
    kokleriGetir();
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

  async function kokYeniKlasorEkle(ad, periyot_tipi) {
    await istekAt(`/api/v1/santraller/${santralId}/klasorler`, {
      method: "POST",
      body: JSON.stringify({ ust_klasor_id: null, ad, periyot_tipi }),
    });
    setKokYeniKlasorAcik(false);
    await kokleriGetir();
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

      {kokDugumler && kokDugumler.length > 0 && (
        <div className="agacGovde">
          {kokDugumler.map((k) => (
            <KlasorDugumu
              key={k.klasor_id}
              klasor={k}
              seviye={0}
              santralId={santralId}
              mod={mod}
              onSecim={onSecim}
              seciliKlasorId={seciliKlasorId}
              onDegisiklik={() => setYenilemeSayaci((n) => n + 1)}
            />
          ))}
        </div>
      )}

      {(
        <YeniKlasorSatiri
          etiket={`Bu seviyeye eklenir: ${santralAdi || "Kök"}`}
          acikMi={kokYeniKlasorAcik}
          setAcikMi={setKokYeniKlasorAcik}
          onEkle={kokYeniKlasorEkle}
        />
      )}
    </div>
  );
}

function secilebilirMi(mod, klasor) {
  if (mod === "sablon") return !!klasor.periyot_tipi;
  return !klasor.periyot_tipi;
}

/** Ağaçtaki tek bir düğüm — kendi açık/kapalı durumunu ve (lazy) alt
 * düğümlerini yönetir; açılıp kapanması CSS ile yumuşak geçişlidir. */
function KlasorDugumu({ klasor, seviye, santralId, mod, onSecim, seciliKlasorId, onDegisiklik }) {
  const [acik, setAcik] = useState(false);
  const [cocuklar, setCocuklar] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yeniKlasorAcik, setYeniKlasorAcik] = useState(false);
  const [hata, setHata] = useState(null);

  const secilebilir = secilebilirMi(mod, klasor);
  const terminalMi = mod === "ekipman" && klasor.alt_periyot_mu;

  async function cocuklariGetirVeAc() {
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
    setAcik(true);
  }

  function satiraTiklaninca() {
    // Ekipman modunda, bu düğümün altı doğrudan periyot yapraklarıysa
    // (standart HES ağacındaki bir "Ünite" düğümü) açmanın bir anlamı
    // yok — doğrudan seç.
    if (terminalMi) {
      if (secilebilir) onSecim(klasor);
      return;
    }
    if (acik) {
      setAcik(false);
    } else {
      cocuklariGetirVeAc();
    }
  }

  async function klasoruSil() {
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

  async function yeniAltKlasorEkle(ad, periyot_tipi) {
    await istekAt(`/api/v1/santraller/${santralId}/klasorler`, {
      method: "POST",
      body: JSON.stringify({ ust_klasor_id: klasor.klasor_id, ad, periyot_tipi }),
    });
    setYeniKlasorAcik(false);
    setCocuklar(null);
    await cocuklariGetirVeAc();
  }

  return (
    <div className="agacDugumu">
      {hata && (
        <div className="hataKutusu" style={{ marginLeft: seviye * 20 }}>
          {hata}
        </div>
      )}
      <div className="agacSatiri" style={{ paddingLeft: `${seviye * 20}px` }}>
        <button
          type="button"
          className={`agacSatirButonu ${seciliKlasorId === klasor.klasor_id ? "agacSatirButonuSecili" : ""}`}
          onClick={satiraTiklaninca}
        >
          <span className={`agacOk ${acik ? "agacOkAcik" : ""} ${terminalMi ? "agacOkGizli" : ""}`}>›</span>
          <svg className="agacKlasorIkon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 6.5C3 5.67 3.67 5 4.5 5H9.5L11.5 7H19.5C20.33 7 21 7.67 21 8.5V17.5C21 18.33 20.33 19 19.5 19H4.5C3.67 19 3 18.33 3 17.5V6.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span className="agacAd">{klasor.ad}</span>
          {klasor.periyot_tipi && <span className="agacEtiket">periyot</span>}
          {mod === "ekipman" && Number(klasor.ekipman_sayisi) > 0 && (
            <span className="agacEtiket">{klasor.ekipman_sayisi} ekipman</span>
          )}
          {mod === "sablon" && klasor.periyot_tipi && Number(klasor.sablon_sayisi) > 0 && (
            <span className="agacEtiket">{klasor.sablon_sayisi} şablon</span>
          )}
        </button>
        {secilebilir && (
          <button
            type="button"
            className={seciliKlasorId === klasor.klasor_id ? "klasorSecButonAktif" : "klasorSecButon"}
            onClick={() => onSecim(klasor)}
          >
            {seciliKlasorId === klasor.klasor_id ? "✓ Seçili" : "Bunu Seç"}
          </button>
        )}
        <button type="button" className="klasorSilButon" onClick={klasoruSil} title="Klasörü sil">
          🗑
        </button>
      </div>

      <div className={`agacAltSarmalayici ${acik ? "agacAltSarmalayiciAcik" : ""}`}>
        <div className="agacAltIcerik">
          {yukleniyor && (
            <div className="yukleniyor" style={{ paddingLeft: `${(seviye + 1) * 20}px` }}>
              Yükleniyor…
            </div>
          )}
          {cocuklar &&
            cocuklar.map((c) => (
              <KlasorDugumu
                key={c.klasor_id}
                klasor={c}
                seviye={seviye + 1}
                santralId={santralId}
                mod={mod}
                onSecim={onSecim}
                seciliKlasorId={seciliKlasorId}
                onDegisiklik={onDegisiklik}
              />
            ))}
          {cocuklar && (
            <div style={{ paddingLeft: `${(seviye + 1) * 20}px` }}>
              <YeniKlasorSatiri
                etiket={`Bu seviyeye eklenir: ${klasor.ad}`}
                acikMi={yeniKlasorAcik}
                setAcikMi={setYeniKlasorAcik}
                onEkle={yeniAltKlasorEkle}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** "+ Yeni Klasör Ekle" satırı — hem kök seviyede hem her düğümün altında
 * kullanılan ortak parça. */
const PERIYOT_SECENEKLERI = {
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

function YeniKlasorSatiri({ etiket, acikMi, setAcikMi, onEkle }) {
  const [ad, setAd] = useState("");
  const [periyot, setPeriyot] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder(e) {
    e.preventDefault();
    if (!ad.trim()) return;
    setGonderiliyor(true);
    try {
      await onEkle(ad.trim(), periyot || null);
      setAd("");
      setPeriyot("");
    } finally {
      setGonderiliyor(false);
    }
  }

  if (!acikMi) {
    return (
      <button type="button" className="klasorEkleButon" onClick={() => setAcikMi(true)}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="15" height="15">
          <path
            d="M3 6.5C3 5.67 3.67 5 4.5 5H9.5L11.5 7H19.5C20.33 7 21 7.67 21 8.5V17.5C21 18.33 20.33 19 19.5 19H4.5C3.67 19 3 18.33 3 17.5V6.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M12 10.5V15.5M9.5 13H14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Yeni Klasör Ekle
      </button>
    );
  }

  return (
    <form onSubmit={gonder} style={{ display: "flex", gap: "8px", alignItems: "flex-end", marginTop: "4px" }}>
      <div className="alan" style={{ flex: 1, marginBottom: 0 }}>
        <label>Yeni klasör adı ({etiket})</label>
        <input
          autoFocus
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          placeholder="Ör. Ünite 5, ya da yeni bir ekipman grubu…"
        />
      </div>
      <div className="alan" style={{ width: "190px", marginBottom: 0 }}>
        <label>Periyot (bu bir periyot yaprağıysa)</label>
        <select value={periyot} onChange={(e) => setPeriyot(e.target.value)}>
          <option value="">— Sadece klasör —</option>
          {Object.entries(PERIYOT_SECENEKLERI).map(([deger, ad2]) => (
            <option key={deger} value={deger}>
              {ad2}
            </option>
          ))}
        </select>
      </div>
      <button className="birincilButon" style={{ width: "auto" }} disabled={gonderiliyor}>
        Ekle
      </button>
      <button
        type="button"
        className="kucukButon"
        style={{ background: "var(--ink-soft)" }}
        onClick={() => setAcikMi(false)}
      >
        Vazgeç
      </button>
    </form>
  );
}
