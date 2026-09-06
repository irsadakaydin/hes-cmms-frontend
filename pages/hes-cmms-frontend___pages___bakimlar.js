import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { istekAt, tokenAl, yoneticiMi, platformAdminMi, isletmeYoneticisiMi } from "../lib/api";
import UstBar from "../components/UstBar";

const PERIYOT_ETIKETLERI = {
  GUNLUK: "Günlük",
  HAFTALIK: "Haftalık",
  AYLIK: "Aylık",
  UC_AYLIK: "3 Ayda Bir",
  ALTI_AYLIK: "6 Ayda Bir",
  YILLIK: "Yıllık",
};

const KATEGORI_SEKMELERI = [
  { deger: "DEVAM_EDEN", etiket: "Devam Eden Bakımlar" },
  { deger: "GECIKEN", etiket: "Geciken Bakımlar" },
  { deger: "TAMAMLANAN", etiket: "Tamamlanan Bakımlar" },
  { deger: "DURDURULAN", etiket: "Durdurulan Bakımlar" },
];

export default function BakimlarSayfasi() {
  const router = useRouter();
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;
  const duzenleyebilirMi = typeof window !== "undefined" ? yoneticiMi() : false;

  const [santraller, setSantraller] = useState(null);
  const [holdingler, setHoldingler] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
  const [seciliSantralId, setSeciliSantralId] = useState("");
  const [planlar, setPlanlar] = useState(null);
  const [sekme, setSekme] = useState("DEVAM_EDEN");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");
  const [hata, setHata] = useState(null);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!yoneticiMi()) {
      router.replace("/gorevler");
      return;
    }
    const istekler = [istekAt("/api/v1/santraller")];
    if (platformAdminMi()) istekler.push(istekAt("/api/v1/isletmeler"));
    Promise.all(istekler)
      .then(([s, h]) => {
        setSantraller(s.veri);
        if (h) setHoldingler(h.veri);
        if (!platformAdminMi() && s.veri.length === 1) {
          setSeciliSantralId(s.veri[0].santral_id);
        }
      })
      .catch((err) => setHata(err.message));
  }, [router]);

  // Banner'dan gelinirse (?santral_id=&sekme=) o filtreyle açılsın
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.santral_id) setSeciliSantralId(router.query.santral_id);
    if (router.query.sekme) setSekme(router.query.sekme);
  }, [router.isReady, router.query.santral_id, router.query.sekme]);

  const planlariGetir = useCallback(async () => {
    setHata(null);
    if (!seciliSantralId) {
      setPlanlar(null);
      return;
    }
    try {
      const p = new URLSearchParams();
      if (baslangic) p.set("baslangic", baslangic);
      if (bitis) p.set("bitis", bitis);
      const veri = await istekAt(`/api/v1/santraller/${seciliSantralId}/bakim-planlari?${p.toString()}`);
      setPlanlar(veri.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, [seciliSantralId, baslangic, bitis]);

  useEffect(() => {
    planlariGetir();
  }, [planlariGetir]);

  const gosterilecekSantraller = platformAdmin
    ? (santraller || []).filter((s) => s.isletme_id === seciliHoldingId)
    : santraller;

  const cokSantralliMi = (santraller || []).length > 1;

  async function planiDurdur(planId) {
    if (!confirm("Bu bakım planını durdurmak istediğinize emin misiniz?")) return;
    try {
      await istekAt(`/api/v1/bakim-planlari/${planId}/durdur`, { method: "POST" });
      await planlariGetir();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function planiAktiflestir(planId) {
    try {
      await istekAt(`/api/v1/bakim-planlari/${planId}/aktiflestir`, { method: "POST" });
      await planlariGetir();
    } catch (err) {
      setHata(err.message);
    }
  }

  const planlarBuSekmede = (planlar || []).filter((p) => p.kategori === sekme);
  const sayilar = KATEGORI_SEKMELERI.reduce((acc, s) => {
    acc[s.deger] = (planlar || []).filter((p) => p.kategori === s.deger).length;
    return acc;
  }, {});

  return (
    <>
      <Head>
        <title>Bakımlar — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Bakımlar</h2>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}

          <div className="yonetimFormu">
            {platformAdmin && (
              <div className="alan">
                <label>Holding</label>
                <select
                  value={seciliHoldingId}
                  onChange={(e) => {
                    setSeciliHoldingId(e.target.value);
                    setSeciliSantralId("");
                  }}
                >
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

            {(!platformAdmin || seciliHoldingId) && cokSantralliMi && (
              <div className="alan">
                <label>Santral</label>
                <select value={seciliSantralId} onChange={(e) => setSeciliSantralId(e.target.value)}>
                  <option value="">Bir santral seçin…</option>
                  {gosterilecekSantraller &&
                    gosterilecekSantraller.map((s) => (
                      <option key={s.santral_id} value={s.santral_id}>
                        {s.ad}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <div className="alan" style={{ flex: 1 }}>
                <label>Başlangıç tarihi (isteğe bağlı)</label>
                <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
              </div>
              <div className="alan" style={{ flex: 1 }}>
                <label>Bitiş tarihi (isteğe bağlı)</label>
                <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} />
              </div>
            </div>
          </div>

          {platformAdmin && !seciliHoldingId && (
            <div className="bosDurum">Bakımları görmek için önce bir holding seçin.</div>
          )}
          {(!platformAdmin || seciliHoldingId) && cokSantralliMi && !seciliSantralId && (
            <div className="bosDurum">Bakımları görmek için bir santral seçin.</div>
          )}

          {seciliSantralId && (
            <>
              <div className="bakimSekmeSirasi">
                {KATEGORI_SEKMELERI.map((s) => (
                  <button
                    key={s.deger}
                    type="button"
                    className={sekme === s.deger ? "bakimSekmeAktif" : "bakimSekme"}
                    onClick={() => setSekme(s.deger)}
                  >
                    {s.etiket} ({sayilar[s.deger] || 0})
                  </button>
                ))}
              </div>

              {!planlar && <div className="yukleniyor">Yükleniyor…</div>}
              {planlar && planlarBuSekmede.length === 0 && (
                <div className="bosDurum">Bu kategoride görüntülenecek bakım yok.</div>
              )}

              {planlarBuSekmede.map((p) => (
                <div className="satirKart" key={p.plan_id}>
                  <div>
                    <strong>{p.ekipman_adi}</strong> — {p.sablon_adi}
                  </div>
                  <div className="gorevAlt">
                    {PERIYOT_ETIKETLERI[p.periyot] || p.periyot}
                    {p.son_donem_tarihi &&
                      ` · Son dönem: ${new Date(p.son_donem_tarihi).toLocaleDateString("tr-TR")}`}
                    {p.son_donem_toplam > 0 && ` · ${p.son_donem_tamamlanan}/${p.son_donem_toplam} kişi onayladı`}
                  </div>
                  {p.sorumlular && p.sorumlular.length > 0 && (
                    <div className="gorevAlt">
                      Sorumlular: {p.sorumlular.map((s) => s.ad_soyad).join(", ")}
                    </div>
                  )}
                  {duzenleyebilirMi && (sekme === "DEVAM_EDEN" || sekme === "GECIKEN") && (
                    <div className="kullaniciAlt">
                      <Link href={`/santraller/${seciliSantralId}`} className="linkButon">
                        Düzenle
                      </Link>
                      <button className="linkButon" onClick={() => planiDurdur(p.plan_id)}>
                        Planı durdur
                      </button>
                    </div>
                  )}
                  {duzenleyebilirMi && sekme === "DURDURULAN" && (
                    <div className="kullaniciAlt">
                      <button className="linkButon" onClick={() => planiAktiflestir(p.plan_id)}>
                        Yeniden aktifleştir
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
