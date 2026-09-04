import { useRouter } from "next/router";
import Link from "next/link";
import { cikisYap, kullaniciAl, yoneticiMi } from "../lib/api";

export default function UstBar() {
  const router = useRouter();
  const kullanici = typeof window !== "undefined" ? kullaniciAl() : null;
  const yonetici = typeof window !== "undefined" ? yoneticiMi() : false;

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
          {yonetici && <Link href="/santraller">Santraller</Link>}
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
