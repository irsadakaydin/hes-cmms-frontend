import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, yoneticiMi, platformAdminMi } from "../lib/api";
import UstBar from "../components/UstBar";

function bosForm() {
  return { santral_id: "", ad: "", tip: "", unite_no: "", seri_no: "", uretici: "", kurulum_tarihi: "", konum_notu: "" };
}

export default function EkipmanOlusturSayfasi() {
  const router = useRouter();
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;

  const [santraller, setSantraller] = useState(null);
  const [holdingler, setHoldingler] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [taslak, setTaslak] = useState(bosForm());

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!yoneticiMi()) {
      router.replace("/gorevler");
      return;
    }
    const istekler = [istekAt("/api/v1/santraller")];
    if (platformAdminMi()) istekler.push(istekAt("/api/v1/isletmeler"));
    Promise.all(istekler)
      .then(([s, h]) => {
        setSantraller(s.veri);
        if (h) setHoldingler(h.veri);
      })
      .catch((err) => setHata(err.message));
  }, [router]);

  async function ekipmanEkle(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    setGonderiliyor(true);
    try {
      const { santral_id, ...gonderilecek } = taslak;
      const yeni = await istekAt(`/api/v1/santraller/${santral_id}/ekipmanlar`, {
        method: "POST",
        body: JSON.stringify(gonderilecek),
      });
      setBilgi(`"${yeni.ad}" ekipmanı oluşturuldu.`);
      setTaslak({ ...bosForm(), santral_id });
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  const gosterilecekSantraller = platformAdmin
    ? (santraller || []).filter((s) => s.isletme_id === seciliHoldingId)
    : santraller;

  return (
    <>
      <Head>
        <title>Ekipman Oluştur — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Ekipman Oluştur</h2>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}
          {!santraller && !hata && <div className="yukleniyor">Yükleniyor…</div>}

          {santraller && (
            <form onSubmit={ekipmanEkle} className="yonetimFormu">
              {platformAdmin && (
                <div className="alan">
                  <label>Holding</label>
                  <select
                    required
                    value={seciliHoldingId}
                    onChange={(e) => {
                      setSeciliHoldingId(e.target.value);
                      setTaslak({ ...taslak, santral_id: "" });
                    }}
                  >
                    <option value="">Seçin…</option>
                    {holdingler &&
                      holdingler.map((h) => (
                        <option key={h.isletme_id} value={h.isletme_id}>
                          {h.ad}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {(!platformAdmin || seciliHoldingId) && (
                <>
                  <div className="alan">
                    <label>Santral</label>
                    <select
                      required
                      value={taslak.santral_id}
                      onChange={(e) => setTaslak({ ...taslak, santral_id: e.target.value })}
                    >
                      <option value="">Seçin…</option>
                      {gosterilecekSantraller &&
                        gosterilecekSantraller.map((s) => (
                          <option key={s.santral_id} value={s.santral_id}>
                            {s.ad} {s.isletme_adi ? `(${s.isletme_adi})` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="alan">
                    <label>Ünite No (isteğe bağlı)</label>
                    <input
                      value={taslak.unite_no}
                      onChange={(e) => setTaslak({ ...taslak, unite_no: e.target.value })}
                      placeholder="Ör. Ünite 1"
                    />
                  </div>
                  <div className="alan">
                    <label>Ekipman adı</label>
                    <input
                      required
                      value={taslak.ad}
                      onChange={(e) => setTaslak({ ...taslak, ad: e.target.value })}
                      placeholder="Ör. Türbin 2"
                    />
                  </div>
                  <div className="alan">
                    <label>Tip</label>
                    <input
                      required
                      value={taslak.tip}
                      onChange={(e) => setTaslak({ ...taslak, tip: e.target.value })}
                      placeholder="Ör. Francis Türbin"
                    />
                  </div>
                  <div className="alan">
                    <label>Seri no (isteğe bağlı)</label>
                    <input value={taslak.seri_no} onChange={(e) => setTaslak({ ...taslak, seri_no: e.target.value })} />
                  </div>
                  <div className="alan">
                    <label>Üretici (isteğe bağlı)</label>
                    <input value={taslak.uretici} onChange={(e) => setTaslak({ ...taslak, uretici: e.target.value })} />
                  </div>
                  <div className="alan">
                    <label>Kurulum tarihi (isteğe bağlı)</label>
                    <input
                      type="date"
                      value={taslak.kurulum_tarihi}
                      onChange={(e) => setTaslak({ ...taslak, kurulum_tarihi: e.target.value })}
                    />
                  </div>
                  <div className="alan">
                    <label>Konum notu (isteğe bağlı)</label>
                    <input
                      value={taslak.konum_notu}
                      onChange={(e) => setTaslak({ ...taslak, konum_notu: e.target.value })}
                      placeholder="Ör. Santral Binası Kat -1"
                    />
                  </div>
                  <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                    {gonderiliyor ? "Oluşturuluyor…" : "Ekipmanı Oluştur"}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </>
  );
}
