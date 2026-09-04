import { useRef, useEffect, useState } from "react";

/**
 * Fare/parmak ile imza çizme bileşeni. Dışarıya bir PNG data URL üretir
 * (onDegisti callback'i ile) — backend'in imza_url alanına bu gönderilir.
 *
 * NOT: Bu, gerçek bir dosya sunucusuna yüklenmiyor; imza doğrudan
 * base64 PNG olarak veritabanına yazılıyor. Küçük imzalar için sorun
 * değil; çok yüksek trafikli üretim kullanımında ileride Supabase
 * Storage gibi bir servise yüklenip yalnızca URL saklanması daha
 * doğru olur.
 */
export default function ImzaPad({ onDegisti }) {
  const canvasRef = useRef(null);
  const cizimVarMi = useRef(false);
  const [bosMu, setBosMu] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function boyutAyarla() {
      const oran = window.devicePixelRatio || 1;
      const genislik = canvas.clientWidth;
      const yukseklik = canvas.clientHeight;
      canvas.width = genislik * oran;
      canvas.height = yukseklik * oran;
      ctx.scale(oran, oran);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#13201c";
    }
    boyutAyarla();
    window.addEventListener("resize", boyutAyarla);
    return () => window.removeEventListener("resize", boyutAyarla);
  }, []);

  function konumAl(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const nokta = e.touches ? e.touches[0] : e;
    return { x: nokta.clientX - rect.left, y: nokta.clientY - rect.top };
  }

  function cizmeyeBasla(e) {
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = konumAl(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    cizimVarMi.current = true;
  }

  function ciz(e) {
    if (!cizimVarMi.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = konumAl(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setBosMu(false);
  }

  function cizmeyiBitir() {
    if (!cizimVarMi.current) return;
    cizimVarMi.current = false;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onDegisti(dataUrl);
  }

  function temizle() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setBosMu(true);
    onDegisti(null);
  }

  return (
    <div className="imzaAlani">
      <canvas
        ref={canvasRef}
        className="imzaCanvas"
        onMouseDown={cizmeyeBasla}
        onMouseMove={ciz}
        onMouseUp={cizmeyiBitir}
        onMouseLeave={cizmeyiBitir}
        onTouchStart={cizmeyeBasla}
        onTouchMove={ciz}
        onTouchEnd={cizmeyiBitir}
      />
      {bosMu && <div className="imzaIpucu">Parmağınızla veya fareyle buraya imzalayın</div>}
      <button type="button" className="imzaTemizleButon" onClick={temizle}>
        Temizle
      </button>
    </div>
  );
}
