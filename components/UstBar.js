import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { cikisYap, kullaniciAl, yoneticiMi, isletmeYoneticisiMi, platformAdminMi, istekAt, tokenAl, arkaPlaniUygula } from "../lib/api";
import OzetBanner from "./OzetBanner";

// Bu süre boyunca HİÇBİR fare/klavye/dokunma etkileşimi olmazsa, kullanıcı
// otomatik olarak çıkış yaptırılıp giriş sayfasına yönlendirilir.
const BOSTA_KALMA_SURESI_MS = 15 * 60 * 1000; // 15 dakika
// mousemove gibi çok sık tetiklenen olaylarda zamanlayıcıyı gereksiz yere
// defalarca sıfırlamamak için en az bu kadar süre geçmesini bekler.
const SIFIRLAMA_ARALIGI_MS = 1000;

export default function UstBar() {
  const router = useRouter();
  const kullanici = typeof window !== "undefined" ? kullaniciAl() : null;
  const yonetici = typeof window !== "undefined" ? yoneticiMi() : false;
  const isletmeYoneticisi = typeof window !== "undefined" ? isletmeYoneticisiMi() : false;
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;
  const [okunmamisSayi, setOkunmamisSayi] = useState(0);
  const [ozetGorunur, setOzetGorunur] = useState(true);

  useEffect(() => {
    arkaPlaniUygula();
  }, []);

  useEffect(() => {
    if (!tokenAl()) return;
    istekAt("/api/v1/mesajlar/okunmamis-sayisi")
      .then((veri) => setOkunmamisSayi(veri.sayi))
      .catch(() => {});
    const kayitliDurum = localStorage.getItem("ozetBannerGorunur");
    if (kayitliDurum !== null) setOzetGorunur(kayitliDurum === "1");
  }, []);

  // BOŞTA KALMA (idle) TAKİBİ — 15 dakika boyunca hiç etkileşim olmazsa
  // oturumu sonlandırıp ana sayfaya yönlendirir. Token yoksa (giriş
  // yapılmamışsa) hiç kurulmaz. Bileşen kaldırılınca (sayfa değişince)
  // dinleyiciler ve zamanlayıcı temizlenir — aksi halde her sayfa
  // geçişinde bir yenisi birikir.
  useEffect(() => {
    if (!tokenAl()) return;

    let zamanlayici;
    let sonSifirlama = 0;

    async function bostaKaldigiIcinCikisYap() {
      await cikisYap();
      router.push("/");
    }

    function zamanlayiciyiSifirla() {
      const simdi = Date.now();
      if (simdi - sonSifirlama < SIFIRLAMA_ARALIGI_MS) return;
      sonSifirlama = simdi;
      clearTimeout(zamanlayici);
      zamanlayici = setTimeout(bostaKaldigiIcinCikisYap, BOSTA_KALMA_SURESI_MS);
    }

    const izlenecekOlaylar = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    izlenecekOlaylar.forEach((olay) => window.addEventListener(olay, zamanlayiciyiSifirla));
    zamanlayiciyiSifirla(); // ilk kurulum

    return () => {
      clearTimeout(zamanlayici);
      izlenecekOlaylar.forEach((olay) => window.removeEventListener(olay, zamanlayiciyiSifirla));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ozetGoruntulemeyiDegistir() {
    setOzetGorunur((v) => {
      const yeni = !v;
      localStorage.setItem("ozetBannerGorunur", yeni ? "1" : "0");
      return yeni;
    });
  }

  async function cikis() {
    await cikisYap();
    router.push("/");
  }

  return (
    <>
      <div className="ustBar">
        <div className="ustBarSol">
          <div className="ustBarBaslik">
            Bakım Yönetim Sistemi
          </div>
          <nav className="ustBarNav">
            <Link href="/gorevler">Görevlerim</Link>
            <Link href="/mesajlar" className="mesajlarLinki">
              Mesajlar
              {okunmamisSayi > 0 && <span className="okunmamisIsareti">✉</span>}
            </Link>
            {platformAdmin && <Link href="/holdingler">Holdingler</Link>}
            {platformAdmin && <Link href="/sistem-ayarlari">Sistem Ayarları</Link>}
            {yonetici && <Link href="/santraller">Santraller</Link>}
            <Link href="/depo">Depo</Link>
            {yonetici && <Link href="/ekipman-listesi">Ekipman Listesi</Link>}
            {yonetici && <Link href="/ekipman-olustur">Ekipman Oluştur</Link>}
            {yonetici && <Link href="/bakimlar">Bakımlar</Link>}
            {yonetici && <Link href="/sablonlar">Bakım Şablonları</Link>}
            {yonetici && <Link href="/bakim-plani-olustur">Bakım Planı Oluştur</Link>}
            {yonetici && <Link href="/oto-bakim-planla">Oto Bakım Planla</Link>}
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
