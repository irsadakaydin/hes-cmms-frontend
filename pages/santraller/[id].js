import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { istekAt, tokenAl, yoneticiMi, platformAdminMi, isletmeYoneticisiMi } from "../../lib/api";
import UstBar from "../../components/UstBar";

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

const ROL_KISA_ETIKET = {
  ADMIN: "Platform Admin",
  ISLETME_ADMIN: "İşletme Admin",
  SANTRAL_SORUMLUSU: "Santral Sorumlusu",
  SAHA_PERSONELI: "Saha Personeli",
  IZLEYICI: "İzleyici",
};

export default function SantralDetaySayfasi() {
  const router = useRouter();
  const { id } = router.query;

  const [santral, setSantral] = useState(null);
  const [ekipmanlar, setEkipmanlar] = useState(null);
  const [planlar, setPlanlar] = useState(null);
  const [tumSablonlar, setTumSablonlar] = useState(null);
  const [hata, setHata] = useState(null);

  const [ekipmanFormuAcik, setEkipmanFormuAcik] = useState(false);
  const [ekipmanListesiAcik, setEkipmanListesiAcik] = useState(false);
  const [planFormuAcik, setPlanFormuAcik] = useState(false);
  const [planGorunumu, setPlanGorunumu] = useState("DEVAM_EDEN");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [yeniEkipman, setYeniEkipman] = useState({ ad: "", tip: "", unite_no: "", seri_no: "", uretici: "" });
  const [duzenlenenEkipman, setDuzenlenenEkipman] = useState(null);
  const [yeniPlan, setYeniPlan] = useState({
    ekipman_id: "",
    sablon_id: "",
    periyot: "AYLIK",
    baslangic_tarihi: "",
    sorumlu_kullanici_idleri: [],
  });
  const [atanabilirKullanicilar, setAtanabilirKullanicilar] = useState(null);
  const [santralDuzenleAcik, setSantralDuzenleAcik] = useState(false);
  const [santralTaslak, setSantralTaslak] = useState(null);

  const verileriYukle = useCallback(async () => {
    if (!id) return;
    try {
      // Santral bilgisini ÖNCE alıyoruz — şablon listesini o santralin
      // bağlı olduğu holdinge göre filtrelemek için isletme_id'sine ihtiyacımız var.
      // (Platform Admin için şablon uç noktası filtre verilmezse TÜM holdinglerin
      // şablonlarını döner — bu, yanlış holdingden şablon seçilmesine yol açardı.)
      const s = await istekAt(`/api/v1/santraller/${id}`);

      const [e, p, sb, ak] = await Promise.all([
        istekAt(`/api/v1/santraller/${id}/ekipmanlar`),
        istekAt(`/api/v1/santraller/${id}/bakim-planlari`),
        istekAt(`/api/v1/bakim-sablonlari?isletme_id=${s.isletme_id}&santral_id=${id}`),
        istekAt(`/api/v1/santraller/${id}/atanabilir-kullanicilar`),
      ]);
      setAtanabilirKullanicilar(ak.veri);
      setSantral(s);
      setEkipmanlar(e.veri);
      setPlanlar(p.veri);
      setTumSablonlar(sb.veri);
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

  async function ekipmaniGuncelle(e) {
    e.preventDefault();
    setHata(null);
    setGonderiliyor(true);
    try {
      const { ekipman_id, ad, tip, unite_no, seri_no, uretici } = duzenlenenEkipman;
      await istekAt(`/api/v1/ekipmanlar/${ekipman_id}`, {
        method: "PATCH",
        body: JSON.stringify({ ad, tip, unite_no, seri_no, uretici }),
      });
      setDuzenlenenEkipman(null);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function ekipmaniSil(ekipmanId) {
    if (!confirm("Bu ekipmanı KALICI OLARAK silmek istediğinize emin misiniz? Bu işlem geri alınamaz."))
      return;
    setHata(null);
    try {
      await istekAt(`/api/v1/ekipmanlar/${ekipmanId}`, { method: "DELETE" });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

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
    if (yeniPlan.sorumlu_kullanici_idleri.length === 0) {
      setHata("En az bir sorumlu kullanıcı seçmelisiniz.");
      return;
    }
    setGonderiliyor(true);
    try {
      await istekAt(`/api/v1/santraller/${id}/bakim-planlari`, {
        method: "POST",
        body: JSON.stringify(yeniPlan),
      });
      setYeniPlan({ ekipman_id: "", sablon_id: "", periyot: "AYLIK", baslangic_tarihi: "", sorumlu_kullanici_idleri: [] });
      setPlanFormuAcik(false);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function santralDuzenleyiBaslat() {
    setSantralTaslak({
      ad: santral.ad,
      konum: santral.konum || "",
      kurulu_guc_mw: santral.kurulu_guc_mw || "",
      turbin_tipi: santral.turbin_tipi || "",
    });
    setSantralDuzenleAcik(true);
  }

  async function santralKaydet(e) {
    e.preventDefault();
    setHata(null);
    setGonderiliyor(true);
    try {
      await istekAt(`/api/v1/santraller/${id}`, {
        method: "PATCH",
        body: JSON.stringify(santralTaslak),
      });
      setSantralDuzenleAcik(false);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function santralDurumDegistir() {
    setHata(null);
    try {
      const yol =
        santral.durum === "AKTIF"
          ? `/api/v1/santraller/${id}/pasiflestir`
          : `/api/v1/santraller/${id}/aktiflestir`;
      await istekAt(yol, { method: "POST" });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function santralSil() {
    if (
      !confirm(`"${santral.ad}" santralini kalıcı olarak silmek istediğinize emin misiniz?`)
    )
      return;
    setHata(null);
    try {
      await istekAt(`/api/v1/santraller/${id}`, { method: "DELETE" });
      router.push("/santraller");
    } catch (err) {
      setHata(err.message);
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

  async function planiAktiflestir(planId) {
    setHata(null);
    try {
      await istekAt(`/api/v1/bakim-planlari/${planId}/aktiflestir`, { method: "POST" });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function planiSil(planId) {
    if (!confirm("Bu bakım planını kalıcı olarak silmek istediğinize emin misiniz?")) return;
    setHata(null);
    try {
      await istekAt(`/api/v1/bakim-planlari/${planId}`, { method: "DELETE" });
      await verileriYukle();
    } catch (err) {
      if (err.hata_kodu === "PLAN_GECMISI_VAR" && isletmeYoneticisiMi()) {
        if (
          confirm(
            `${err.message}\n\nBunun yerine görev geçmişiyle BİRLİKTE kalıcı olarak silmek ister misiniz? Bu işlem GERİ ALINAMAZ.`
          )
        ) {
          try {
            await istekAt(`/api/v1/bakim-planlari/${planId}?zorla=1`, { method: "DELETE" });
            await verileriYukle();
          } catch (err2) {
            setHata(err2.message);
          }
          return;
        }
      }
      setHata(err.message);
    }
  }

  async function planaSorumluEkle(plan, yeniKullaniciId) {
    if (!yeniKullaniciId) return;
    setHata(null);
    try {
      const mevcutIdler = (plan.sorumlular || []).map((s) => s.kullanici_id);
      if (mevcutIdler.includes(yeniKullaniciId)) return;
      await istekAt(`/api/v1/bakim-planlari/${plan.plan_id}`, {
        method: "PATCH",
        body: JSON.stringify({ sorumlu_kullanici_idleri: [...mevcutIdler, yeniKullaniciId] }),
      });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function planSorumlusunuKaldir(plan, kaldirilacakId) {
    setHata(null);
    try {
      const kalanIdler = (plan.sorumlular || []).map((s) => s.kullanici_id).filter((id) => id !== kaldirilacakId);
      await istekAt(`/api/v1/bakim-planlari/${plan.plan_id}`, {
        method: "PATCH",
        body: JSON.stringify({ sorumlu_kullanici_idleri: kalanIdler }),
      });
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

  // Seçilen ekipmanın tipi VE seçilen periyoda göre şablon listesini anlık süzer
  const yeniPlanSeciliEkipman = (ekipmanlar || []).find((ek) => ek.ekipman_id === yeniPlan.ekipman_id);
  const sabitliSablonlar = (tumSablonlar || []).filter((sb) => {
    if (yeniPlanSeciliEkipman && sb.ekipman_tipi !== yeniPlanSeciliEkipman.tip) return false;
    if (yeniPlan.periyot && sb.periyot_tipi !== yeniPlan.periyot) return false;
    return true;
  });

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
            <h2>
              {santral.ad}
              {santral.durum !== "AKTIF" && (
                <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>
                  Pasif
                </span>
              )}
            </h2>
            <div className="detayAlt">
              {santral.konum} {santral.turbin_tipi ? `— ${santral.turbin_tipi}` : ""}
            </div>
            {platformAdminMi() && !santralDuzenleAcik && (
              <div className="kullaniciAlt">
                <button className="linkButon" onClick={santralDuzenleyiBaslat}>
                  Düzenle
                </button>
                <button className="linkButon" onClick={santralDurumDegistir}>
                  {santral.durum === "AKTIF" ? "Pasifleştir" : "Yeniden aktifleştir"}
                </button>
                <button className="linkButon" onClick={santralSil}>
                  Sil
                </button>
              </div>
            )}
          </div>

          {santralDuzenleAcik && santralTaslak && (
            <form onSubmit={santralKaydet} className="yonetimFormu">
              <div className="alan">
                <label>Santral adı</label>
                <input
                  required
                  value={santralTaslak.ad}
                  onChange={(e) => setSantralTaslak({ ...santralTaslak, ad: e.target.value })}
                />
              </div>
              <div className="alan">
                <label>Konum</label>
                <input
                  value={santralTaslak.konum}
                  onChange={(e) => setSantralTaslak({ ...santralTaslak, konum: e.target.value })}
                />
              </div>
              <div className="alan">
                <label>Kurulu güç MW</label>
                <input
                  type="number"
                  step="0.01"
                  value={santralTaslak.kurulu_guc_mw}
                  onChange={(e) => setSantralTaslak({ ...santralTaslak, kurulu_guc_mw: e.target.value })}
                />
              </div>
              <div className="alan">
                <label>Türbin tipi</label>
                <input
                  value={santralTaslak.turbin_tipi}
                  onChange={(e) => setSantralTaslak({ ...santralTaslak, turbin_tipi: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                  Kaydet
                </button>
                <button
                  type="button"
                  className="kucukButon"
                  style={{ background: "var(--ink-soft)" }}
                  onClick={() => setSantralDuzenleAcik(false)}
                >
                  Vazgeç
                </button>
              </div>
            </form>
          )}

          {hata && <div className="hataKutusu">{hata}</div>}

          {/* ---------- Ekipmanlar ---------- */}
          <div className="bolumBaslik">
            <button
              type="button"
              className="periyotGrupBasligi"
              style={{ border: "none", padding: 0, background: "none", fontSize: "17px" }}
              onClick={() => setEkipmanListesiAcik((v) => !v)}
            >
              {ekipmanListesiAcik ? "▾" : "▸"} Ekipmanlar {ekipmanlar ? `(${ekipmanlar.length})` : ""}
            </button>
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
                <label>Ünite No (isteğe bağlı)</label>
                <input
                  value={yeniEkipman.unite_no}
                  onChange={(e) => setYeniEkipman({ ...yeniEkipman, unite_no: e.target.value })}
                  placeholder="Ör. Ünite 1"
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
          {ekipmanListesiAcik && ekipmanlar && ekipmanlar.length === 0 && (
            <div className="bosDurum">Bu santrale henüz ekipman eklenmemiş.</div>
          )}
          {ekipmanListesiAcik &&
            ekipmanlar &&
            ekipmanlar.map((e) =>
              duzenlenenEkipman?.ekipman_id === e.ekipman_id ? (
                <form onSubmit={ekipmaniGuncelle} className="yonetimFormu" key={e.ekipman_id}>
                  <div className="alan">
                    <label>Ekipman adı</label>
                    <input
                      required
                      value={duzenlenenEkipman.ad}
                      onChange={(ev) => setDuzenlenenEkipman({ ...duzenlenenEkipman, ad: ev.target.value })}
                    />
                  </div>
                  <div className="alan">
                    <label>Ünite No</label>
                    <input
                      value={duzenlenenEkipman.unite_no || ""}
                      onChange={(ev) => setDuzenlenenEkipman({ ...duzenlenenEkipman, unite_no: ev.target.value })}
                    />
                  </div>
                  <div className="alan">
                    <label>Tip</label>
                    <input
                      required
                      value={duzenlenenEkipman.tip}
                      onChange={(ev) => setDuzenlenenEkipman({ ...duzenlenenEkipman, tip: ev.target.value })}
                    />
                  </div>
                  <div className="alan">
                    <label>Seri no</label>
                    <input
                      value={duzenlenenEkipman.seri_no || ""}
                      onChange={(ev) => setDuzenlenenEkipman({ ...duzenlenenEkipman, seri_no: ev.target.value })}
                    />
                  </div>
                  <div className="alan">
                    <label>Üretici</label>
                    <input
                      value={duzenlenenEkipman.uretici || ""}
                      onChange={(ev) => setDuzenlenenEkipman({ ...duzenlenenEkipman, uretici: ev.target.value })}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                      Kaydet
                    </button>
                    <button
                      type="button"
                      className="kucukButon"
                      onClick={() => setDuzenlenenEkipman(null)}
                      style={{ background: "var(--ink-soft)" }}
                    >
                      Vazgeç
                    </button>
                  </div>
                </form>
              ) : (
                <div className="satirKart" key={e.ekipman_id}>
                  <div>
                    <strong>{e.ad}</strong> — {e.tip}
                    {e.unite_no && ` (${e.unite_no})`}
                    {e.durum === "HURDA" && (
                      <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>
                        Pasif
                      </span>
                    )}
                  </div>
                  <div className="gorevAlt">
                    {e.uretici && `${e.uretici} `}
                    {e.seri_no && `· ${e.seri_no}`}
                  </div>
                  <div className="kullaniciAlt">
                    <button className="linkButon" onClick={() => setDuzenlenenEkipman(e)}>
                      Düzenle
                    </button>
                    {e.durum === "HURDA" ? (
                      <button
                        className="linkButon"
                        onClick={async () => {
                          await istekAt(`/api/v1/ekipmanlar/${e.ekipman_id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ durum: "AKTIF" }),
                          });
                          await verileriYukle();
                        }}
                      >
                        Yeniden aktifleştir
                      </button>
                    ) : (
                      <button
                        className="linkButon"
                        onClick={async () => {
                          await istekAt(`/api/v1/ekipmanlar/${e.ekipman_id}/pasiflestir`, { method: "POST" });
                          await verileriYukle();
                        }}
                      >
                        Pasifleştir
                      </button>
                    )}
                    {isletmeYoneticisiMi() && (
                      <button className="linkButon" onClick={() => ekipmaniSil(e.ekipman_id)}>
                        Sil
                      </button>
                    )}
                  </div>
                </div>
              )
            )}

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
                  onChange={(e) => setYeniPlan({ ...yeniPlan, ekipman_id: e.target.value, sablon_id: "" })}
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
                <label>Periyot</label>
                <select
                  value={yeniPlan.periyot}
                  onChange={(e) => setYeniPlan({ ...yeniPlan, periyot: e.target.value, sablon_id: "" })}
                >
                  {Object.entries(PERIYOT_ETIKETLERI).map(([deger, etiket]) => (
                    <option key={deger} value={deger}>
                      {etiket}
                    </option>
                  ))}
                </select>
              </div>
              <div className="alan">
                <label>
                  Bakım şablonu — seçilen ekipman ve periyoda göre süzülür{" "}
                  <span className="kutuphaneEtiketi">— {santral.isletme_adi} Kütüphanesi</span>
                </label>
                <select
                  required
                  value={yeniPlan.sablon_id}
                  onChange={(e) => setYeniPlan({ ...yeniPlan, sablon_id: e.target.value })}
                >
                  <option value="">Seçin…</option>
                  {sabitliSablonlar.map((s) => (
                    <option key={s.sablon_id} value={s.sablon_id}>
                      {s.ad} ({s.ekipman_tipi})
                    </option>
                  ))}
                </select>
                {yeniPlan.ekipman_id && sabitliSablonlar.length === 0 && (
                  <div className="kutuphaneBosUyari">
                    Bu ekipman tipi + periyot için {santral.isletme_adi} kütüphanesinde henüz bir şablon yok —{" "}
                    <a href="/sablonlar">Bakım Şablonları</a> sayfasından ekleyin.
                  </div>
                )}
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
              <div className="alan">
                <label>Sorumlu kullanıcı(lar) — birden fazla seçebilirsiniz</label>
                <div className="aliciListesi">
                  {atanabilirKullanicilar &&
                    atanabilirKullanicilar.map((k) => (
                      <label key={k.kullanici_id} className="aliciSatiri">
                        <input
                          type="checkbox"
                          checked={yeniPlan.sorumlu_kullanici_idleri.includes(k.kullanici_id)}
                          onChange={() =>
                            setYeniPlan((t) => ({
                              ...t,
                              sorumlu_kullanici_idleri: t.sorumlu_kullanici_idleri.includes(k.kullanici_id)
                                ? t.sorumlu_kullanici_idleri.filter((id) => id !== k.kullanici_id)
                                : [...t.sorumlu_kullanici_idleri, k.kullanici_id],
                            }))
                          }
                        />
                        {k.ad_soyad} ({ROL_KISA_ETIKET[k.rol] || k.rol})
                      </label>
                    ))}
                </div>
                {atanabilirKullanicilar && atanabilirKullanicilar.length === 0 && (
                  <div className="kutuphaneBosUyari">
                    Bu santrale erişimi olan bir kullanıcı yok — önce Kullanıcılar sayfasından birine bu
                    santral erişimi verin.
                  </div>
                )}
              </div>
              <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                {gonderiliyor ? "Ekleniyor…" : "Planı Ekle"}
              </button>
            </form>
          )}

          {!planlar && <div className="yukleniyor">Yükleniyor…</div>}

          {planlar && (
            <div className="bakimSekmeSirasi">
              <button
                type="button"
                className={planGorunumu === "DEVAM_EDEN" ? "bakimSekmeAktif" : "bakimSekme"}
                onClick={() => setPlanGorunumu("DEVAM_EDEN")}
              >
                Devam Eden ({planlar.filter((p) => p.kategori === "DEVAM_EDEN").length})
              </button>
              <button
                type="button"
                className={planGorunumu === "GECIKEN" ? "bakimSekmeAktif" : "bakimSekme"}
                onClick={() => setPlanGorunumu("GECIKEN")}
              >
                Geciken ({planlar.filter((p) => p.kategori === "GECIKEN").length})
              </button>
              <button
                type="button"
                className={planGorunumu === "TAMAMLANAN" ? "bakimSekmeAktif" : "bakimSekme"}
                onClick={() => setPlanGorunumu("TAMAMLANAN")}
              >
                Tamamlanan ({planlar.filter((p) => p.kategori === "TAMAMLANAN").length})
              </button>
              <button
                type="button"
                className={planGorunumu === "DURDURULAN" ? "bakimSekmeAktif" : "bakimSekme"}
                onClick={() => setPlanGorunumu("DURDURULAN")}
              >
                Durdurulan ({planlar.filter((p) => p.kategori === "DURDURULAN").length})
              </button>
            </div>
          )}

          {planlar && planlar.filter((p) => p.kategori === planGorunumu).length === 0 && (
            <div className="bosDurum">Bu kategoride bir bakım planı yok.</div>
          )}

          {planlar &&
            planlar
              .filter((p) => p.kategori === planGorunumu)
              .map((p) => (
              <div className="satirKart" key={p.plan_id}>
                <div>
                  <strong>{p.ekipman_adi}</strong> — {p.sablon_adi}
                </div>
                <div className="gorevAlt">
                  {PERIYOT_ETIKETLERI[p.periyot] || p.periyot} · Başlangıç:{" "}
                  {new Date(p.baslangic_tarihi).toLocaleDateString("tr-TR")}
                  {!p.aktif_mi && " · DURDURULDU"}
                  {p.son_donem_toplam > 1 && (
                    <span
                      className={`rozet ${
                        p.son_donem_tamamlanan === p.son_donem_toplam ? "rozet-TAMAMLANDI" : "rozet-GECIKTI"
                      }`}
                      style={{ marginLeft: 8 }}
                    >
                      {p.son_donem_tamamlanan}/{p.son_donem_toplam} kişi onayladı
                    </span>
                  )}
                </div>
                {p.sorumlular && p.sorumlular.length > 0 && (
                  <div className="santralEtiketleri" style={{ marginTop: "6px" }}>
                    {p.sorumlular.map((s) => (
                      <span key={s.kullanici_id} className="santralEtiket">
                        {s.ad_soyad}
                        {p.aktif_mi && (
                          <button onClick={() => planSorumlusunuKaldir(p, s.kullanici_id)}>×</button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {p.aktif_mi && (
                  <>
                    <select
                      defaultValue=""
                      style={{ marginRight: "10px", fontSize: "12px", padding: "4px", marginTop: "8px" }}
                      onChange={(e) => {
                        planaSorumluEkle(p, e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>
                        + Sorumlu ekle…
                      </option>
                      {atanabilirKullanicilar &&
                        atanabilirKullanicilar.map((k) => (
                          <option key={k.kullanici_id} value={k.kullanici_id}>
                            {k.ad_soyad}
                          </option>
                        ))}
                    </select>
                    <button className="linkButon" style={{ marginRight: "14px" }} onClick={() => planiDurdur(p.plan_id)}>
                      Planı durdur
                    </button>
                  </>
                )}
                {!p.aktif_mi && (
                  <button className="linkButon" style={{ marginRight: "14px" }} onClick={() => planiAktiflestir(p.plan_id)}>
                    Yeniden aktifleştir
                  </button>
                )}
                <button className="linkButon" onClick={() => planiSil(p.plan_id)}>
                  Sil
                </button>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
