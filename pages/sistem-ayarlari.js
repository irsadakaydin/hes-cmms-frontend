import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, platformAdminMi, arkaPlaniUygula } from "../lib/api";
import UstBar from "../components/UstBar";

export default function SistemAyarlariSayfasi() {
  const router = useRouter();
  const [mevcutResim, setMevcutResim] = useState(null);
  const [onizleme, setOnizleme] = useState(null);
  const [secilenDosya, setSecilenDosya] = useState(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!platformAdminMi()) {
      router.replace("/gorevler");
      return;
    }
    istekAt("/api/v1/sistem-ayarlari/arkaplan")
      .then((veri) => setMevcutResim(veri.arkaplan_resmi))
      .catch((err) => setHata(err.message));
  }, [router]);

  function dosyaSecildi(e) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    if (!dosya.type.startsWith("image/")) {
      setHata("Lütfen bir resim dosyası seçin.");
      return;
    }
    if (dosya.size > 8 * 1024 * 1024) {
      setHata("Resim 8MB'tan büyük olamaz — lütfen daha küçük bir dosya seçin.");
      return;
    }
    setHata(null);
    setSecilenDosya(dosya);
    const okuyucu = new FileReader();
    okuyucu.onload = () => setOnizleme(okuyucu.result);
    okuyucu.readAsDataURL(dosya);
  }

  async function kaydet() {
    if (!onizleme) return;
    setGonderiliyor(true);
    setHata(null);
    setBilgi(null);
    try {
      await istekAt("/api/v1/sistem-ayarlari/arkaplan", {
        method: "POST",
        body: JSON.stringify({ resim_base64: onizleme }),
      });
      setMevcutResim(onizleme);
      setOnizleme(null);
      setSecilenDosya(null);
      setBilgi("Arka plan resmi güncellendi — tüm kullanıcılar için (giriş sayfası dahil) geçerli.");
      await arkaPlaniUygula();
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function varsayilanaDondur() {
    if (!confirm("Özel arka plan resmini kaldırıp varsayılana dönmek istediğinize emin misiniz?")) return;
    setGonderiliyor(true);
    setHata(null);
    try {
      await istekAt("/api/v1/sistem-ayarlari/arkaplan", { method: "DELETE" });
      setMevcutResim(null);
      setBilgi("Varsayılan arka plana dönüldü.");
      document.documentElement.style.removeProperty("--sayfa-arkaplan-resmi");
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sistem Ayarları — Bakım Yönetim Sistemi</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          <div className="bolumBaslik">
            <h2>Sistem Ayarları</h2>
          </div>

          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && <div className="basariliKutu">{bilgi}</div>}

          <div className="yonetimFormu">
            <h3 style={{ marginTop: 0 }}>Arka Plan Resmi</h3>
            <p className="gorevAlt" style={{ marginBottom: "14px" }}>
              Tüm sayfalarda (giriş sayfası dahil) banner'ın altında görünen arka plan resmini buradan
              değiştirebilirsiniz — kod değişikliği ya da yeniden yayınlama gerekmez.
            </p>

            {(onizleme || mevcutResim) && (
              <img
                src={onizleme || mevcutResim}
                alt="Arka plan önizleme"
                style={{
                  width: "100%",
                  maxHeight: "220px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  marginBottom: "14px",
                  border: "1px solid var(--line-strong)",
                }}
              />
            )}
            {!onizleme && !mevcutResim && (
              <div className="bosDurum" style={{ marginBottom: "14px" }}>
                Şu an özel bir arka plan resmi ayarlanmamış — varsayılan görsel kullanılıyor.
              </div>
            )}

            <div className="alan">
              <label>Yeni resim seç</label>
              <input type="file" accept="image/*" onChange={dosyaSecildi} />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button className="birincilButon" onClick={kaydet} disabled={!onizleme || gonderiliyor}>
                {gonderiliyor ? "Kaydediliyor…" : "Kaydet ve Uygula"}
              </button>
              {mevcutResim && (
                <button
                  type="button"
                  className="kucukButon"
                  style={{ background: "var(--ink-soft)" }}
                  onClick={varsayilanaDondur}
                  disabled={gonderiliyor}
                >
                  Varsayılana Dön
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
