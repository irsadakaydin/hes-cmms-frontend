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

  useEffect(() => {
    if (tokenAl()) {
      router.replace("/gorevler");
    }
  }, [router]);

  async function gonder(e) {
    e.preventDefault();
    setHata(null);
    setYukleniyor(true);
    try {
      await girisYap(eposta, sifre);
      router.push("/gorevler");
    } catch (err) {
      setHata(err.message || "Giriş yapılamadı.");
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
            <span className="etiket">HES CMMS</span>
            <h1>Bakım Yönetim Sistemine Giriş</h1>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}

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
        </div>
      </div>
    </>
  );
}
