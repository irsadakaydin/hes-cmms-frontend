import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { girisYap, tokenAl } from "../lib/api";

export default function GirisSayfasi() {
  const router = useRouter();
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(null);
  const [hesapSecimi, setHesapSecimi] = useState(null); // {isletme_id, isletme_adi}[] | null

  useEffect(() => {
    if (tokenAl()) {
      router.replace(router.query.sonra ? decodeURIComponent(router.query.sonra) : "/gorevler");
    }
  }, [router, router.query.sonra]);

  async function girisiTamamla(isletme_id) {
    setHata(null);
    setYukleniyor(true);
    try {
      await girisYap(eposta, sifre, isletme_id);
      router.push(router.query.sonra ? decodeURIComponent(router.query.sonra) : "/gorevler");
    } catch (err) {
      setHata(err.message || "Giriş yapılamadı.");
      setHesapSecimi(null);
    } finally {
      setYukleniyor(false);
    }
  }

  async function gonder(e) {
    e.preventDefault();
    setHata(null);
    setYukleniyor(true);
    try {
      await girisYap(eposta, sifre);
      router.push(router.query.sonra ? decodeURIComponent(router.query.sonra) : "/gorevler");
    } catch (err) {
      // Aynı e-posta birden fazla holdingde kayıtlıysa, hangisiyle giriş
      // yapılacağını sorup seçilenle tekrar dener.
      if (err.hata_kodu === "BIRDEN_FAZLA_HESAP" && err.detay?.hesaplar) {
        setHesapSecimi(err.detay.hesaplar);
      } else {
        setHata(err.message || "Giriş yapılamadı.");
      }
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <>
      <Head>
        <title>Giriş — HES Bakım Yönetim Sistemi</title>
      </Head>
      <div className="girisSayfasi">
        <div className="girisKutu">
          <div className="girisUst">
            <h1>Bakım Yönetim Sistemine Giriş</h1>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}

          {hesapSecimi ? (
            <div>
              <p className="gorevAlt" style={{ marginBottom: "10px" }}>
                Bu e-posta birden fazla holdingde kayıtlı. Giriş yapmak istediğiniz holdingi seçin:
              </p>
              {hesapSecimi.map((h) => (
                <button
                  key={h.isletme_id}
                  type="button"
                  className="birincilButon"
                  style={{ marginBottom: "8px" }}
                  disabled={yukleniyor}
                  onClick={() => girisiTamamla(h.isletme_id)}
                >
                  {h.isletme_adi}
                </button>
              ))}
              <button type="button" className="linkButon" onClick={() => setHesapSecimi(null)}>
                ← Geri dön
              </button>
            </div>
          ) : (
            <form onSubmit={gonder}>
              <div className="alan">
                <label htmlFor="eposta">E-posta</label>
                <input
                  id="eposta"
                  type="email"
                  autoComplete="username"
                  value={eposta}
                  onChange={(e) => setEposta(e.target.value)}
                  required
                />
              </div>
              <div className="alan">
                <label htmlFor="sifre">Şifre</label>
                <input
                  id="sifre"
                  type="password"
                  autoComplete="current-password"
                  value={sifre}
                  onChange={(e) => setSifre(e.target.value)}
                  required
                />
              </div>
              <button className="birincilButon" type="submit" disabled={yukleniyor}>
                {yukleniyor ? "Giriş yapılıyor…" : "Giriş Yap"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
