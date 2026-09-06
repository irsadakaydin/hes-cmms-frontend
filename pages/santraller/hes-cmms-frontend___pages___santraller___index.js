import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { istekAt, tokenAl, yoneticiMi, platformAdminMi } from "../../lib/api";
import UstBar from "../../components/UstBar";

function bosForm() {
  return { isletme_id: "", ad: "", konum: "", kurulu_guc_mw: "", turbin_tipi: "" };
}

export default function SantrallerSayfasi() {
  const router = useRouter();
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;

  const [santraller, setSantraller] = useState(null);
  const [holdingler, setHoldingler] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
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
        body: JSON.stringify({ ...taslak, kurulu_guc_mw: taslak.kurulu_guc_mw || undefined }),
      });
      setBilgi("Santral oluşturuldu.");
      setTaslak({ ...bosForm(), isletme_id: seciliHoldingId });
      setFormuAcik(false);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  // Platform Admin için: holding seçilmeden hiçbir santral listelenmez —
  // tüm holdinglerin santralleri bir arada, karışık görünmesin diye.
  const gosterilecekSantraller = platformAdmin
    ? (santraller || []).filter((s) => s.isletme_id === seciliHoldingId)
    : santraller;

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
              {!platformAdmin && santraller && <span className="sayac">{santraller.length} santral</span>}
              {platformAdmin && (
                <button
                  className="kucukButon"
                  onClick={() => {
                    setTaslak({ ...bosForm(), isletme_id: seciliHoldingId });
                    setFormuAcik((v) => !v);
                  }}
                >
                  {formuAcik ? "Vazgeç" : "+ Yeni Santral"}
                </button>
              )}
            </div>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {platformAdmin && (
            <div className="alan" style={{ maxWidth: "340px" }}>
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
            </div>
          )}

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
                <input required value={taslak.ad} onChange={(e) => setTaslak({ ...taslak, ad: e.target.value })} />
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
                />
              </div>
              <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                {gonderiliyor ? "Oluşturuluyor…" : "Santralı Oluştur"}
              </button>
            </form>
          )}

          {!santraller && !hata && <div className="yukleniyor">Yükleniyor…</div>}

          {platformAdmin && !seciliHoldingId && (
            <div className="bosDurum">Santralleri görmek için yukarıdan bir holding seçin.</div>
          )}

          {gosterilecekSantraller &&
            gosterilecekSantraller.map((s) => (
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
                  {s.konum} {s.turbin_tipi ? `— ${s.turbin_tipi}` : ""} {s.kurulu_guc_mw ? `— ${s.kurulu_guc_mw} MW` : ""}
                </div>
              </Link>
            ))}
        </div>
      </div>
    </>
  );
}
