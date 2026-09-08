import * as XLSX from "xlsx";

const PERIYOT_ANAHTAR_KELIMELERI = [
  ["GÜNLÜK", "GUNLUK"],
  ["HAFTALIK", "HAFTALIK"],
  ["3 AYLIK", "UC_AYLIK"],
  ["ÜÇ AYLIK", "UC_AYLIK"],
  ["6 AYLIK", "ALTI_AYLIK"],
  ["ALTI AYLIK", "ALTI_AYLIK"],
  // Çok yıllık periyotlar — daha spesifik oldukları için genel "YILLIK"
  // eşleşmesinden ÖNCE kontrol edilmeli (aksi halde "2 YILLIK" da sadece
  // "YILLIK" olarak yakalanırdı).
  ["2 YILLIK", "IKI_YILLIK"],
  ["İKİ YILLIK", "IKI_YILLIK"],
  ["3 YILLIK", "UC_YILLIK"],
  ["ÜÇ YILLIK", "UC_YILLIK"],
  ["5 YILLIK", "BES_YILLIK"],
  ["BEŞ YILLIK", "BES_YILLIK"],
  ["10 YILLIK", "ON_YILLIK"],
  ["ON YILLIK", "ON_YILLIK"],
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

/** Başlıkta "ÜNİTE N" ifadesi geçiyorsa (ör. "TÜRBİN ÜNİTE 4 AYLIK...") ama
 * başlığın en başında değilse, bu ifadeyi başa taşır (ör. "ÜNİTE 4 TÜRBİN
 * AYLIK..."). Kaynak belgelerdeki tutarsız kelime sırasını (bazı ünitelerde
 * "ÜNİTE N" baştayken bazılarında ortada geçmesi) düzeltip, oluşturulan
 * şablon adlarının hepsinin aynı düzende olmasını sağlar. */
function uniteBasaTasi(metin) {
  const eslesme = metin.match(/ÜNİTE\s*\d+/i);
  if (!eslesme) return metin;
  const uniteIfadesi = eslesme[0].replace(/\s+/g, " ").trim();
  if (metin.trim().toUpperCase().startsWith(uniteIfadesi.toUpperCase())) return metin;
  const kalan = (metin.slice(0, eslesme.index) + metin.slice(eslesme.index + eslesme[0].length))
    .replace(/\s+/g, " ")
    .trim();
  return `${uniteIfadesi} ${kalan}`.replace(/\s+/g, " ").trim();
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
        baslikMetni = uniteBasaTasi(aDeger.replace(/\s+/g, " ").trim());
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

  // Ekipman adı (genel kategori) tahmini — "Ekipman Tipi" burada TAHMİN
  // EDİLMEZ, çünkü föy metninden yalnızca genel bir kategori (Türbin,
  // Jeneratör vb.) çıkarılabilir; asıl ekipmanla birebir eşleşmesi gereken
  // spesifik "Tipi" (ör. Francis Türbin) kullanıcı tarafından, sistemde
  // kayıtlı gerçek değerlerden seçilmelidir.
  let ekipmanAdiTahmini = "";
  for (const anahtar of EKIPMAN_ANAHTAR_KELIMELERI) {
    if (aramaMetni.includes(anahtar)) {
      ekipmanAdiTahmini = anahtar.charAt(0) + anahtar.slice(1).toLowerCase();
      break;
    }
  }

  // Ünite No tahmini — başlıkta "ÜNİTE 1", "UNITE 2" gibi bir ifade varsa
  // sayıyı çıkarır.
  let uniteNoTahmini = "";
  const uniteEslesme = aramaMetni.match(/(?:ÜNİTE|UNITE)\s*(\d+)/);
  if (uniteEslesme) uniteNoTahmini = uniteEslesme[1];

  return {
    kalemler,
    ad: docNo ? `${baslikMetni || "Bakım Föyü"} (${docNo})` : baslikMetni,
    ekipman_adi: ekipmanAdiTahmini,
    ekipman_tipi: "",
    unite_no: uniteNoTahmini,
    periyot_tipi: periyotTahmini,
    bulunanMaddeSayisi: kalemler.length,
  };
}
