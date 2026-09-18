import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, kullaniciAl, yoneticiMi, platformAdminMi, dosyaIndir } from "../lib/api";
import UstBar from "../components/UstBar";

const SEKMELER = [
  { deger: "LISTE", etiket: "Depo Malzeme Listesi" },
  { deger: "GIRIS", etiket: "Malzeme Giriş" },
  { deger: "CIKIS", etiket: "Malzeme Çıkış" },
  { deger: "RAPOR", etiket: "Rapor PDF Al" },
];

export default function DepoSayfasi() {
  const router = useRouter();
  const kullanici = typeof window !== "undefined" ? kullaniciAl() : null;
  const yonetici = typeof window !== "undefined" ? yoneticiMi() : false; // Santral Sorumlusu ve üstü
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;
  const sahaVeUstu = !!kullanici && kullanici.rol !== "IZLEYICI"; // Malzeme Çıkış talebi edebilenler

  const [santraller, setSantraller] = useState(null);
  const [holdingler, setHoldingler] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
  const [seciliSantralId, setSeciliSantralId] = useState("");
  const [sekme, setSekme] = useState("LISTE");
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
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

  const gosterilecekSantraller = platformAdmin
    ? (santraller || []).filter((s) => s.isletme_id === seciliHoldingId)
    : santraller;

  return (
    <>
      <Head>
        <title>Depo — Bakım Yönetim Sistemi</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Depo</h2>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {platformAdmin && (
            <div className="alan" style={{ maxWidth: "340px" }}>
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

          {(!platformAdmin || seciliHoldingId) && gosterilecekSantraller && gosterilecekSantraller.length > 1 && (
            <div className="alan" style={{ maxWidth: "340px" }}>
              <label>Santral</label>
              <select value={seciliSantralId} onChange={(e) => setSeciliSantralId(e.target.value)}>
                <option value="">Bir santral seçin…</option>
                {gosterilecekSantraller.map((s) => (
                  <option key={s.santral_id} value={s.santral_id}>
                    {s.ad}
                  </option>
                ))}
              </select>
            </div>
          )}

          {seciliSantralId && (
            <>
              <div className="sekmeSirasi" style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                {SEKMELER.map((s) => (
                  <button
                    key={s.deger}
                    type="button"
                    className={sekme === s.deger ? "birincilButon" : "kucukButon"}
                    style={{ width: "auto" }}
                    onClick={() => {
                      setSekme(s.deger);
                      setHata(null);
                      setBilgi(null);
                    }}
                  >
                    {s.etiket}
                  </button>
                ))}
              </div>

              {sekme === "LISTE" && <MalzemeListesi santralId={seciliSantralId} />}
              {sekme === "GIRIS" && (
                <MalzemeGiris
                  santralId={seciliSantralId}
                  yonetici={yonetici}
                  setHata={setHata}
                  setBilgi={setBilgi}
                />
              )}
              {sekme === "CIKIS" && (
                <MalzemeCikis
                  santralId={seciliSantralId}
                  yonetici={yonetici}
                  sahaVeUstu={sahaVeUstu}
                  setHata={setHata}
                  setBilgi={setBilgi}
                />
              )}
              {sekme === "RAPOR" && <RaporPdfAl santralId={seciliSantralId} setHata={setHata} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
function MalzemeListesi({ santralId }) {
  const [malzemeler, setMalzemeler] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    setMalzemeler(null);
    istekAt(`/api/v1/santraller/${santralId}/depo/malzemeler`)
      .then((v) => setMalzemeler(v.veri))
      .catch((err) => setHata(err.message));
  }, [santralId]);

  return (
    <div className="yonetimFormu">
      {hata && <div className="hataKutusu">{hata}</div>}
      {!malzemeler && <div className="yukleniyor">Yükleniyor…</div>}
      {malzemeler && malzemeler.length === 0 && (
        <div className="bosDurum">Bu depoda henüz malzeme kaydı yok — Malzeme Giriş sekmesinden ekleyin.</div>
      )}
      {malzemeler &&
        malzemeler.map((m) => {
          const kritikAltinda =
            m.kritik_stok_miktari != null && Number(m.mevcut_miktar) < Number(m.kritik_stok_miktari);
          return (
            <div className="satirKart" key={m.malzeme_id}>
              <div>
                <strong>{m.ad}</strong>
                <span className="gorevAlt"> — SKU: {m.sku}</span>
                {kritikAltinda && (
                  <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>
                    ⚠ Kritik stok altında
                  </span>
                )}
              </div>
              <div className="gorevAlt">
                Miktar: {m.mevcut_miktar} {m.birim}
                {m.kritik_stok_miktari != null && ` · Kritik sınır: ${m.kritik_stok_miktari} ${m.birim}`}
                {m.konum && ` · Konum: ${m.konum}`}
                {m.barkod && ` · Barkod: ${m.barkod}`}
              </div>
            </div>
          );
        })}
    </div>
  );
}

// ---------------------------------------------------------------------
function MalzemeGiris({ santralId, yonetici, setHata, setBilgi }) {
  const bosForm = { sku: "", ad: "", barkod: "", birim: "Adet", miktar: "", kritik_stok_miktari: "", konum: "" };
  const [form, setForm] = useState(bosForm);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [gecmis, setGecmis] = useState(null);

  const gecmisiGetir = useCallback(() => {
    istekAt(`/api/v1/santraller/${santralId}/depo/giris`)
      .then((v) => setGecmis(v.veri))
      .catch((err) => setHata(err.message));
  }, [santralId, setHata]);

  useEffect(() => {
    gecmisiGetir();
  }, [gecmisiGetir]);

  if (!yonetici) {
    return (
      <div className="bosDurum">
        Malzeme Girişi yalnızca Santral Sorumlusu ve üstü yetkiye sahip kullanıcılar tarafından yapılabilir.
      </div>
    );
  }

  async function gonder(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    setGonderiliyor(true);
    try {
      const sonuc = await istekAt(`/api/v1/santraller/${santralId}/depo/giris`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          miktar: Number(form.miktar),
          kritik_stok_miktari: form.kritik_stok_miktari ? Number(form.kritik_stok_miktari) : null,
        }),
      });
      setBilgi(`Malzeme girişi kaydedildi — Fiş No: ${sonuc.giris.fis_no}`);
      setForm(bosForm);
      gecmisiGetir();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <>
      <form onSubmit={gonder} className="yonetimFormu">
        <div className="alan">
          <label>Malzeme Kodu (SKU)</label>
          <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </div>
        <div className="alan">
          <label>Malzeme Adı / Açıklaması</label>
          <input required value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
        </div>
        <div className="alan">
          <label>Barkod / Karekod (isteğe bağlı)</label>
          <input value={form.barkod} onChange={(e) => setForm({ ...form, barkod: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div className="alan" style={{ flex: 1 }}>
            <label>Miktar</label>
            <input
              required
              type="number"
              step="any"
              min="0.001"
              value={form.miktar}
              onChange={(e) => setForm({ ...form, miktar: e.target.value })}
            />
          </div>
          <div className="alan" style={{ flex: 1 }}>
            <label>Birim (Adet, Koli, Ton…)</label>
            <input required value={form.birim} onChange={(e) => setForm({ ...form, birim: e.target.value })} />
          </div>
        </div>
        <div className="alan">
          <label>Kritik Stok Miktarı (isteğe bağlı — altına düşünce uyarı gider)</label>
          <input
            type="number"
            step="any"
            min="0"
            value={form.kritik_stok_miktari}
            onChange={(e) => setForm({ ...form, kritik_stok_miktari: e.target.value })}
          />
        </div>
        <div className="alan">
          <label>Malzemenin Konumu (isteğe bağlı)</label>
          <input value={form.konum} onChange={(e) => setForm({ ...form, konum: e.target.value })} placeholder="Ör. Raf A-3" />
        </div>
        <button className="birincilButon" type="submit" disabled={gonderiliyor}>
          {gonderiliyor ? "Kaydediliyor…" : "Malzeme Girişini Kaydet"}
        </button>
      </form>

      <div className="yonetimFormu">
        <h3 style={{ marginTop: 0 }}>Giriş Geçmişi</h3>
        {!gecmis && <div className="yukleniyor">Yükleniyor…</div>}
        {gecmis && gecmis.length === 0 && <div className="bosDurum">Henüz giriş kaydı yok.</div>}
        {gecmis &&
          gecmis.map((g) => (
            <div className="satirKart" key={g.giris_id}>
              <div>
                <strong>{g.fis_no}</strong> — {g.malzeme_adi}
              </div>
              <div className="gorevAlt">
                {new Date(g.giris_tarihi).toLocaleString("tr-TR")} · {g.miktar} {g.birim} · Teslim alan:{" "}
                {g.teslim_alan_adi || "—"}
              </div>
            </div>
          ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
function MalzemeCikis({ santralId, yonetici, sahaVeUstu, setHata, setBilgi }) {
  const [malzemeler, setMalzemeler] = useState(null);
  const [talepler, setTalepler] = useState(null);
  const [malzemeId, setMalzemeId] = useState("");
  const [miktar, setMiktar] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const yenile = useCallback(() => {
    istekAt(`/api/v1/santraller/${santralId}/depo/malzemeler`)
      .then((v) => setMalzemeler(v.veri))
      .catch((err) => setHata(err.message));
    istekAt(`/api/v1/santraller/${santralId}/depo/cikis`)
      .then((v) => setTalepler(v.veri))
      .catch((err) => setHata(err.message));
  }, [santralId, setHata]);

  useEffect(() => {
    yenile();
  }, [yenile]);

  async function talepGonder(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    setGonderiliyor(true);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/depo/cikis-talep`, {
        method: "POST",
        body: JSON.stringify({ malzeme_id: malzemeId, miktar: Number(miktar) }),
      });
      setBilgi("Çıkış talebi oluşturuldu — Santral Sorumlusu/İşletme Admin onayı bekleniyor.");
      setMalzemeId("");
      setMiktar("");
      yenile();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function onayla(cikisId) {
    setHata(null);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/depo/cikis/${cikisId}/onayla`, { method: "POST" });
      setBilgi("Çıkış onaylandı ve stoktan düşüldü.");
      yenile();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function reddet(cikisId) {
    const not = prompt("Ret nedeni (isteğe bağlı):") || "";
    setHata(null);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/depo/cikis/${cikisId}/reddet`, {
        method: "POST",
        body: JSON.stringify({ red_notu: not }),
      });
      setBilgi("Çıkış talebi reddedildi.");
      yenile();
    } catch (err) {
      setHata(err.message);
    }
  }

  const DURUM_ETIKETLERI = { BEKLIYOR: "Bekliyor", ONAYLANDI: "Onaylandı", REDDEDILDI: "Reddedildi" };

  return (
    <>
      {sahaVeUstu && (
        <form onSubmit={talepGonder} className="yonetimFormu">
          <h3 style={{ marginTop: 0 }}>Yeni Çıkış Talebi</h3>
          <div className="alan">
            <label>Malzeme</label>
            <select required value={malzemeId} onChange={(e) => setMalzemeId(e.target.value)}>
              <option value="">Seçin…</option>
              {(malzemeler || []).map((m) => (
                <option key={m.malzeme_id} value={m.malzeme_id}>
                  {m.ad} (SKU: {m.sku}) — mevcut: {m.mevcut_miktar} {m.birim}
                </option>
              ))}
            </select>
          </div>
          <div className="alan">
            <label>Miktar</label>
            <input required type="number" step="any" min="0.001" value={miktar} onChange={(e) => setMiktar(e.target.value)} />
          </div>
          <button className="birincilButon" type="submit" disabled={gonderiliyor}>
            {gonderiliyor ? "Gönderiliyor…" : "Çıkış Talebi Gönder"}
          </button>
        </form>
      )}

      <div className="yonetimFormu">
        <h3 style={{ marginTop: 0 }}>{yonetici ? "Tüm Çıkış Talepleri" : "Taleplerim"}</h3>
        {!talepler && <div className="yukleniyor">Yükleniyor…</div>}
        {talepler && talepler.length === 0 && <div className="bosDurum">Henüz çıkış talebi yok.</div>}
        {talepler &&
          talepler.map((t) => (
            <div className="satirKart" key={t.cikis_id}>
              <div>
                <strong>{t.malzeme_adi}</strong> — {t.miktar} {t.birim}
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: t.durum === "ONAYLANDI" ? "#2f6d3e" : t.durum === "REDDEDILDI" ? "#a83b2e" : "#c17a24",
                    color: "#fff",
                  }}
                >
                  {DURUM_ETIKETLERI[t.durum]}
                </span>
              </div>
              <div className="gorevAlt">
                Talep eden: {t.talep_eden_adi} · {new Date(t.talep_tarihi).toLocaleString("tr-TR")}
                {t.fis_no && ` · Fiş No: ${t.fis_no}`}
                {t.onaylayan_adi && ` · İşlemi yapan: ${t.onaylayan_adi}`}
                {t.red_notu && ` · Not: ${t.red_notu}`}
              </div>
              {yonetici && t.durum === "BEKLIYOR" && (
                <div className="kullaniciAlt">
                  <button className="linkButon" onClick={() => onayla(t.cikis_id)}>
                    Onayla
                  </button>
                  <button className="linkButon" onClick={() => reddet(t.cikis_id)}>
                    Reddet
                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
function RaporPdfAl({ santralId, setHata }) {
  const [tip, setTip] = useState("giris");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");
  const [indiriliyor, setIndiriliyor] = useState(false);

  async function indir() {
    setHata(null);
    setIndiriliyor(true);
    try {
      const p = new URLSearchParams({ tip });
      if (baslangic) p.set("baslangic", baslangic);
      if (bitis) p.set("bitis", bitis);
      await dosyaIndir(`/api/v1/santraller/${santralId}/depo/rapor/pdf?${p.toString()}`, `depo-${tip}-raporu.pdf`);
    } catch (err) {
      setHata(err.message);
    } finally {
      setIndiriliyor(false);
    }
  }

  return (
    <div className="yonetimFormu">
      <div className="alan">
        <label>Rapor Türü</label>
        <select value={tip} onChange={(e) => setTip(e.target.value)}>
          <option value="giris">Malzeme Giriş Raporu</option>
          <option value="cikis">Malzeme Çıkış Raporu</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <div className="alan" style={{ flex: 1 }}>
          <label>Başlangıç Tarihi (isteğe bağlı)</label>
          <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
        </div>
        <div className="alan" style={{ flex: 1 }}>
          <label>Bitiş Tarihi (isteğe bağlı)</label>
          <input type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} />
        </div>
      </div>
      <button className="birincilButon" onClick={indir} disabled={indiriliyor}>
        {indiriliyor ? "İndiriliyor…" : "PDF Olarak İndir"}
      </button>
    </div>
  );
}
