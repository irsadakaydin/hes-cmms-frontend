import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, yoneticiMi } from "../lib/api";
import UstBar from "../components/UstBar";

function tarihSaatFormatla(deger) {
  if (!deger) return "";
  return new Date(deger).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MesajlarSayfasi() {
  const router = useRouter();
  const yonetici = typeof window !== "undefined" ? yoneticiMi() : false;

  const [sekme, setSekme] = useState("GELEN");
  const [alicilar, setAlicilar] = useState(null);
  const [gelenler, setGelenler] = useState(null);
  const [gidenler, setGidenler] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);

  const [formuAcik, setFormuAcik] = useState(false);
  const [yanitVerilenId, setYanitVerilenId] = useState(null); // sadece yönetici olmayanlar icin
  const [yanitVerilenAd, setYanitVerilenAd] = useState("");
  const [seciliAlicilar, setSeciliAlicilar] = useState([]);
  const [mesajIcerigi, setMesajIcerigi] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [acikMesajId, setAcikMesajId] = useState(null);

  const verileriYukle = useCallback(async () => {
    try {
      const istekler = [istekAt("/api/v1/mesajlar/gelen-kutusu"), istekAt("/api/v1/mesajlar/giden-kutusu")];
      if (yonetici) istekler.push(istekAt("/api/v1/mesajlar/alicilar"));
      const sonuclar = await Promise.all(istekler);
      setGelenler(sonuclar[0].veri);
      setGidenler(sonuclar[1].veri);
      if (sonuclar[2]) setAlicilar(sonuclar[2].veri);
    } catch (err) {
      setHata(err.message);
    }
  }, [yonetici]);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    verileriYukle();
  }, [verileriYukle, router]);

  function aliciSecimiDegistir(kullaniciId) {
    setSeciliAlicilar((onceki) =>
      onceki.includes(kullaniciId) ? onceki.filter((id) => id !== kullaniciId) : [...onceki, kullaniciId]
    );
  }

  function hepsiniSec() {
    setSeciliAlicilar(alicilar.map((k) => k.kullanici_id));
  }

  function secimiTemizle() {
    setSeciliAlicilar([]);
  }

  function yeniMesajBaslat() {
    setYanitVerilenId(null);
    setYanitVerilenAd("");
    setSeciliAlicilar([]);
    setMesajIcerigi("");
    setFormuAcik((v) => !v);
  }

  function yanitla(gonderenId, gonderenAdi) {
    setYanitVerilenId(gonderenId);
    setYanitVerilenAd(gonderenAdi);
    setSeciliAlicilar([gonderenId]);
    setMesajIcerigi("");
    setFormuAcik(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function mesajGonder(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    if (seciliAlicilar.length === 0) {
      setHata("En az bir alıcı seçmelisiniz.");
      return;
    }
    if (!mesajIcerigi.trim()) {
      setHata("Mesaj içeriği boş olamaz.");
      return;
    }
    setGonderiliyor(true);
    try {
      const sonuc = await istekAt("/api/v1/mesajlar", {
        method: "POST",
        body: JSON.stringify({ alici_kullanici_idleri: seciliAlicilar, icerik: mesajIcerigi }),
      });
      setBilgi(sonuc.mesaj);
      setSeciliAlicilar([]);
      setMesajIcerigi("");
      setFormuAcik(false);
      await verileriYukle();
      setSekme("GIDEN");
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function mesajiAc(mesaj) {
    setAcikMesajId(acikMesajId === mesaj.mesaj_id ? null : mesaj.mesaj_id);
    if (!mesaj.okundu_mu) {
      try {
        await istekAt(`/api/v1/mesajlar/${mesaj.mesaj_id}/okundu-isaretle`, { method: "POST" });
        setGelenler((onceki) =>
          onceki.map((m) => (m.mesaj_id === mesaj.mesaj_id ? { ...m, okundu_mu: true } : m))
        );
      } catch (err) {
        // sessiz geç — okundu işareti önemli ama mesajı açmayı engellemesin
      }
    }
  }

  async function mesajSil(mesajId, hangiKutu) {
    if (!confirm("Bu mesajı kalıcı olarak silmek istediğinize emin misiniz?")) return;
    setHata(null);
    try {
      await istekAt(`/api/v1/mesajlar/${mesajId}`, { method: "DELETE" });
      if (hangiKutu === "GELEN") {
        setGelenler((onceki) => onceki.filter((m) => m.mesaj_id !== mesajId));
      } else {
        setGidenler((onceki) => onceki.filter((m) => m.mesaj_id !== mesajId));
      }
    } catch (err) {
      setHata(err.message);
    }
  }

  return (
    <>
      <Head>
        <title>Mesajlar — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Mesajlar</h2>
            {yonetici && (
              <button className="kucukButon" onClick={yeniMesajBaslat}>
                {formuAcik && !yanitVerilenId ? "Vazgeç" : "+ Yeni Mesaj"}
              </button>
            )}
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {formuAcik && (
            <form onSubmit={mesajGonder} className="yonetimFormu">
              {yanitVerilenId ? (
                <div className="alan">
                  <label>Kime</label>
                  <div style={{ fontSize: "14px" }}>{yanitVerilenAd}</div>
                </div>
              ) : (
                <div className="alan">
                  <label>Alıcılar</label>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                    <button type="button" className="linkButon" onClick={hepsiniSec}>
                      Hepsini seç
                    </button>
                    <button type="button" className="linkButon" onClick={secimiTemizle}>
                      Seçimi temizle
                    </button>
                  </div>
                  <div className="aliciListesi">
                    {alicilar &&
                      alicilar.map((k) => (
                        <label key={k.kullanici_id} className="aliciSatiri">
                          <input
                            type="checkbox"
                            checked={seciliAlicilar.includes(k.kullanici_id)}
                            onChange={() => aliciSecimiDegistir(k.kullanici_id)}
                          />
                          {k.ad_soyad} <span className="gorevAlt">({k.rol})</span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
              <div className="alan">
                <label>Mesaj</label>
                <textarea required value={mesajIcerigi} onChange={(e) => setMesajIcerigi(e.target.value)} />
              </div>
              <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                {gonderiliyor ? "Gönderiliyor…" : `Gönder (${seciliAlicilar.length} kişiye)`}
              </button>
            </form>
          )}

          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <button
              type="button"
              className={sekme === "GELEN" ? "planSekmeAktif" : "planSekme"}
              onClick={() => setSekme("GELEN")}
            >
              Gelen Kutusu {gelenler && `(${gelenler.filter((m) => !m.okundu_mu).length} okunmamış)`}
            </button>
            <button
              type="button"
              className={sekme === "GIDEN" ? "planSekmeAktif" : "planSekme"}
              onClick={() => setSekme("GIDEN")}
            >
              Gönderilenler
            </button>
          </div>

          {sekme === "GELEN" && (
            <>
              {!gelenler && <div className="yukleniyor">Yükleniyor…</div>}
              {gelenler && gelenler.length === 0 && <div className="bosDurum">Gelen kutunuz boş.</div>}
              {gelenler &&
                gelenler.map((m) => (
                  <div
                    className={`mesajKarti ${!m.okundu_mu ? "mesajOkunmamis" : ""}`}
                    key={m.mesaj_id}
                    onClick={() => mesajiAc(m)}
                  >
                    <div className="mesajUst">
                      <strong>{m.gonderen_adi}</strong>
                      <span className="gorevAlt">{tarihSaatFormatla(m.gonderim_tarihi)}</span>
                    </div>
                    <div className={acikMesajId === m.mesaj_id ? "mesajIcerikAcik" : "mesajIcerikKapali"}>
                      {m.icerik}
                    </div>
                    {acikMesajId === m.mesaj_id && (
                      <div style={{ display: "flex", gap: "14px" }}>
                        <button
                          className="linkButon"
                          onClick={(e) => {
                            e.stopPropagation();
                            yanitla(m.gonderen_id, m.gonderen_adi);
                          }}
                        >
                          Yanıtla
                        </button>
                        {yonetici && (
                          <button
                            className="linkButon"
                            onClick={(e) => {
                              e.stopPropagation();
                              mesajSil(m.mesaj_id, "GELEN");
                            }}
                          >
                            Sil
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </>
          )}

          {sekme === "GIDEN" && (
            <>
              {!gidenler && <div className="yukleniyor">Yükleniyor…</div>}
              {gidenler && gidenler.length === 0 && <div className="bosDurum">Henüz mesaj göndermediniz.</div>}
              {gidenler &&
                gidenler.map((m) => (
                  <div className="mesajKarti" key={m.mesaj_id}>
                    <div className="mesajUst">
                      <strong>{m.alici_adi}</strong>
                      <span className="gorevAlt">{tarihSaatFormatla(m.gonderim_tarihi)}</span>
                    </div>
                    <div className="mesajIcerikAcik">{m.icerik}</div>
                    <div className={`okunduCizgisi ${m.okundu_mu ? "okunduYesil" : "okunduKirmizi"}`}>
                      {m.okundu_mu ? `✓ Okundu — ${tarihSaatFormatla(m.okunma_tarihi)}` : "Henüz okunmadı"}
                    </div>
                    {yonetici && (
                      <button className="linkButon" onClick={() => mesajSil(m.mesaj_id, "GIDEN")}>
                        Sil
                      </button>
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
