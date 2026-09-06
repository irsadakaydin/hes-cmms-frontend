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
  const [sekme, setSekme] = useState("GELEN");
  const [alicilar, setAlicilar] = useState(null);
  const [gelenler, setGelenler] = useState(null);
  const [gidenler, setGidenler] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);

  const [formuAcik, setFormuAcik] = useState(false);
  const [seciliAlicilar, setSeciliAlicilar] = useState([]);
  const [mesajIcerigi, setMesajIcerigi] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [acikMesajId, setAcikMesajId] = useState(null);

  const verileriYukle = useCallback(async () => {
    try {
      const [a, g, gi] = await Promise.all([
        istekAt("/api/v1/mesajlar/alicilar"),
        istekAt("/api/v1/mesajlar/gelen-kutusu"),
        istekAt("/api/v1/mesajlar/giden-kutusu"),
      ]);
      setAlicilar(a.veri);
      setGelenler(g.veri);
      setGidenler(gi.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, []);

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

  function yanitla(gonderenId) {
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
            <button className="kucukButon" onClick={() => setFormuAcik((v) => !v)}>
              {formuAcik ? "Vazgeç" : "+ Yeni Mesaj"}
            </button>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {formuAcik && (
            <form onSubmit={mesajGonder} className="yonetimFormu">
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
              <div className="alan">
                <label>Mesaj</label>
                <textarea
                  required
                  value={mesajIcerigi}
                  onChange={(e) => setMesajIcerigi(e.target.value)}
                  style={{ minHeight: "90px" }}
                />
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
                      <button
                        className="linkButon"
                        onClick={(e) => {
                          e.stopPropagation();
                          yanitla(m.gonderen_id);
                        }}
                      >
                        Yanıtla
                      </button>
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
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
