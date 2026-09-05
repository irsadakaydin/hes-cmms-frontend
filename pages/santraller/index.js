import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { istekAt, tokenAl, yoneticiMi } from "../../lib/api";
import UstBar from "../../components/UstBar";

/** Santralleri isletme_adi'na göre gruplar; backend zaten holding adına
 * göre alfabetik sıralı döndürdüğü için gruplar ve içindeki santraller
 * de otomatik sıralı çıkar. */
function holdinglereGoreGrupla(santraller) {
  const gruplar = [];
  const indeksler = {};
  for (const s of santraller) {
    if (!(s.isletme_id in indeksler)) {
      indeksler[s.isletme_id] = gruplar.length;
      gruplar.push({ isletme_id: s.isletme_id, isletme_adi: s.isletme_adi, santraller: [] });
    }
    gruplar[indeksler[s.isletme_id]].santraller.push(s);
  }
  return gruplar;
}

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

  const gruplar = santraller ? holdinglereGoreGrupla(santraller) : null;

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

          {gruplar &&
            gruplar.map((g) => (
              <div key={g.isletme_id} style={{ marginBottom: "28px" }}>
                <h3 className="holdingBasligi">{g.isletme_adi}</h3>
                {g.santraller.map((s) => (
                  <Link key={s.santral_id} href={`/santraller/${s.santral_id}`} className="santralKart">
                    <div className="gorevSantral">{s.ad}</div>
                    <div className="gorevAlt">
                      {s.konum} {s.turbin_tipi ? `— ${s.turbin_tipi}` : ""}{" "}
                      {s.kurulu_guc_mw ? `— ${s.kurulu_guc_mw} MW` : ""}
                    </div>
                  </Link>
                ))}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
