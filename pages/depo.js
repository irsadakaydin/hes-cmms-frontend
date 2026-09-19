import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, kullaniciAl, yoneticiMi, platformAdminMi, dosyaIndir } from "../lib/api";
import UstBar from "../components/UstBar";

export default function DepoSayfasi() {
  const router = useRouter();
  const kullanici = typeof window !== "undefined" ? kullaniciAl() : null;
  const yonetici = typeof window !== "undefined" ? yoneticiMi() : false; // Santral Sorumlusu ve üstü — onaycılar
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;
  const sahaVeUstu = !!kullanici && kullanici.rol !== "IZLEYICI"; // Malzeme Çıkış talebi edebilenler

  const SEKMELER = [
    { deger: "LISTE", etiket: "Depo Malzeme Listesi" },
    { deger: "GIRIS", etiket: "Malzeme Giriş" },
    { deger: "CIKIS", etiket: "Malzeme Çıkış" },
    ...(yonetici
      ? [
          { deger: "CIKIS_ONAY", etiket: "Bekleyen Malzeme Çıkış Onayları" },
          { deger: "CIKIS_RED", etiket: "Red Edilen Malzeme Çıkışları" },
        ]
      : [{ deger: "BEKLEYEN_ONAYLAR", etiket: "Bekleyen Onaylar" }]),
    { deger: "RAPOR", etiket: "Rapor PDF Al" },
  ];

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
              <div className="sekmeSirasi" style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
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
                <MalzemeGiris santralId={seciliSantralId} yonetici={yonetici} setHata={setHata} setBilgi={setBilgi} />
              )}
              {sekme === "CIKIS" && (
                <MalzemeCikis santralId={seciliSantralId} sahaVeUstu={sahaVeUstu} setHata={setHata} setBilgi={setBilgi} />
              )}
              {sekme === "CIKIS_ONAY" && yonetici && (
                <CikisOnay santralId={seciliSantralId} setHata={setHata} setBilgi={setBilgi} />
              )}
              {sekme === "CIKIS_RED" && yonetici && <CikisRed santralId={seciliSantralId} setHata={setHata} />}
              {sekme === "BEKLEYEN_ONAYLAR" && !yonetici && (
                <BekleyenOnaylar santralId={seciliSantralId} kullaniciId={kullanici?.kullanici_id} setHata={setHata} />
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
  const [acikKarekodId, setAcikKarekodId] = useState(null);

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
              <div className="kullaniciAlt">
                <button
                  className="linkButon"
                  onClick={() => setAcikKarekodId(acikKarekodId === m.malzeme_id ? null : m.malzeme_id)}
                >
                  {acikKarekodId === m.malzeme_id ? "Karekodu Gizle" : "Karekod Oluştur"}
                </button>
              </div>
              {acikKarekodId === m.malzeme_id && <MalzemeKarekod malzeme={m} />}
            </div>
          );
        })}
    </div>
  );
}

/** Bir malzemenin karekodunu gösterir ve indirilebilir hale getirir.
 * Karekod, bu malzemenin çıkış-talep sayfasının bağlantısını taşır —
 * herhangi bir kullanıcı telefonuyla okutup doğrudan çıkış talebi
 * oluşturabilir. */
function MalzemeKarekod({ malzeme }) {
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/depo-karekod/${malzeme.malzeme_id}` : "";
  const karekodResmi = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}`;
  const [indiriliyor, setIndiriliyor] = useState(false);
  const [hata, setHata] = useState(null);

  async function pdfIndir() {
    setHata(null);
    setIndiriliyor(true);
    try {
      const p = new URLSearchParams({ hedef_url: url });
      await dosyaIndir(
        `/api/v1/depo/malzemeler/${malzeme.malzeme_id}/karekod-pdf?${p.toString()}`,
        `karekod-${malzeme.sku}.pdf`
      );
    } catch (err) {
      setHata(err.message);
    } finally {
      setIndiriliyor(false);
    }
  }

  return (
    <div style={{ marginTop: "10px", padding: "12px", background: "var(--paper)", borderRadius: "10px" }}>
      {hata && <div className="hataKutusu">{hata}</div>}
      <img src={karekodResmi} alt={`${malzeme.ad} karekodu`} width={180} height={180} />
      <div style={{ marginTop: "8px", display: "flex", gap: "10px" }}>
        <button type="button" className="linkButon" onClick={pdfIndir} disabled={indiriliyor}>
          {indiriliyor ? "Hazırlanıyor…" : "⬇ Karekodu PDF Olarak İndir"}
        </button>
      </div>
      <div className="gorevAlt" style={{ marginTop: "6px" }}>
        Bu karekodu okutan kullanıcı, oturum açıksa doğrudan bu malzeme için çıkış talebi oluşturabilir.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
function MalzemeGiris({ santralId, yonetici, setHata, setBilgi }) {
  const bosForm = { sku: "", ad: "", barkod: "", birim: "Adet", miktar: "", kritik_stok_miktari: "", konum: "" };
  const [form, setForm] = useState(bosForm);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [gecmis, setGecmis] = useState(null);
  const [malzemeler, setMalzemeler] = useState(null);

  const gecmisiGetir = useCallback(() => {
    istekAt(`/api/v1/santraller/${santralId}/depo/giris`)
      .then((v) => setGecmis(v.veri))
      .catch((err) => setHata(err.message));
  }, [santralId, setHata]);

  useEffect(() => {
    gecmisiGetir();
    istekAt(`/api/v1/santraller/${santralId}/depo/malzemeler`)
      .then((v) => setMalzemeler(v.veri))
      .catch((err) => setHata(err.message));
  }, [gecmisiGetir, santralId, setHata]);

  // SKU kutusuna daha önce girilmiş bir malzemenin kodu yazılınca/seçilince
  // Miktar HARİÇ diğer tüm alanları o malzemenin son bilgileriyle otomatik
  // doldurur — aynı malzemeyi tekrar tekrar elle girmeye gerek kalmasın.
  function skuDegisti(deger) {
    const eslesen = (malzemeler || []).find((m) => m.sku === deger);
    if (eslesen) {
      setForm((f) => ({
        ...f,
        sku: deger,
        ad: eslesen.ad,
        barkod: eslesen.barkod || "",
        birim: eslesen.birim,
        kritik_stok_miktari: eslesen.kritik_stok_miktari ?? "",
        konum: eslesen.konum || "",
      }));
    } else {
      setForm((f) => ({ ...f, sku: deger }));
    }
  }

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
      istekAt(`/api/v1/santraller/${santralId}/depo/malzemeler`)
        .then((v) => setMalzemeler(v.veri))
        .catch(() => {});
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
          <input
            required
            list="depo-malzeme-oneri"
            value={form.sku}
            onChange={(e) => skuDegisti(e.target.value)}
            autoComplete="off"
            placeholder="Tıklayınca daha önce girilmiş malzemeler önerilir"
          />
          <datalist id="depo-malzeme-oneri">
            {(malzemeler || []).map((m) => (
              <option key={m.malzeme_id} value={m.sku}>
                {m.ad}
              </option>
            ))}
          </datalist>
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
// Yalnızca YENİ ÇIKIŞ TALEBİ oluşturma formu — onaylama/reddetme ayrı
// sekmelere taşındı (Malzeme Çıkış Onay / Bekleyen Onaylar).
function MalzemeCikis({ santralId, sahaVeUstu, setHata, setBilgi }) {
  const [malzemeler, setMalzemeler] = useState(null);
  const [malzemeId, setMalzemeId] = useState("");
  const [miktar, setMiktar] = useState("");
  const [kullanimYeri, setKullanimYeri] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  useEffect(() => {
    istekAt(`/api/v1/santraller/${santralId}/depo/malzemeler`)
      .then((v) => setMalzemeler(v.veri))
      .catch((err) => setHata(err.message));
  }, [santralId, setHata]);

  if (!sahaVeUstu) {
    return <div className="bosDurum">Çıkış talebi oluşturma yetkiniz yok.</div>;
  }

  async function talepGonder(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    const secilenMalzeme = (malzemeler || []).find((m) => m.malzeme_id === malzemeId);
    if (secilenMalzeme && Number(secilenMalzeme.mevcut_miktar) < Number(miktar)) {
      setHata("Depoda talep ettiğiniz miktarda malzeme bulunmamaktadır.");
      return;
    }
    setGonderiliyor(true);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/depo/cikis-talep`, {
        method: "POST",
        body: JSON.stringify({ malzeme_id: malzemeId, miktar: Number(miktar), kullanim_yeri: kullanimYeri || null }),
      });
      setBilgi("Çıkış talebi oluşturuldu — Santral Sorumlusu/İşletme Admin onayı bekleniyor. Durumu \"Bekleyen Onaylar\" sekmesinden takip edebilirsiniz.");
      setMalzemeId("");
      setMiktar("");
      setKullanimYeri("");
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
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
      <div className="alan">
        <label>Malzemenin Kullanım Yeri</label>
        <input
          value={kullanimYeri}
          onChange={(e) => setKullanimYeri(e.target.value)}
          placeholder="Ör. Ünite 2 Türbin Yatağı, Şalt Sahası…"
        />
      </div>
      <button className="birincilButon" type="submit" disabled={gonderiliyor}>
        {gonderiliyor ? "Gönderiliyor…" : "Çıkış Talebi Gönder"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------
// MALZEME ÇIKIŞ ONAY — yalnızca onaycılar (Santral Sorumlusu ve üstü)
// görür. Bekleyen TÜM talepleri listeler, her birinin yanında Onayla/
// Reddet var.
function CikisOnay({ santralId, setHata, setBilgi }) {
  const [talepler, setTalepler] = useState(null);
  const [redAcikId, setRedAcikId] = useState(null);
  const [redNotu, setRedNotu] = useState("");

  const yenile = useCallback(() => {
    istekAt(`/api/v1/santraller/${santralId}/depo/cikis?durum=BEKLIYOR`)
      .then((v) => setTalepler(v.veri))
      .catch((err) => setHata(err.message));
  }, [santralId, setHata]);

  useEffect(() => {
    yenile();
  }, [yenile]);

  async function onayla(cikisId) {
    setHata(null);
    setBilgi(null);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/depo/cikis/${cikisId}/onayla`, { method: "POST" });
      setBilgi("Çıkış onaylandı ve stoktan düşüldü.");
      yenile();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function reddet(cikisId) {
    setHata(null);
    setBilgi(null);
    try {
      await istekAt(`/api/v1/santraller/${santralId}/depo/cikis/${cikisId}/reddet`, {
        method: "POST",
        body: JSON.stringify({ red_notu: redNotu }),
      });
      setBilgi("Çıkış talebi reddedildi — talep eden kullanıcıya bildirim gönderildi.");
      setRedAcikId(null);
      setRedNotu("");
      yenile();
    } catch (err) {
      setHata(err.message);
    }
  }

  return (
    <div className="yonetimFormu">
      <h3 style={{ marginTop: 0 }}>Bekleyen Çıkış Talepleri</h3>
      {!talepler && <div className="yukleniyor">Yükleniyor…</div>}
      {talepler && talepler.length === 0 && <div className="bosDurum">Bekleyen çıkış talebi yok.</div>}
      {talepler &&
        talepler.map((t) => (
          <div className="satirKart" key={t.cikis_id}>
            <div>
              <strong>{t.malzeme_adi}</strong> — {t.miktar} {t.birim}
            </div>
            <div className="gorevAlt">
              Talep eden: {t.talep_eden_adi} · {new Date(t.talep_tarihi).toLocaleString("tr-TR")}
              {t.kullanim_yeri && ` · Kullanım yeri: ${t.kullanim_yeri}`}
            </div>
            <div className="kullaniciAlt" style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "6px" }}>
              <button className="birincilButon" style={{ width: "auto" }} onClick={() => onayla(t.cikis_id)}>
                ✓ Onayla
              </button>
              {redAcikId === t.cikis_id ? (
                <>
                  <input
                    placeholder="Ret nedeni (isteğe bağlı)"
                    value={redNotu}
                    onChange={(e) => setRedNotu(e.target.value)}
                    style={{ flex: 1, maxWidth: "260px" }}
                  />
                  <button className="linkButon" onClick={() => reddet(t.cikis_id)}>
                    Reddi Onayla
                  </button>
                  <button className="linkButon" onClick={() => setRedAcikId(null)}>
                    Vazgeç
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="kucukButon"
                  style={{ background: "#a83b2e", width: "auto" }}
                  onClick={() => {
                    setRedAcikId(t.cikis_id);
                    setRedNotu("");
                  }}
                >
                  ✕ Reddet
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// MALZEME ÇIKIŞ RED — yalnızca onaycılar görür; yalnızca REDDEDİLMİŞ
// talepleri (geçmiş) gösterir.
function CikisRed({ santralId, setHata }) {
  const [talepler, setTalepler] = useState(null);

  useEffect(() => {
    istekAt(`/api/v1/santraller/${santralId}/depo/cikis?durum=REDDEDILDI`)
      .then((v) => setTalepler(v.veri))
      .catch((err) => setHata(err.message));
  }, [santralId, setHata]);

  return (
    <div className="yonetimFormu">
      <h3 style={{ marginTop: 0 }}>Reddedilen Çıkış Talepleri</h3>
      {!talepler && <div className="yukleniyor">Yükleniyor…</div>}
      {talepler && talepler.length === 0 && <div className="bosDurum">Reddedilen talep yok.</div>}
      {talepler &&
        talepler.map((t) => (
          <div className="satirKart" key={t.cikis_id}>
            <div>
              <strong>{t.malzeme_adi}</strong> — {t.miktar} {t.birim}
            </div>
            <div className="gorevAlt">
              Talep eden: {t.talep_eden_adi} · Reddeden: {t.onaylayan_adi || "—"} ·{" "}
              {new Date(t.talep_tarihi).toLocaleString("tr-TR")}
              {t.kullanim_yeri && ` · Kullanım yeri: ${t.kullanim_yeri}`}
              {t.red_notu && ` · Not: ${t.red_notu}`}
            </div>
          </div>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// BEKLEYEN ONAYLAR — onaycı OLMAYAN kullanıcılar için: kendi gönderdikleri,
// henüz onaylanmamış (BEKLIYOR) talepleri gösterir.
function BekleyenOnaylar({ santralId, kullaniciId, setHata }) {
  const [talepler, setTalepler] = useState(null);

  useEffect(() => {
    istekAt(`/api/v1/santraller/${santralId}/depo/cikis?durum=BEKLIYOR`)
      .then((v) => setTalepler(v.veri.filter((t) => t.talep_eden_kullanici_id === kullaniciId)))
      .catch((err) => setHata(err.message));
  }, [santralId, kullaniciId, setHata]);

  return (
    <div className="yonetimFormu">
      <h3 style={{ marginTop: 0 }}>Bekleyen Onaylar</h3>
      {!talepler && <div className="yukleniyor">Yükleniyor…</div>}
      {talepler && talepler.length === 0 && <div className="bosDurum">Onay bekleyen talebiniz yok.</div>}
      {talepler &&
        talepler.map((t) => (
          <div className="satirKart" key={t.cikis_id}>
            <div>
              <strong>{t.malzeme_adi}</strong> — {t.miktar} {t.birim}
            </div>
            <div className="gorevAlt">
              {new Date(t.talep_tarihi).toLocaleString("tr-TR")} · Onay bekliyor
              {t.kullanim_yeri && ` · Kullanım yeri: ${t.kullanim_yeri}`}
            </div>
          </div>
        ))}
    </div>
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
