import { useRouter } from "next/router";
import { cikisYap, kullaniciAl } from "../lib/api";

export default function UstBar() {
  const router = useRouter();
  const kullanici = typeof window !== "undefined" ? kullaniciAl() : null;

  function cikis() {
    cikisYap();
    router.push("/");
  }

  return (
    <div className="ustBar">
      <div className="ustBarBaslik">
        HES CMMS <small>Bakım Yönetim Sistemi</small>
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
