import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { istekAt, tokenAl, yoneticiMi, platformAdminMi } from "../../lib/api";
import UstBar from "../../components/UstBar";

/** Santralleri isletme_adi'na göre gruplar; backend zaten holding adına
 * göre alfabetik sıralı döndürdüğü için gruplar ve içindeki santraller
 * de otomatik sıralı çıkar. */
function holdinglereGoreGrupla(santraller) {
  const gruplar = [];
  const indeksler = {};
  for (const s of santraller) {
    if (!(s.isletme_id in indeksler)) {
      indeksler[s.isletme_id] = gruplar.length;
      gruplar.push({ isletme_id: s.isletme_id, isletme_adi: s.isletme_adi, santraller: [] });
    }
    gruplar[indeksler[s.isletme_id]].santraller.push(s);
  }
  return gruplar;
}

function bosForm() {
  return { isletme_id: "", ad: "", konum: "", kurulu_guc_mw: "", turbin_tipi: "" };
}

export default function SantrallerSayfasi() {
  const router = useRouter();
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;

  const [santraller, setSantraller] = useState(null);
  const [holdingler, setHoldingler] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [formuAcik, setFormuAcik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [taslak, setTaslak] = useState(bosForm());

  const verileriYukle = useCallback(async () => {
    try {
      const istekler = [istekAt("/api/v1/santraller")];
      if (platformAdmin) istekler.push(istekAt("/api/v1/isletmeler"));
      const sonuclar = await Promise.all(istekler);
      setSantraller(sonuclar[0].veri);
      if (platformAdmin) setHoldingler(sonuclar[1].veri);
    } catch (err) {
      setHata(err.message);
    }
  }, [platformAdmin]);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!yoneticiMi()) {
      router.replace("/gorevler");
      return;
    }
    verileriYukle();
  }, [verileriYukle, router]);

  async function santralEkle(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    setGonderiliyor(true);
    try {
      await istekAt("/api/v1/santraller", {
        method: "POST",
        body: JSON.stringify({
          ...taslak,
          kurulu_guc_mw: taslak.kurulu_guc_mw || undefined,
        }),
      });
      setBilgi("Santral oluşturuldu.");
      setTaslak(bosForm());
      setFormuAcik(false);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  const gruplar = santraller ? holdinglereGoreGrupla(santraller) : null;

  return (
    <>
      <Head>
        <title>Santraller — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Santraller</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {santraller && <span className="sayac">{santraller.length} santral</span>}
              {platformAdmin && (
                <button className="kucukButon" onClick={() => setFormuAcik((v) => !v)}>
                  {formuAcik ? "Vazgeç" : "+ Yeni Santral"}
                </button>
              )}
            </div>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {formuAcik && (
            <form onSubmit={santralEkle} className="yonetimFormu">
              <div className="alan">
                <label>Holding</label>
                <select
                  required
                  value={taslak.isletme_id}
                  onChange={(e) => setTaslak({ ...taslak, isletme_id: e.target.value })}
                >
                  <option value="">Seçin…</option>
                  {holdingler &&
                    holdingler.map((h) => (
                      <option key={h.isletme_id} value={h.isletme_id}>
                        {h.ad}
                      </option>
                    ))}
                </select>
              </div>
              <div className="alan">
                <label>Santral adı</label>
                <input
                  required
                  value={taslak.ad}
                  onChange={(e) => setTaslak({ ...taslak, ad: e.target.value })}
                  placeholder="Ör. Adıgüzel HES"
                />
              </div>
              <div className="alan">
                <label>Konum (isteğe bağlı)</label>
                <input value={taslak.konum} onChange={(e) => setTaslak({ ...taslak, konum: e.target.value })} />
              </div>
              <div className="alan">
                <label>Kurulu güç MW (isteğe bağlı)</label>
                <input
                  type="number"
                  step="0.01"
                  value={taslak.kurulu_guc_mw}
                  onChange={(e) => setTaslak({ ...taslak, kurulu_guc_mw: e.target.value })}
                />
              </div>
              <div className="alan">
                <label>Türbin tipi (isteğe bağlı)</label>
                <input
                  value={taslak.turbin_tipi}
                  onChange={(e) => setTaslak({ ...taslak, turbin_tipi: e.target.value })}
                  placeholder="Ör. Francis"
                />
              </div>
              <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                {gonderiliyor ? "Oluşturuluyor…" : "Santralı Oluştur"}
              </button>
            </form>
          )}

          {!santraller && !hata && <div className="yukleniyor">Yükleniyor…</div>}

          {gruplar &&
            gruplar.map((g) => (
              <div key={g.isletme_id} style={{ marginBottom: "28px" }}>
                <h3 className="holdingBasligi">{g.isletme_adi}</h3>
                {g.santraller.map((s) => (
                  <Link key={s.santral_id} href={`/santraller/${s.santral_id}`} className="santralKart">
                    <div className="gorevSantral">
                      {s.ad}
                      {s.durum !== "AKTIF" && (
                        <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>
                          {s.durum === "DEVRE_DISI" ? "Pasif" : s.durum}
                        </span>
                      )}
                    </div>
                    <div className="gorevAlt">
                      {s.konum} {s.turbin_tipi ? `— ${s.turbin_tipi}` : ""}{" "}
                      {s.kurulu_guc_mw ? `— ${s.kurulu_guc_mw} MW` : ""}
                    </div>
                  </Link>
                ))}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
