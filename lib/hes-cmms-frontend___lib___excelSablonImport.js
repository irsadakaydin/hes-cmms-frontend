import * as XLSX from "xlsx";

const PERIYOT_ANAHTAR_KELIMELERI = [
  ["GÜNLÜK", "GUNLUK"],
  ["HAFTALIK", "HAFTALIK"],
  ["3 AYLIK", "UC_AYLIK"],
  ["ÜÇ AYLIK", "UC_AYLIK"],
  ["6 AYLIK", "ALTI_AYLIK"],
  ["ALTI AYLIK", "ALTI_AYLIK"],
  ["YILLIK", "YILLIK"],
  ["AYLIK", "AYLIK"], // en sona konuldu — "3 AYLIK" gibi ifadelerin önce yakalanması için
];

const EKIPMAN_ANAHTAR_KELIMELERI = [
  "TÜRBİN",
  "JENERATÖR",
  "TRAFO",
  "TRANSFORMATÖR",
  "VANA",
  "AKTÜATÖR",
  "POMPA",
  "KOMPRESÖR",
  "ŞALT",
  "KAPAK",
];

function hucreMetni(deger) {
  return typeof deger === "string" ? deger.trim() : "";
}

/**
 * Yüklenen bir bakım föyi (.xlsx) içindeki "Kontrol" başlıklı bölümü bulup
 * altındaki maddeleri checklist kalemi olarak çıkarır. Ayrıca dosya içeriğinden
 * şablon adı / ekipman tipi / periyot için bir TAHMİN üretir — kullanıcı bunları
 * kaydetmeden önce her zaman düzenleyebilir, bu yüzden %100 doğru olması gerekmez.
 */
export function excelDenSablonCikar(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  let kalemler = [];
  let baslikMetni = "";
  let docNo = "";

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const ref = ws["!ref"];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);

    // "Kontrol" başlıklı hücreyi ara
    let kontrolRow = -1;
    for (let r = range.s.r; r <= range.e.r && kontrolRow < 0; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (hucreMetni(cell?.v).toLowerCase() === "kontrol") {
          kontrolRow = r;
          break;
        }
      }
    }

    // Genel başlık / doküman no ipucu ara (her sayfada, sıra fark etmeksizin)
    for (let r = range.s.r; r <= range.e.r; r++) {
      const aDeger = hucreMetni(ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v);
      if (!baslikMetni && /PERİYODİK BAKIM|BAKIM FÖYÜ|KONTROL FÖYÜ/i.test(aDeger)) {
        baslikMetni = aDeger.replace(/\s+/g, " ").trim();
      }
      for (let c = range.s.c; c <= range.e.c; c++) {
        const deger = hucreMetni(ws[XLSX.utils.encode_cell({ r, c })]?.v);
        if (!docNo && /doc\.?\s*no\s*:/i.test(deger)) {
          docNo = deger.replace(/doc\.?\s*no\s*:/i, "").trim();
        }
      }
    }

    if (kontrolRow < 0) continue;

    // "Kontrol" satırının altında A sütununda maddeleri topla
    let bosSayaci = 0;
    const buKalemler = [];
    for (let r = kontrolRow + 1; r <= range.e.r; r++) {
      const deger = hucreMetni(ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v);
      if (!deger) {
        bosSayaci++;
        if (buKalemler.length > 0 && bosSayaci >= 3) break;
        continue;
      }
      bosSayaci = 0;
      if (/^notlar/i.test(deger)) break;
      buKalemler.push({
        id: `k${buKalemler.length + 1}`,
        soru: deger,
        tip: "evet_hayir",
      });
    }

    if (buKalemler.length > 0) {
      kalemler = buKalemler;
      break; // ilk uygun sayfa yeterli
    }
  }

  // Periyot tahmini
  let periyotTahmini = "";
  const aramaMetni = baslikMetni.toUpperCase();
  for (const [anahtar, kod] of PERIYOT_ANAHTAR_KELIMELERI) {
    if (aramaMetni.includes(anahtar)) {
      periyotTahmini = kod;
      break;
    }
  }

  // Ekipman tipi tahmini
  let ekipmanTahmini = "";
  for (const anahtar of EKIPMAN_ANAHTAR_KELIMELERI) {
    if (aramaMetni.includes(anahtar)) {
      ekipmanTahmini = anahtar.charAt(0) + anahtar.slice(1).toLowerCase();
      break;
    }
  }

  return {
    kalemler,
    ad: docNo ? `${baslikMetni || "Bakım Föyü"} (${docNo})` : baslikMetni,
    ekipman_tipi: ekipmanTahmini,
    periyot_tipi: periyotTahmini,
    bulunanMaddeSayisi: kalemler.length,
  };
}
