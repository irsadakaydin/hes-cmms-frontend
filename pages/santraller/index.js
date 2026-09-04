import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { istekAt, tokenAl, yoneticiMi } from "../../lib/api";
import UstBar from "../../components/UstBar";

export default function SantrallerSayfasi() {
  const router = useRouter();
  const [santraller, setSantraller] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!yoneticiMi()) {
      router.replace("/gorevler");
      return;
    }
    istekAt("/api/v1/santraller")
      .then((veri) => setSantraller(veri.veri))
      .catch((err) => setHata(err.message));
  }, [router]);

  return (
    <>
      <Head>
        <title>Santraller — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Santraller</h2>
            {santraller && <span className="sayac">{santraller.length} santral</span>}
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {!santraller && !hata && <div className="yukleniyor">Yükleniyor…</div>}

          {santraller &&
            santraller.map((s) => (
              <Link key={s.santral_id} href={`/santraller/${s.santral_id}`} className="santralKart">
                <div className="gorevSantral">{s.ad}</div>
                <div className="gorevAlt">
                  {s.konum} {s.turbin_tipi ? `— ${s.turbin_tipi}` : ""}{" "}
                  {s.kurulu_guc_mw ? `— ${s.kurulu_guc_mw} MW` : ""}
                </div>
              </Link>
            ))}
        </div>
      </div>
    </>
  );
}
