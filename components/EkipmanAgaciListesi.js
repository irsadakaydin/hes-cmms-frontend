import { useState, useEffect } from "react";
import { istekAt } from "../lib/api";

/**
 * Ekipman Oluştur sayfasındaki "Bu konumdaki ekipmanlar" listesi.
 *
 * - Seçili klasörün (ve TÜM alt klasörlerinin) ekipmanlarını, alt klasör
 *   yoluna göre gruplanmış ve katlanabilir şekilde gösterir. Klasör seçili
 *   değilse santraldeki tüm ekipmanlar gelir; hiçbir klasöre bağlı olmayan
 *   ekipmanlar ayrı bir "Konumsuz ekipmanlar" grubunda uyarıyla gösterilir.
 * - Bir ekipmana tıklayınca altında o ekipmanın bakım planları (şablon,
 *   periyot, başlangıç tarihi, sorumlular) açılır.
 * - Yalnızca OKUR; hiçbir kaydı değiştirmez. Liste yüklenemezse yalnızca bu
 *   bölümde bir hata mesajı gösterir, sayfadaki forma dokunmaz.
 *
 * yenilemeAnahtari: değiştiğinde (ör. yeni ekipman eklenince) liste yeniden çekilir.
 */

const PERIYOT_ETIKETLERI = {
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

function tarihGoster(deger) {
  return deger ? new Date(deger).toLocaleDateString("tr-TR") : "—";
}

function aramaEslesirMi(ekipman, arama) {
  if (!arama.trim()) return true;
  const aranan = arama.trim().toLocaleLowerCase("tr-TR");
  return [ekipman.ad, ekipman.tip, ekipman.unite_no]
    .filter(Boolean)
    .some((alan) => String(alan).toLocaleLowerCase("tr-TR").includes(aranan));
}

export default function EkipmanAgaciListesi({ santralId, klasorId, kokEtiketi, yenilemeAnahtari }) {
  const [veri, setVeri] = useState(null); // { veri: [...], konumsuz: [...] }
  const [hata, setHata] = useState(null);
  const [arama, setArama] = useState("");
  const [kapaliGruplar, setKapaliGruplar] = useState({});
  const [acikEkipmanId, setAcikEkipmanId] = useState(null);
  const [planlar, setPlanlar] = useState({}); // ekipman_id -> { yukleniyor } | { hata } | { liste }

  useEffect(() => {
    if (!santralId) return;
    let iptal = false;
    setVeri(null);
    setHata(null);
    setPlanlar({});
    setAcikEkipmanId(null);
    const sorgu = klasorId ? `?klasor_id=${encodeURIComponent(klasorId)}` : "";
    istekAt(`/api/v1/santraller/${santralId}/ekipman-agaci${sorgu}`)
      .then((sonuc) => {
        if (!iptal) setVeri(sonuc);
      })
      .catch((err) => {
        if (!iptal) setHata(err.message);
      });
    return () => {
      iptal = true;
    };
  }, [santralId, klasorId, yenilemeAnahtari]);

  function gruptaGoster(anahtar) {
    setKapaliGruplar((onceki) => ({ ...onceki, [anahtar]: !onceki[anahtar] }));
  }

  async function ekipmanTiklandi(ekipman) {
    if (acikEkipmanId === ekipman.ekipman_id) {
      setAcikEkipmanId(null);
      return;
    }
    setAcikEkipmanId(ekipman.ekipman_id);
    if (planlar[ekipman.ekipman_id]) return; // daha önce çekildi
    setPlanlar((o) => ({ ...o, [ekipman.ekipman_id]: { yukleniyor: true } }));
    try {
      const sonuc = await istekAt(`/api/v1/ekipmanlar/${ekipman.ekipman_id}/bakim-planlari`);
      setPlanlar((o) => ({ ...o, [ekipman.ekipman_id]: { liste: sonuc.veri } }));
    } catch (err) {
      setPlanlar((o) => ({ ...o, [ekipman.ekipman_id]: { hata: err.message } }));
    }
  }

  function ekipmanSatiri(ekipman) {
    const acik = acikEkipmanId === ekipman.ekipman_id;
    const plan = planlar[ekipman.ekipman_id];
    return (
      <div key={ekipman.ekipman_id} style={{ marginLeft: "14px", marginBottom: "4px" }}>
        <button
          type="button"
          className="periyotGrupBasligi"
          style={{ width: "100%", textAlign: "left" }}
          onClick={() => ekipmanTiklandi(ekipman)}
        >
          {acik ? "▾" : "▸"} {ekipman.unite_no ? `${ekipman.unite_no} ` : ""}
          {ekipman.ad}
          <span className="gorevAlt">
            {" "}
            — {ekipman.tip} · {Number(ekipman.plan_sayisi)} aktif plan
          </span>
          {ekipman.durum === "HURDA" && (
            <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>
              Pasif
            </span>
          )}
        </button>

        {acik && (
          <div style={{ marginLeft: "18px", marginTop: "4px" }}>
            {plan && plan.yukleniyor && <div className="yukleniyor">Yükleniyor…</div>}
            {plan && plan.hata && <div className="hataKutusu">{plan.hata}</div>}
            {plan && plan.liste && plan.liste.length === 0 && (
              <div className="bosDurum">Bu ekipmana bağlı bakım planı yok.</div>
            )}
            {plan &&
              plan.liste &&
              plan.liste.map((p) => (
                <div className="satirKart" key={p.plan_id}>
                  <div>
                    <strong>{PERIYOT_ETIKETLERI[p.periyot] || p.periyot}</strong> — {p.sablon_adi}
                    {!p.aktif_mi && (
                      <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>
                        Pasif
                      </span>
                    )}
                  </div>
                  <div className="gorevAlt">
                    Başlangıç: {tarihGoster(p.baslangic_tarihi)} · Sorumlu:{" "}
                    {(p.sorumlular || []).map((s) => s.ad_soyad).join(", ") || "—"}
                  </div>
                </div>
              ))}
            <div style={{ marginTop: "6px" }}>
              <a
                className="linkButon"
                href={`/bakim-plani-olustur?santral_id=${santralId}&ekipman_id=${ekipman.ekipman_id}`}
              >
                + Bu ekipman için bakım planı oluştur
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!santralId) return null;

  const tumEkipmanlar = veri ? veri.veri : [];
  const konumsuz = veri && veri.konumsuz ? veri.konumsuz : [];
  const filtreli = tumEkipmanlar.filter((e) => aramaEslesirMi(e, arama));
  const konumsuzFiltreli = konumsuz.filter((e) => aramaEslesirMi(e, arama));

  // Sunucu zaten alt_yol'a göre sıralı gönderiyor; Map ekleme sırasını korur.
  const gruplar = new Map();
  for (const e of filtreli) {
    const anahtar = e.alt_yol || "";
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(e);
  }

  const toplam = tumEkipmanlar.length + konumsuz.length;
  const baslik = klasorId
    ? `${kokEtiketi || "Seçili konum"} — tüm ekipmanlar (alt klasörler dahil)`
    : "Santraldeki tüm ekipmanlar";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>{baslik}</h3>
        {veri && <span className="gorevAlt">{toplam} ekipman</span>}
      </div>

      {hata && <div className="hataKutusu" style={{ marginTop: "8px" }}>{hata}</div>}
      {!veri && !hata && <div className="yukleniyor">Yükleniyor…</div>}

      {veri && toplam > 0 && (
        <div className="alan" style={{ marginTop: "10px" }}>
          <label>Ekipman adı / tipi / ünite ara</label>
          <input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Ara…" />
        </div>
      )}

      {veri && toplam === 0 && <div className="bosDurum">Bu konum için henüz ekipman oluşturulmamış.</div>}
      {veri && toplam > 0 && filtreli.length === 0 && konumsuzFiltreli.length === 0 && (
        <div className="bosDurum">Aramayla eşleşen ekipman yok.</div>
      )}

      {[...gruplar.entries()].map(([anahtar, liste]) => {
        const grupAdi = anahtar === "" ? kokEtiketi || "Bu konum" : anahtar;
        const kapali = !!kapaliGruplar[anahtar];
        return (
          <div key={`grup-${anahtar}`} style={{ marginTop: "10px" }}>
            <button
              type="button"
              className="periyotGrupBasligi"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => gruptaGoster(anahtar)}
            >
              {kapali ? "▸" : "▾"} {grupAdi} ({liste.length})
            </button>
            {!kapali && liste.map(ekipmanSatiri)}
          </div>
        );
      })}

      {konumsuzFiltreli.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <button
            type="button"
            className="periyotGrupBasligi"
            style={{ width: "100%", textAlign: "left" }}
            onClick={() => gruptaGoster("__konumsuz__")}
          >
            {kapaliGruplar["__konumsuz__"] ? "▸" : "▾"} Konumsuz ekipmanlar ({konumsuzFiltreli.length})
          </button>
          {!kapaliGruplar["__konumsuz__"] && (
            <>
              <div className="kutuphaneBosUyari" style={{ margin: "6px 0 6px 14px" }}>
                ⚠ Bu ekipmanlar bir klasöre bağlı değil; klasör ağacında görünmezler ve şablon klasör üzerinden
                bağlanamaz.
              </div>
              {konumsuzFiltreli.map(ekipmanSatiri)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
