import { useRouter } from "next/router";
import Link from "next/link";
import { cikisYap, kullaniciAl, yoneticiMi, isletmeYoneticisiMi, platformAdminMi } from "../lib/api";

export default function UstBar() {
  const router = useRouter();
  const kullanici = typeof window !== "undefined" ? kullaniciAl() : null;
  const yonetici = typeof window !== "undefined" ? yoneticiMi() : false;
  const isletmeYoneticisi = typeof window !== "undefined" ? isletmeYoneticisiMi() : false;
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;

  function cikis() {
    cikisYap();
    router.push("/");
  }

  return (
    <div className="ustBar">
      <div className="ustBarSol">
        <div className="ustBarBaslik">
          HES CMMS <small>Bakım Yönetim Sistemi</small>
        </div>
        <nav className="ustBarNav">
          <Link href="/gorevler">Görevlerim</Link>
          <Link href="/mesajlar">Mesajlar</Link>
          {platformAdmin && <Link href="/holdingler">Holdingler</Link>}
          {yonetici && <Link href="/santraller">Santraller</Link>}
          {yonetici && <Link href="/ekipman-olustur">Ekipman Oluştur</Link>}
          {yonetici && <Link href="/bakim-plani-olustur">Bakım Planı Oluştur</Link>}
          {yonetici && <Link href="/sablonlar">Bakım Şablonları</Link>}
          {yonetici && <Link href="/rapor-olustur">Rapor Oluştur</Link>}
          {isletmeYoneticisi && <Link href="/kullanicilar">Kullanıcılar</Link>}
          {isletmeYoneticisi && <Link href="/giris-loglari">Giriş Logları</Link>}
        </nav>
      </div>
      <div className="ustBarSag">
        {kullanici && <span>{kullanici.ad_soyad}</span>}
        <button className="cikisLink" onClick={cikis}>
          Çıkış
        </button>
      </div>
    </div>
  );
}
