import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, yoneticiMi, isletmeYoneticisiMi, platformAdminMi } from "../lib/api";
import UstBar from "../components/UstBar";
import EkipmanKlasorAgaci from "../components/EkipmanKlasorAgaci";

export default function EkipmanListesiSayfasi() {
  const router = useRouter();
  const platformAdmin = typeof window !== "undefined" ? platformAdminMi() : false;
  const duzenleyebilirMi = typeof window !== "undefined" ? isletmeYoneticisiMi() : false;

  const [santraller, setSantraller] = useState(null);
  const [holdingler, setHoldingler] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState("");
  const [seciliSantralId, setSeciliSantralId] = useState("");
  const [ekipmanlar, setEkipmanlar] = useState(null);
  const [tumListeModu, setTumListeModu] = useState(false); // false = klasörde gez, true = düz liste
  const [seciliKlasorId, setSeciliKlasorId] = useState("");
  const [klasorYolu, setKlasorYolu] = useState("");
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [duzenlenenId, setDuzenlenenId] = useState(null);
  const [taslak, setTaslak] = useState(null);

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
        // İşletme Admin / Santral Sorumlusu'nun tek santrali varsa direkt seç
        if (!platformAdminMi() && s.veri.length === 1) {
          setSeciliSantralId(s.veri[0].santral_id);
        }
      })
      .catch((err) => setHata(err.message));
  }, [router]);

  const ekipmanlariGetir = useCallback(async (santralId) => {
    setHata(null);
    if (!santralId) {
      setEkipmanlar(null);
      return;
    }
    try {
      const veri = await istekAt(`/api/v1/santraller/${santralId}/ekipmanlar`);
      setEkipmanlar(veri.veri);
    } catch (err) {
      setHata(err.message);
    }
  }, []);

  async function klasordekiEkipmanlariGetir(klasor) {
    setSeciliKlasorId(klasor.klasor_id);
    setHata(null);
    try {
      const [ekipmanSonuc, yol] = await Promise.all([
        istekAt(`/api/v1/klasorler/${klasor.klasor_id}/ekipmanlar`),
        istekAt(`/api/v1/klasorler/${klasor.klasor_id}/yol`),
      ]);
      setEkipmanlar(ekipmanSonuc.veri);
      setKlasorYolu(yol.veri.map((y) => y.ad).join(" > "));
    } catch (err) {
      setHata(err.message);
    }
  }

  useEffect(() => {
    setSeciliKlasorId("");
    setKlasorYolu("");
    if (tumListeModu) {
      ekipmanlariGetir(seciliSantralId);
    } else {
      setEkipmanlar(null);
    }
  }, [seciliSantralId, tumListeModu, ekipmanlariGetir]);

  async function listeyiYenile() {
    if (tumListeModu) {
      await ekipmanlariGetir(seciliSantralId);
    } else if (seciliKlasorId) {
      await klasordekiEkipmanlariGetir({ klasor_id: seciliKlasorId });
    }
  }

  function duzenlemeyiBaslat(e) {
    setDuzenlenenId(e.ekipman_id);
    setTaslak({ ad: e.ad, tip: e.tip, unite_no: e.unite_no || "", seri_no: e.seri_no || "", uretici: e.uretici || "" });
  }

  async function duzenlemeyiKaydet(ekipmanId) {
    setGonderiliyor(true);
    setHata(null);
    try {
      await istekAt(`/api/v1/ekipmanlar/${ekipmanId}`, { method: "PATCH", body: JSON.stringify(taslak) });
      setDuzenlenenId(null);
      await listeyiYenile();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function ekipmaniPasiflestir(ekipmanId) {
    setHata(null);
    try {
      await istekAt(`/api/v1/ekipmanlar/${ekipmanId}/pasiflestir`, { method: "POST" });
      setBilgi("Ekipman pasifleştirildi.");
      await listeyiYenile();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function ekipmaniSil(ekipmanId) {
    if (!confirm("Bu ekipmanı KALICI OLARAK silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return;
    setHata(null);
    try {
      await istekAt(`/api/v1/ekipmanlar/${ekipmanId}`, { method: "DELETE" });
      setBilgi("Ekipman kalıcı olarak silindi.");
      await listeyiYenile();
    } catch (err) {
      setHata(err.message);
    }
  }

  async function yenidenAktiflestir(ekipmanId) {
    setHata(null);
    try {
      await istekAt(`/api/v1/ekipmanlar/${ekipmanId}`, { method: "PATCH", body: JSON.stringify({ durum: "AKTIF" }) });
      await listeyiYenile();
    } catch (err) {
      setHata(err.message);
    }
  }

  const gosterilecekSantraller = platformAdmin
    ? (santraller || []).filter((s) => s.isletme_id === seciliHoldingId)
    : santraller;

  const cokSantralliMi = (santraller || []).length > 1;

  return (
    <>
      <Head>
        <title>Ekipman Listesi — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Ekipman Listesi</h2>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          {platformAdmin && (
            <div className="alan" style={{ maxWidth: "340px" }}>
              <label>Holding</label>
              <select
                value={seciliHoldingId}
                onChange={(e) => {
                  setSeciliHoldingId(e.target.value);
                  setSeciliSantralId("");
                }}
              >
                <option value="">Bir holding seçin…</option>
                {holdingler &&
                  holdingler.map((h) => (
                    <option key={h.isletme_id} value={h.isletme_id}>
                      {h.ad}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {(!platformAdmin || seciliHoldingId) && cokSantralliMi && (
            <div className="alan" style={{ maxWidth: "340px" }}>
              <label>Santral</label>
              <select value={seciliSantralId} onChange={(e) => setSeciliSantralId(e.target.value)}>
                <option value="">Bir santral seçin…</option>
                {gosterilecekSantraller &&
                  gosterilecekSantraller.map((s) => (
                    <option key={s.santral_id} value={s.santral_id}>
                      {s.ad}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {platformAdmin && !seciliHoldingId && (
            <div className="bosDurum">Ekipmanları görmek için önce bir holding seçin.</div>
          )}
          {(!platformAdmin || seciliHoldingId) && cokSantralliMi && !seciliSantralId && (
            <div className="bosDurum">Ekipmanları görmek için bir santral seçin.</div>
          )}

          {seciliSantralId && (
            <div style={{ marginBottom: "14px" }}>
              <button type="button" className="linkButon" onClick={() => setTumListeModu((v) => !v)}>
                {tumListeModu ? "← Klasörde gezerek bul" : "Tüm ekipmanları düz liste olarak göster →"}
              </button>
            </div>
          )}

          {seciliSantralId && !tumListeModu && (
            <div className="alan">
              <label>
                Klasör konumu {klasorYolu && <strong>— Seçili: {klasorYolu}</strong>}
              </label>
              <EkipmanKlasorAgaci
                santralId={seciliSantralId}
                santralAdi={(santraller || []).find((s) => s.santral_id === seciliSantralId)?.ad}
                onSecim={klasordekiEkipmanlariGetir}
                seciliKlasorId={seciliKlasorId}
              />
            </div>
          )}

          {seciliSantralId && (tumListeModu || seciliKlasorId) && !ekipmanlar && (
            <div className="yukleniyor">Yükleniyor…</div>
          )}
          {seciliSantralId && ekipmanlar && ekipmanlar.length === 0 && (
            <div className="bosDurum">
              {tumListeModu ? "Bu santralde henüz ekipman yok." : "Bu klasör konumunda henüz ekipman yok."}
            </div>
          )}

          {ekipmanlar &&
            ekipmanlar.map((e) =>
              duzenlenenId === e.ekipman_id ? (
                <div className="yonetimFormu" key={e.ekipman_id}>
                  <div className="alan">
                    <label>Ünite No</label>
                    <input
                      value={taslak.unite_no || ""}
                      onChange={(ev) => setTaslak({ ...taslak, unite_no: ev.target.value })}
                    />
                  </div>
                  <div className="alan">
                    <label>Ekipman adı</label>
                    <input value={taslak.ad} onChange={(ev) => setTaslak({ ...taslak, ad: ev.target.value })} />
                  </div>
                  <div className="alan">
                    <label>Tip</label>
                    <input value={taslak.tip} onChange={(ev) => setTaslak({ ...taslak, tip: ev.target.value })} />
                  </div>
                  <div className="alan">
                    <label>Seri no</label>
                    <input
                      value={taslak.seri_no}
                      onChange={(ev) => setTaslak({ ...taslak, seri_no: ev.target.value })}
                    />
                  </div>
                  <div className="alan">
                    <label>Üretici</label>
                    <input
                      value={taslak.uretici}
                      onChange={(ev) => setTaslak({ ...taslak, uretici: ev.target.value })}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      className="birincilButon"
                      disabled={gonderiliyor}
                      onClick={() => duzenlemeyiKaydet(e.ekipman_id)}
                    >
                      Kaydet
                    </button>
                    <button
                      className="kucukButon"
                      style={{ background: "var(--ink-soft)" }}
                      onClick={() => setDuzenlenenId(null)}
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              ) : (
                <div className="satirKart" key={e.ekipman_id}>
                  <div>
                    <strong>
                      {e.unite_no ? `${e.unite_no} ` : ""}
                      {e.ad}
                    </strong>{" "}
                    - ({e.tip})
                    {e.durum === "HURDA" && (
                      <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>
                        Pasif
                      </span>
                    )}
                    {!e.klasor_id && (
                      <span
                        className="rozet rozet-GECIKTI"
                        style={{ marginLeft: 8 }}
                        title="Bu ekipman henüz klasör ağacındaki bir konuma bağlı değil — Klasör olarak gösterirken görünmez. Düzenleyip klasör konumunu seçin."
                      >
                        ⚠ Klasöre bağlı değil
                      </span>
                    )}
                  </div>
                  <div className="gorevAlt">
                    {e.uretici && `${e.uretici} `}
                    {e.seri_no && `· ${e.seri_no}`}
                  </div>
                  {duzenleyebilirMi && (
                    <div className="kullaniciAlt">
                      <button className="linkButon" onClick={() => duzenlemeyiBaslat(e)}>
                        Düzenle
                      </button>
                      {e.durum === "HURDA" ? (
                        <button className="linkButon" onClick={() => yenidenAktiflestir(e.ekipman_id)}>
                          Yeniden aktifleştir
                        </button>
                      ) : (
                        <button className="linkButon" onClick={() => ekipmaniPasiflestir(e.ekipman_id)}>
                          Pasifleştir
                        </button>
                      )}
                      <button className="linkButon" onClick={() => ekipmaniSil(e.ekipman_id)}>
                        Sil
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
        </div>
      </div>
    </>
  );
}
