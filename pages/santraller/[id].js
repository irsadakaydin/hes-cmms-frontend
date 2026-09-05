import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { istekAt, tokenAl, yoneticiMi, dosyaIndir } from "../../lib/api";
import UstBar from "../../components/UstBar";

const PERIYOT_ETIKETLERI = {
  GUNLUK: "Günlük",
  HAFTALIK: "Haftalık",
  AYLIK: "Aylık",
  UC_AYLIK: "3 Ayda Bir",
  ALTI_AYLIK: "6 Ayda Bir",
  YILLIK: "Yıllık",
};

const ROL_KISA_ETIKET = {
  ADMIN: "Platform Admin",
  ISLETME_ADMIN: "İşletme Admin",
  SANTRAL_SORUMLUSU: "Santral Sorumlusu",
  SAHA_PERSONELI: "Saha Personeli",
  IZLEYICI: "İzleyici",
};

const DONEM_ETIKETLERI = {
  GUNLUK: "Bugün",
  HAFTALIK: "Son 7 Gün",
  AYLIK: "Bu Ay",
  YILLIK: "Bu Yıl",
  TUM_ZAMANLAR: "Tüm Zamanlar",
};

/** Seçilen dönem etiketini gerçek tarih aralığına çevirir (YYYY-AA-GG). */
function donemTarihAraligi(donem) {
  const bugun = new Date();
  const gunFormatla = (d) => d.toISOString().slice(0, 10);
  const bitis = gunFormatla(bugun);

  switch (donem) {
    case "GUNLUK":
      return { baslangic: bitis, bitis };
    case "HAFTALIK": {
      const d = new Date(bugun);
      d.setDate(d.getDate() - 6);
      return { baslangic: gunFormatla(d), bitis };
    }
    case "AYLIK": {
      const d = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
      return { baslangic: gunFormatla(d), bitis };
    }
    case "YILLIK": {
      const d = new Date(bugun.getFullYear(), 0, 1);
      return { baslangic: gunFormatla(d), bitis };
    }
    default:
      return {};
  }
}

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
  const [raporIndiriliyor, setRaporIndiriliyor] = useState(false);
  const [raporDonemi, setRaporDonemi] = useState("TUM_ZAMANLAR");

  const [yeniEkipman, setYeniEkipman] = useState({ ad: "", tip: "", seri_no: "", uretici: "" });
  const [duzenlenenEkipman, setDuzenlenenEkipman] = useState(null);
  const [yeniPlan, setYeniPlan] = useState({
    ekipman_id: "",
    sablon_id: "",
    periyot: "AYLIK",
    baslangic_tarihi: "",
    sorumlu_kullanici_id: "",
  });
  const [atanabilirKullanicilar, setAtanabilirKullanicilar] = useState(null);

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
        istekAt(`/api/v1/bakim-sablonlari?isletme_id=${s.isletme_id}`),
        istekAt(`/api/v1/santraller/${id}/atanabilir-kullanicilar`),
      ]);
      setAtanabilirKullanicilar(ak.veri);
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

  async function ekipmaniGuncelle(e) {
    e.preventDefault();
    setHata(null);
    setGonderiliyor(true);
    try {
      const { ekipman_id, ad, tip, seri_no, uretici } = duzenlenenEkipman;
      await istekAt(`/api/v1/ekipmanlar/${ekipman_id}`, {
        method: "PATCH",
        body: JSON.stringify({ ad, tip, seri_no, uretici }),
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
    if (!confirm("Bu ekipmanı pasifleştirmek istediğinize emin misiniz? (HURDA olarak işaretlenir, silinmez.)"))
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
    setGonderiliyor(true);
    try {
      await istekAt(`/api/v1/santraller/${id}/bakim-planlari`, {
        method: "POST",
        body: JSON.stringify(yeniPlan),
      });
      setYeniPlan({ ekipman_id: "", sablon_id: "", periyot: "AYLIK", baslangic_tarihi: "", sorumlu_kullanici_id: "" });
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

  async function planSorumlusunuDegistir(planId, yeniSorumluId) {
    if (!yeniSorumluId) return;
    setHata(null);
    try {
      await istekAt(`/api/v1/bakim-planlari/${planId}`, {
        method: "PATCH",
        body: JSON.stringify({ sorumlu_kullanici_id: yeniSorumluId }),
      });
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function raporIndir(format) {
    setHata(null);
    setRaporIndiriliyor(true);
    try {
      const uzanti = format === "pdf" ? "pdf" : "xlsx";
      const { baslangic, bitis } = donemTarihAraligi(raporDonemi);
      const parametreler = new URLSearchParams();
      if (baslangic) parametreler.set("baslangic", baslangic);
      if (bitis) parametreler.set("bitis", bitis);
      const sorguMetni = parametreler.toString() ? `?${parametreler.toString()}` : "";

      await dosyaIndir(
        `/api/v1/raporlar/santral/${id}/${format}${sorguMetni}`,
        `bakim-raporu-${santral.ad.replace(/\s+/g, "-")}-${raporDonemi}.${uzanti}`
      );
    } catch (err) {
      setHata(err.message);
    } finally {
      setRaporIndiriliyor(false);
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
            <div className="raporButonlari">
              <select
                value={raporDonemi}
                onChange={(e) => setRaporDonemi(e.target.value)}
                style={{ padding: "8px 10px", border: "1px solid var(--line-strong)", background: "var(--paper)", fontSize: "13px" }}
              >
                {Object.entries(DONEM_ETIKETLERI).map(([deger, etiket]) => (
                  <option key={deger} value={deger}>
                    {etiket}
                  </option>
                ))}
              </select>
              <button className="kucukButon" onClick={() => raporIndir("pdf")} disabled={raporIndiriliyor}>
                {raporIndiriliyor ? "Hazırlanıyor…" : "PDF Rapor İndir"}
              </button>
              <button className="kucukButon" onClick={() => raporIndir("excel")} disabled={raporIndiriliyor}>
                {raporIndiriliyor ? "Hazırlanıyor…" : "Excel Rapor İndir"}
              </button>
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
                      <button className="linkButon" onClick={() => ekipmaniSil(e.ekipman_id)}>
                        Sil (pasifleştir)
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
                <label>
                  Bakım şablonu <span className="kutuphaneEtiketi">— {santral.isletme_adi} Kütüphanesi</span>
                </label>
                <select
                  required
                  value={yeniPlan.sablon_id}
                  onChange={(e) => setYeniPlan({ ...yeniPlan, sablon_id: e.target.value })}
                >
                  <option value="">Seçin…</option>
                  {sablonlar && sablonlar.length > 0 && (
                    <optgroup label={`${santral.isletme_adi} Kütüphanesi`}>
                      {sablonlar.map((s) => (
                        <option key={s.sablon_id} value={s.sablon_id}>
                          {s.ad} ({s.ekipman_tipi})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {sablonlar && sablonlar.length === 0 && (
                  <div className="kutuphaneBosUyari">
                    {santral.isletme_adi} kütüphanesinde henüz bakım şablonu yok —{" "}
                    <a href="/sablonlar">Bakım Şablonları</a> sayfasından ekleyin.
                  </div>
                )}
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
              <div className="alan">
                <label>Sorumlu kullanıcı (görevler kime atansın)</label>
                <select
                  required
                  value={yeniPlan.sorumlu_kullanici_id}
                  onChange={(e) => setYeniPlan({ ...yeniPlan, sorumlu_kullanici_id: e.target.value })}
                >
                  <option value="">Seçin…</option>
                  {atanabilirKullanicilar &&
                    atanabilirKullanicilar.map((k) => (
                      <option key={k.kullanici_id} value={k.kullanici_id}>
                        {k.ad_soyad} ({ROL_KISA_ETIKET[k.rol] || k.rol})
                      </option>
                    ))}
                </select>
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
                  {p.sorumlu_ad_soyad && ` · Sorumlu: ${p.sorumlu_ad_soyad}`}
                  {!p.aktif_mi && " · DURDURULDU"}
                </div>
                {p.aktif_mi && (
                  <>
                    <select
                      defaultValue=""
                      style={{ marginRight: "10px", fontSize: "12px", padding: "4px" }}
                      onChange={(e) => {
                        planSorumlusunuDegistir(p.plan_id, e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="" disabled>
                        Sorumluyu değiştir…
                      </option>
                      {atanabilirKullanicilar &&
                        atanabilirKullanicilar.map((k) => (
                          <option key={k.kullanici_id} value={k.kullanici_id}>
                            {k.ad_soyad}
                          </option>
                        ))}
                    </select>
                    <button className="linkButon" onClick={() => planiDurdur(p.plan_id)}>
                      Planı durdur
                    </button>
                  </>
                )}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
