import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { istekAt, tokenAl, yoneticiMi } from "../../lib/api";
import UstBar from "../../components/UstBar";

const PERIYOT_ETIKETLERI = {
  GUNLUK: "Günlük",
  HAFTALIK: "Haftalık",
  AYLIK: "Aylık",
  UC_AYLIK: "3 Ayda Bir",
  ALTI_AYLIK: "6 Ayda Bir",
  YILLIK: "Yıllık",
};

export default function SantralDetaySayfasi() {
  const router = useRouter();
  const { id } = router.query;

  const [santral, setSantral] = useState(null);
  const [ekipmanlar, setEkipmanlar] = useState(null);
  const [planlar, setPlanlar] = useState(null);
  const [sablonlar, setSablonlar] = useState(null);
  const [hata, setHata] = useState(null);

  const [ekipmanFormuAcik, setEkipmanFormuAcik] = useState(false);
  const [planFormuAcik, setPlanFormuAcik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [yeniEkipman, setYeniEkipman] = useState({ ad: "", tip: "", seri_no: "", uretici: "" });
  const [yeniPlan, setYeniPlan] = useState({
    ekipman_id: "",
    sablon_id: "",
    periyot: "AYLIK",
    baslangic_tarihi: "",
  });

  const verileriYukle = useCallback(async () => {
    if (!id) return;
    try {
      const [s, e, p, sb] = await Promise.all([
        istekAt(`/api/v1/santraller/${id}`),
        istekAt(`/api/v1/santraller/${id}/ekipmanlar`),
        istekAt(`/api/v1/santraller/${id}/bakim-planlari`),
        istekAt(`/api/v1/bakim-sablonlari`),
      ]);
      setSantral(s);
      setEkipmanlar(e.veri);
      setPlanlar(p.veri);
      setSablonlar(sb.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, [id]);

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

  async function ekipmanEkle(e) {
    e.preventDefault();
    setHata(null);
    setGonderiliyor(true);
    try {
      await istekAt(`/api/v1/santraller/${id}/ekipmanlar`, {
        method: "POST",
        body: JSON.stringify(yeniEkipman),
      });
      setYeniEkipman({ ad: "", tip: "", seri_no: "", uretici: "" });
      setEkipmanFormuAcik(false);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function planEkle(e) {
    e.preventDefault();
    setHata(null);
    setGonderiliyor(true);
    try {
      await istekAt(`/api/v1/santraller/${id}/bakim-planlari`, {
        method: "POST",
        body: JSON.stringify(yeniPlan),
      });
      setYeniPlan({ ekipman_id: "", sablon_id: "", periyot: "AYLIK", baslangic_tarihi: "" });
      setPlanFormuAcik(false);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function planiDurdur(planId) {
    if (!confirm("Bu bakım planını durdurmak istediğinize emin misiniz? Yeni görev üretilmeyecek.")) return;
    try {
      await istekAt(`/api/v1/bakim-planlari/${planId}/durdur`, { method: "POST" });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  if (!santral) {
    return (
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          {hata ? <div className="hataKutusu">{hata}</div> : <div className="yukleniyor">Yükleniyor…</div>}
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{santral.ad} — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <Link href="/santraller" className="geriLink">
            ← Santral listesine dön
          </Link>

          <div className="detayUst">
            <h2>{santral.ad}</h2>
            <div className="detayAlt">
              {santral.konum} {santral.turbin_tipi ? `— ${santral.turbin_tipi}` : ""}
            </div>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}

          {/* ---------- Ekipmanlar ---------- */}
          <div className="bolumBaslik">
            <h2 style={{ fontSize: "17px" }}>Ekipmanlar</h2>
            <button className="kucukButon" onClick={() => setEkipmanFormuAcik((v) => !v)}>
              {ekipmanFormuAcik ? "Vazgeç" : "+ Yeni Ekipman"}
            </button>
          </div>

          {ekipmanFormuAcik && (
            <form onSubmit={ekipmanEkle} className="yonetimFormu">
              <div className="alan">
                <label>Ekipman adı</label>
                <input
                  required
                  value={yeniEkipman.ad}
                  onChange={(e) => setYeniEkipman({ ...yeniEkipman, ad: e.target.value })}
                  placeholder="Ör. Türbin 2"
                />
              </div>
              <div className="alan">
                <label>Tip</label>
                <input
                  required
                  value={yeniEkipman.tip}
                  onChange={(e) => setYeniEkipman({ ...yeniEkipman, tip: e.target.value })}
                  placeholder="Ör. Francis Türbin"
                />
              </div>
              <div className="alan">
                <label>Seri no (isteğe bağlı)</label>
                <input
                  value={yeniEkipman.seri_no}
                  onChange={(e) => setYeniEkipman({ ...yeniEkipman, seri_no: e.target.value })}
                />
              </div>
              <div className="alan">
                <label>Üretici (isteğe bağlı)</label>
                <input
                  value={yeniEkipman.uretici}
                  onChange={(e) => setYeniEkipman({ ...yeniEkipman, uretici: e.target.value })}
                />
              </div>
              <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                {gonderiliyor ? "Ekleniyor…" : "Ekipmanı Ekle"}
              </button>
            </form>
          )}

          {!ekipmanlar && <div className="yukleniyor">Yükleniyor…</div>}
          {ekipmanlar && ekipmanlar.length === 0 && (
            <div className="bosDurum">Bu santrale henüz ekipman eklenmemiş.</div>
          )}
          {ekipmanlar &&
            ekipmanlar.map((e) => (
              <div className="satirKart" key={e.ekipman_id}>
                <div>
                  <strong>{e.ad}</strong> — {e.tip}
                </div>
                <div className="gorevAlt">
                  {e.uretici && `${e.uretici} `}
                  {e.seri_no && `· ${e.seri_no}`}
                </div>
              </div>
            ))}

          {/* ---------- Bakım Planları ---------- */}
          <div className="bolumBaslik" style={{ marginTop: "32px" }}>
            <h2 style={{ fontSize: "17px" }}>Bakım Planları</h2>
            <button
              className="kucukButon"
              onClick={() => setPlanFormuAcik((v) => !v)}
              disabled={!ekipmanlar || ekipmanlar.length === 0}
            >
              {planFormuAcik ? "Vazgeç" : "+ Yeni Plan"}
            </button>
          </div>

          {ekipmanlar && ekipmanlar.length === 0 && (
            <div className="bosDurum">Plan ekleyebilmek için önce bir ekipman ekleyin.</div>
          )}

          {planFormuAcik && (
            <form onSubmit={planEkle} className="yonetimFormu">
              <div className="alan">
                <label>Ekipman</label>
                <select
                  required
                  value={yeniPlan.ekipman_id}
                  onChange={(e) => setYeniPlan({ ...yeniPlan, ekipman_id: e.target.value })}
                >
                  <option value="">Seçin…</option>
                  {ekipmanlar &&
                    ekipmanlar.map((e) => (
                      <option key={e.ekipman_id} value={e.ekipman_id}>
                        {e.ad} ({e.tip})
                      </option>
                    ))}
                </select>
              </div>
              <div className="alan">
                <label>Bakım şablonu</label>
                <select
                  required
                  value={yeniPlan.sablon_id}
                  onChange={(e) => setYeniPlan({ ...yeniPlan, sablon_id: e.target.value })}
                >
                  <option value="">Seçin…</option>
                  {sablonlar &&
                    sablonlar.map((s) => (
                      <option key={s.sablon_id} value={s.sablon_id}>
                        {s.ad} ({s.ekipman_tipi})
                      </option>
                    ))}
                </select>
              </div>
              <div className="alan">
                <label>Periyot</label>
                <select
                  value={yeniPlan.periyot}
                  onChange={(e) => setYeniPlan({ ...yeniPlan, periyot: e.target.value })}
                >
                  {Object.entries(PERIYOT_ETIKETLERI).map(([deger, etiket]) => (
                    <option key={deger} value={deger}>
                      {etiket}
                    </option>
                  ))}
                </select>
              </div>
              <div className="alan">
                <label>Başlangıç tarihi</label>
                <input
                  required
                  type="date"
                  value={yeniPlan.baslangic_tarihi}
                  onChange={(e) => setYeniPlan({ ...yeniPlan, baslangic_tarihi: e.target.value })}
                />
              </div>
              <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                {gonderiliyor ? "Ekleniyor…" : "Planı Ekle"}
              </button>
            </form>
          )}

          {!planlar && <div className="yukleniyor">Yükleniyor…</div>}
          {planlar && planlar.length === 0 && (
            <div className="bosDurum">Bu santral için henüz bakım planı yok.</div>
          )}
          {planlar &&
            planlar.map((p) => (
              <div className="satirKart" key={p.plan_id}>
                <div>
                  <strong>{p.ekipman_adi}</strong> — {p.sablon_adi}
                </div>
                <div className="gorevAlt">
                  {PERIYOT_ETIKETLERI[p.periyot] || p.periyot} · Başlangıç:{" "}
                  {new Date(p.baslangic_tarihi).toLocaleDateString("tr-TR")}
                  {!p.aktif_mi && " · DURDURULDU"}
                </div>
                {p.aktif_mi && (
                  <button className="linkButon" onClick={() => planiDurdur(p.plan_id)}>
                    Planı durdur
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
