import { useState, useEffect, useCallback } from "react";
import { istekAt } from "../lib/api";

/**
 * Ekipman Listesi için özel klasör ağacı — "Oto Bakım Planla" sayfasındaki
 * gibi sade, tek satırlık akordeon listesi. Ayrı bir "Bunu Seç" düğmesi
 * yok: bir klasöre tıklamak hem içine girer (varsa alt klasörleri gösterir)
 * hem de o klasörü ANINDA seçer (o klasördeki ekipmanları listeler) —
 * tıkladığınız an zaten seçmiş olursunuz.
 *
 * klasorEklenebilir (isteğe bağlı, varsayılan false): true verilirse ağaçta
 * "Yeni Klasör Ekle" satırı çıkar — santralde hiç klasör yokken kök klasör,
 * aksi halde o an açık olan EN DERİN klasörün içine. Bu satırda <form>
 * KULLANILMAZ: bu bileşen, Ekipman Oluştur sayfasında zaten bir <form>'un
 * içinde durur; iç içe form geçersizdir ve klasör adında Enter'a basmak
 * dıştaki formu göndermeye çalışırdı. Yeni klasörler periyot yaprağı
 * OLMAYAN düz klasörlerdir (periyot yaprakları, Bakım Şablonları
 * sayfasında periyot seçilince kendiliğinden oluşur).
 */
export default function EkipmanKlasorAgaci({ santralId, santralAdi, onSecim, seciliKlasorId, klasorEklenebilir = false }) {
  const [kokDugumler, setKokDugumler] = useState(null);
  const [hata, setHata] = useState(null);
  const [kurulumOneriliyor, setKurulumOneriliyor] = useState(false);
  const [kuruluyor, setKuruluyor] = useState(false);
  const [yenilemeSayaci, setYenilemeSayaci] = useState(0);
  const [aktifYol, setAktifYol] = useState([]);
  const [kokYeniKlasorAcik, setKokYeniKlasorAcik] = useState(false);

  const kokleriGetir = useCallback(async () => {
    if (!santralId) return;
    setKokDugumler(null);
    setHata(null);
    try {
      const veri = await istekAt(`/api/v1/santraller/${santralId}/klasorler`);
      const filtreli = veri.veri.filter((k) => !k.periyot_tipi);
      setKokDugumler(filtreli);
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

  // Kök seviyeye yeni klasör ekler. Başarılıysa true, hata olursa false
  // döner (hata, ağacın üstünde gösterilir; yazılan ad silinmez).
  async function kokYeniKlasorEkle(ad) {
    setHata(null);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/klasorler`, {
        method: "POST",
        body: JSON.stringify({ ust_klasor_id: null, ad, periyot_tipi: null }),
      });
      setKokYeniKlasorAcik(false);
      await kokleriGetir();
      return true;
    } catch (err) {
      setHata(err.message);
      return false;
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
            klasorEklenebilir={klasorEklenebilir}
          />
        ))}

      {klasorEklenebilir && kokDugumler && aktifYol.length === 0 && (
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

function EkipmanKlasorSatiri({
  klasor,
  seviye,
  santralId,
  onSecim,
  seciliKlasorId,
  onDegisiklik,
  aktifYol,
  setAktifYol,
  klasorEklenebilir,
}) {
  const [cocuklar, setCocuklar] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yeniKlasorAcik, setYeniKlasorAcik] = useState(false);
  const [hata, setHata] = useState(null);

  const acik = aktifYol[seviye] === klasor.klasor_id;
  const enDerinAcik = acik && aktifYol.length === seviye + 1;
  const secilebilir = !klasor.periyot_tipi;

  async function cocuklariYukle() {
    setYukleniyor(true);
    try {
      const veri = await istekAt(`/api/v1/santraller/${santralId}/klasorler?ust_klasor_id=${klasor.klasor_id}`);
      setCocuklar(veri.veri.filter((c) => !c.periyot_tipi));
    } catch (err) {
      setHata(err.message);
    } finally {
      setYukleniyor(false);
    }
  }

  async function tiklaninca() {
    if (secilebilir) onSecim(klasor);
    if (klasor.periyot_tipi) return; // periyot yaprağının altı yok
    if (acik) {
      setAktifYol((y) => y.slice(0, seviye));
      return;
    }
    setAktifYol((y) => [...y.slice(0, seviye), klasor.klasor_id]);
    if (cocuklar === null) {
      await cocuklariYukle();
    }
  }

  // Bu klasörün içine yeni alt klasör ekler. Başarılıysa true, hata olursa
  // false döner (yazılan ad silinmez).
  async function yeniAltKlasorEkle(ad) {
    setHata(null);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/klasorler`, {
        method: "POST",
        body: JSON.stringify({ ust_klasor_id: klasor.klasor_id, ad, periyot_tipi: null }),
      });
      setYeniKlasorAcik(false);
      await cocuklariYukle();
      return true;
    } catch (err) {
      setHata(err.message);
      return false;
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
              klasorEklenebilir={klasorEklenebilir}
            />
          ))}
          {klasorEklenebilir && enDerinAcik && (
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
      )}
    </div>
  );
}

/** "Yeni Klasör Ekle" satırı. DİKKAT: <form> içermez ve tüm düğmeleri
 * type="button"dır — bu bileşen Ekipman Oluştur'daki bir <form>'un içinde
 * kullanılır; Enter tuşu da burada yakalanıp dıştaki formun gönderilmesi
 * engellenir. onEkle(ad) başarılıysa true, hata olursa false döndürmelidir. */
function YeniKlasorSatiri({ etiket, acikMi, setAcikMi, onEkle }) {
  const [ad, setAd] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  async function gonder() {
    if (!ad.trim() || gonderiliyor) return;
    setGonderiliyor(true);
    const basarili = await onEkle(ad.trim());
    setGonderiliyor(false);
    if (basarili) setAd("");
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
    <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", marginTop: "4px" }}>
      <div className="alan" style={{ flex: 1, marginBottom: 0 }}>
        <label>Yeni klasör adı ({etiket})</label>
        <input
          autoFocus
          value={ad}
          onChange={(e) => setAd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // dıştaki formun gönderilmesini engelle
              gonder();
            } else if (e.key === "Escape") {
              setAcikMi(false);
            }
          }}
          placeholder="Ör. Ünite 1, Pompa Grubu, Elektrik Panoları…"
        />
      </div>
      <button
        type="button"
        className="birincilButon"
        style={{ width: "auto" }}
        disabled={gonderiliyor}
        onClick={gonder}
      >
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
    </div>
  );
}
