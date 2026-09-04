import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { istekAt, tokenAl } from "../../lib/api";
import UstBar from "../../components/UstBar";

const DURUM_ETIKETLERI = {
  BEKLIYOR: "Bekliyor",
  DEVAM_EDIYOR: "Devam Ediyor",
  GECIKTI: "Gecikti",
};

function tarihFormatla(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function GorevlerSayfasi() {
  const router = useRouter();
  const [gorevler, setGorevler] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    istekAt("/api/v1/gorevler/bana-atanan")
      .then((veri) => setGorevler(veri.veri))
      .catch((err) => {
        if (err.durum === 401) {
          router.replace("/");
          return;
        }
        setHata(err.message);
      });
  }, [router]);

  return (
    <>
      <Head>
        <title>Görevlerim — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Bana Atanan Görevler</h2>
            {gorevler && <span className="sayac">{gorevler.length} görev</span>}
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}

          {!gorevler && !hata && <div className="yukleniyor">Yükleniyor…</div>}

          {gorevler && gorevler.length === 0 && (
            <div className="bosDurum">Şu an size atanmış açık bir bakım görevi yok.</div>
          )}

          {gorevler &&
            gorevler.map((g) => (
              <Link
                key={g.gorev_id}
                href={`/gorevler/${g.gorev_id}`}
                className={`gorevKart durum-${g.durum}`}
              >
                <div className="gorevUst">
                  <span className="gorevSantral">{g.santral_adi}</span>
                  <span className={`rozet rozet-${g.durum}`}>
                    {DURUM_ETIKETLERI[g.durum] || g.durum}
                  </span>
                </div>
                <div className="gorevAlt">
                  {g.ekipman_adi} — {g.sablon_adi}
                </div>
                <div className="gorevTarih">Planlanan: {tarihFormatla(g.planlanan_tarih)}</div>
              </Link>
            ))}
        </div>
      </div>
    </>
  );
}
