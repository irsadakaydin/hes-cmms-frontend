import { useRef, useState } from "react";

const MAKS_KENAR = 1280; // px — yüklenen fotoğraf bu boyuta küçültülür
const JPEG_KALITE = 0.72;

/**
 * Fotoğraf seçme/çekme bileşeni. Seçilen her görseli tarayıcıda (canvas ile)
 * küçültüp JPEG'e çevirir, sonra base64 data URL olarak dışarı verir.
 *
 * NOT: Bu MVP'de fotoğraflar ayrı bir dosya sunucusuna (ör. Supabase Storage)
 * yüklenmiyor — doğrudan base64 olarak backend'e, oradan veritabanına
 * yazılıyor. Küçültme sayesinde tek fotoğraf genelde birkaç yüz KB'a iner;
 * yoğun/üretim kullanımında Supabase Storage'a geçip yalnızca URL saklamak
 * daha doğru olur.
 */
export default function FotografYukleyici({ fotograflar, onDegisti }) {
  const inputRef = useRef(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  function kucult(dosya) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const okuyucu = new FileReader();
      okuyucu.onload = () => {
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > MAKS_KENAR) {
            height = Math.round((height * MAKS_KENAR) / width);
            width = MAKS_KENAR;
          } else if (height > MAKS_KENAR) {
            width = Math.round((width * MAKS_KENAR) / height);
            height = MAKS_KENAR;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", JPEG_KALITE));
        };
        img.onerror = reject;
        img.src = okuyucu.result;
      };
      okuyucu.onerror = reject;
      okuyucu.readAsDataURL(dosya);
    });
  }

  async function dosyalarSecildi(e) {
    const dosyalar = Array.from(e.target.files || []);
    if (dosyalar.length === 0) return;

    setYukleniyor(true);
    try {
      const yeniler = await Promise.all(dosyalar.map(kucult));
      onDegisti([...fotograflar, ...yeniler]);
    } catch {
      // Sessizce yoksay — kullanıcı fotoğrafsız da devam edebilir
    } finally {
      setYukleniyor(false);
      e.target.value = "";
    }
  }

  function kaldir(index) {
    onDegisti(fotograflar.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="fotografListesi">
        {fotograflar.map((f, i) => (
          <div className="fotografKarti" key={i}>
            <img src={f} alt={`Fotoğraf ${i + 1}`} />
            <button type="button" onClick={() => kaldir(i)} aria-label="Fotoğrafı kaldır">
              ×
            </button>
          </div>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: "none" }}
        onChange={dosyalarSecildi}
      />
      <button
        type="button"
        className="fotografEkleButon"
        onClick={() => inputRef.current.click()}
        disabled={yukleniyor}
      >
        {yukleniyor ? "İşleniyor…" : "+ Fotoğraf Ekle"}
      </button>
    </div>
  );
}
