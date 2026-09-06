import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { cikisYap, kullaniciAl, yoneticiMi, isletmeYoneticisiMi, platformAdminMi, istekAt, tokenAl } from "../lib/api";
import OzetBanner from "./OzetBanner";

export default function UstBar() {
  const router = useRouter();
  const kullanici = typeof window !== "undefined" ? kullaniciAl() : null;
  const yonetici = typeof window !== "undefined" ? yoneticiMi() : false;
  const isletmeYoneticisi = typeof window !== "undefined" ? isletmeYoneticisiMi() : false;
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;
  const [okunmamisSayi, setOkunmamisSayi] = useState(0);
  const [ozetGorunur, setOzetGorunur] = useState(true);

  useEffect(() => {
    if (!tokenAl()) return;
    istekAt("/api/v1/mesajlar/okunmamis-sayisi")
      .then((veri) => setOkunmamisSayi(veri.sayi))
      .catch(() => {});
    const kayitliDurum = localStorage.getItem("ozetBannerGorunur");
    if (kayitliDurum !== null) setOzetGorunur(kayitliDurum === "1");
  }, []);

  function ozetGoruntulemeyiDegistir() {
    setOzetGorunur((v) => {
      const yeni = !v;
      localStorage.setItem("ozetBannerGorunur", yeni ? "1" : "0");
      return yeni;
    });
  }

  function cikis() {
    cikisYap();
    router.push("/");
  }

  return (
    <>
      <div className="ustBar">
        <div className="ustBarSol">
          <div className="ustBarBaslik">
            HES CMMS <small>Bakım Yönetim Sistemi</small>
          </div>
          <nav className="ustBarNav">
            <Link href="/gorevler">Görevlerim</Link>
            <Link href="/mesajlar" className="mesajlarLinki">
              Mesajlar
              {okunmamisSayi > 0 && <span className="okunmamisIsareti">✉</span>}
            </Link>
            {platformAdmin && <Link href="/holdingler">Holdingler</Link>}
            {yonetici && <Link href="/santraller">Santraller</Link>}
            {yonetici && <Link href="/bakimlar">Bakımlar</Link>}
            {yonetici && <Link href="/ekipman-listesi">Ekipman Listesi</Link>}
            {yonetici && <Link href="/ekipman-olustur">Ekipman Oluştur</Link>}
            {yonetici && <Link href="/bakim-plani-olustur">Bakım Planı Oluştur</Link>}
            {yonetici && <Link href="/oto-bakim-planla">Oto Bakım Planla</Link>}
            {yonetici && <Link href="/sablonlar">Bakım Şablonları</Link>}
            {yonetici && <Link href="/rapor-olustur">Rapor Oluştur</Link>}
            {isletmeYoneticisi && <Link href="/kullanicilar">Kullanıcılar</Link>}
            {isletmeYoneticisi && <Link href="/giris-loglari">Giriş Logları</Link>}
          </nav>
        </div>
        <div className="ustBarSag">
          {yonetici && (
            <button className="ozetGosterGizleButon" onClick={ozetGoruntulemeyiDegistir}>
              {ozetGorunur ? "Özeti Gizle" : "Özeti Göster"}
            </button>
          )}
          {kullanici && <span>{kullanici.ad_soyad}</span>}
          <button className="cikisLink" onClick={cikis}>
            Çıkış
          </button>
        </div>
      </div>
      {yonetici && ozetGorunur && <OzetBanner />}
    </>
  );
}
