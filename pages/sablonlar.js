import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { istekAt, tokenAl, yoneticiMi, kullaniciAl, dosyaIndir } from "../lib/api";
import { excelDenSablonCikar } from "../lib/excelSablonImport";
import UstBar from "../components/UstBar";

const PERIYOT_ETIKETLERI = {
  GUNLUK: "Günlük",
  HAFTALIK: "Haftalık",
  AYLIK: "Aylık",
  UC_AYLIK: "3 Ayda Bir",
  ALTI_AYLIK: "6 Ayda Bir",
  YILLIK: "Yıllık",
  IKI_YILLIK: "2 Yılda Bir",
  UC_YILLIK: "3 Yılda Bir",
  BES_YILLIK: "5 Yılda Bir",
  ON_YILLIK: "10 Yılda Bir",
};
const PERIYOT_SIRASI = [
  "GUNLUK", "HAFTALIK", "AYLIK", "UC_AYLIK", "ALTI_AYLIK", "YILLIK",
  "IKI_YILLIK", "UC_YILLIK", "BES_YILLIK", "ON_YILLIK",
];

const TIP_ETIKETLERI = {
  evet_hayir: "Evet / Hayır",
  olcum: "Ölçüm (sayı)",
  metin: "Serbest metin",
};

function bosSablon(varsayilanIsletmeId, varsayilanSantralId) {
  return {
    ad: "",
    ekipman_adi: "",
    ekipman_tipi: "",
    unite_no: "",
    klasor_id: "",
    periyot_tipi: "AYLIK",
    kalemler: [],
    isletme_id: varsayilanIsletmeId,
    santral_id: varsayilanSantralId || "",
  };
}

// Excel/PDF içe aktarmada da kullanılan, en sık karşılaşılan ekipman adı
// (genel kategori) listesi — yazım hatasını önlemek için açılır kutu/öneri
// olarak sunulur, ama "datalist" olduğu için gerekirse serbest de yazılabilir.
const EKIPMAN_ADI_ONERILERI = [
  "Türbin", "Jeneratör", "Trafo", "Transformatör", "Vana",
  "Aktüatör", "Pompa", "Kompresör", "Şalt", "Kapak",
];
function bosKalem(sira) {
  return { id: `k${sira}`, soru: "", tip: "evet_hayir", birim: "", zorunlu: true };
}

/** Şablonları önce santral (ya da "Genel"), sonra periyot bazında gruplar. */
function santralVePeriyodaGoreGrupla(sablonlar) {
  const santralGruplari = new Map();
  for (const s of sablonlar) {
    const anahtar = s.santral_id || "__genel__";
    if (!santralGruplari.has(anahtar)) {
      santralGruplari.set(anahtar, { santral_id: s.santral_id, santral_adi: s.santral_adi, periyotlar: new Map() });
    }
    const grup = santralGruplari.get(anahtar);
    if (!grup.periyotlar.has(s.periyot_tipi)) {
      grup.periyotlar.set(s.periyot_tipi, []);
    }
    grup.periyotlar.get(s.periyot_tipi).push(s);
  }
  // Genel (santral_id yok) grubu her zaman başta, diğerleri isme göre sıralı
  const sonuc = [...santralGruplari.values()].sort((a, b) => {
    if (!a.santral_id) return -1;
    if (!b.santral_id) return 1;
    return (a.santral_adi || "").localeCompare(b.santral_adi || "");
  });
  return sonuc;
}

export default function SablonlarSayfasi() {
  const router = useRouter();
  const dosyaInputRef = useRef(null);
  const kendiIsletmeId = typeof window !== "undefined" ? kullaniciAl()?.isletme_id : null;
  const platformAdminMi = typeof window !== "undefined" && kullaniciAl()?.rol === "ADMIN";

  const [sablonlar, setSablonlar] = useState(null);
  const [isletmeler, setIsletmeler] = useState(null);
  const [tumSantraller, setTumSantraller] = useState(null);
  const [seciliHoldingId, setSeciliHoldingId] = useState(kendiIsletmeId || "");
  const [digerHoldingSablonlari, setDigerHoldingSablonlari] = useState(null);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [acikGruplar, setAcikGruplar] = useState({}); // "santralAnahtari|periyot" -> bool
  const [kopyaAcikSablonId, setKopyaAcikSablonId] = useState(null);
  const [kopyaHedefHoldingId, setKopyaHedefHoldingId] = useState("");

  const [formuAcik, setFormuAcik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [taslak, setTaslak] = useState(bosSablon(kendiIsletmeId));
  const [duzenlenenSablonId, setDuzenlenenSablonId] = useState(null);
  const [acikKarekodId, setAcikKarekodId] = useState(null);
  const [klasorYolu, setKlasorYolu] = useState("");
  const [sablonEkipmanId, setSablonEkipmanId] = useState("");

  // ---- Klasöre göre şablon görüntüleme (sabit yol: Elektromekanik > Turbin > Türbin) ----
  const [goruntuleSantralId, setGoruntuleSantralId] = useState("");
  const [goruntuleUniteleri, setGoruntuleUniteleri] = useState(null); // [{klasor_id, ad}, ...]
  const [acikUniteler, setAcikUniteler] = useState({}); // klasor_id -> bool
  const [uniteSablonlari, setUniteSablonlari] = useState({}); // klasor_id -> [sablon]
  const [goruntuleHata, setGoruntuleHata] = useState(null);
  const [goruntuleSantraller, setGoruntuleSantraller] = useState(null);
  const [santralEkipmanlari, setSantralEkipmanlari] = useState(null);
  const [sablonPeriyotYapraklari, setSablonPeriyotYapraklari] = useState(null);
  const [gercekEkipmanTipleri, setGercekEkipmanTipleri] = useState(null);

  const verileriYukle = useCallback(async () => {
    try {
      const istekler = [istekAt("/api/v1/santraller")];
      if (platformAdminMi) istekler.push(istekAt("/api/v1/bakim-sablonlari/diger-holdingler"));
      if (platformAdminMi) istekler.push(istekAt("/api/v1/isletmeler"));
      const sonuclar = await Promise.all(istekler);
      setTumSantraller(sonuclar[0].veri);
      if (platformAdminMi) {
        setDigerHoldingSablonlari(sonuclar[1].veri);
        setIsletmeler(sonuclar[2].veri);
      }

      if (!platformAdminMi || seciliHoldingId) {
        const hedefId = platformAdminMi ? seciliHoldingId : kendiIsletmeId;
        const s = await istekAt(`/api/v1/bakim-sablonlari?hepsi=1&isletme_id=${hedefId}`);
        setSablonlar(s.veri);
      } else {
        setSablonlar(null);
      }
    } catch (err) {
      setHata(err.message);
    }
  }, [platformAdminMi, seciliHoldingId, kendiIsletmeId]);

  useEffect(() => {
    if (!tokenAl()) {
      router.replace("/");
      return;
    }
    if (!yoneticiMi()) {
      router.replace("/gorevler");
      return;
    }
    verileriYukle();
  }, [verileriYukle, router]);

  // Şablon formundaki "Ekipman Tipi" önerilerini, seçilen santral/holding
  // kapsamında GERÇEKTEN kayıtlı olan ekipman tipleriyle dolduruyoruz —
  // böylece yazım hatası/farklı büyük-küçük harf yüzünden şablonun hiçbir
  // ekipmanla eşleşmemesi (ve dolayısıyla oto-planlamada "0 plan
  // oluşturuldu" çıkması) önlenir.
  useEffect(() => {
    if (!formuAcik) return;
    const p = new URLSearchParams();
    if (taslak.santral_id) p.set("santral_id", taslak.santral_id);
    else if (taslak.isletme_id) p.set("isletme_id", taslak.isletme_id);
    istekAt(`/api/v1/bakim-sablonlari/ekipman-tipleri?${p.toString()}`)
      .then((v) => setGercekEkipmanTipleri(v.veri))
      .catch(() => setGercekEkipmanTipleri([]));
  }, [formuAcik, taslak.santral_id, taslak.isletme_id]);

  // Şablon formunda Santral seçilince, o santraldeki MEVCUT ekipmanları
  // getiriyoruz — artık şablon, ağaçta yeniden gezinmek yerine doğrudan
  // önceden oluşturulmuş bir ekipmandan seçilir (ekipmanı olmayan bir
  // konuma şablon yüklenemez).
  // NOT: Bir şablonu DÜZENLERKEN (duzenlenenSablonId doluyken) bu efekt,
  // duzenlemeyiBaslat'ın az önce doldurduğu Ekipman/Periyot seçimini
  // SIFIRLAMAMALI — bu yüzden düzenleme modundayken sıfırlama atlanır.
  useEffect(() => {
    if (!duzenlenenSablonId) {
      setSablonEkipmanId("");
      setSablonPeriyotYapraklari(null);
      setKlasorYolu("");
    }
    if (!formuAcik || !taslak.santral_id) {
      setSantralEkipmanlari(null);
      return;
    }
    istekAt(`/api/v1/santraller/${taslak.santral_id}/ekipmanlar`)
      .then((v) => setSantralEkipmanlari(v.veri))
      .catch((err) => setHata(err.message));
  }, [formuAcik, taslak.santral_id, duzenlenenSablonId]);

  async function sablonEkipmanSecildi(ekipmanId) {
    setSablonEkipmanId(ekipmanId);
    setTaslak((t) => ({ ...t, klasor_id: "", periyot_tipi: "" }));
    setKlasorYolu("");
    setSablonPeriyotYapraklari(null);
    const ek = (santralEkipmanlari || []).find((x) => x.ekipman_id === ekipmanId);
    if (ek && ek.klasor_id) {
      try {
        const veri = await istekAt(`/api/v1/klasorler/${ek.klasor_id}/periyot-yapraklari`);
        setSablonPeriyotYapraklari(veri.veri);
        const yol = await istekAt(`/api/v1/klasorler/${ek.klasor_id}/yol`);
        setKlasorYolu(yol.veri.map((y) => y.ad).join(" > "));
      } catch (err) {
        setHata(err.message);
      }
    }
  }

  // Başka bir sayfadan ("Bu ekipman için henüz şablon yok" bağlantısıyla)
  // gelindiyse — santral_id/ekipman_id/donus adresini URL'den okuyup formu
  // otomatik dolduruyoruz ve kaydedince geri dönülecek adresi saklıyoruz.
  const [donusYolu, setDonusYolu] = useState(null);
  const [baglamdanGeldi, setBaglamdanGeldi] = useState(false);
  useEffect(() => {
    if (!router.isReady) return;
    const { santral_id, ekipman_id, donus } = router.query;
    if (donus) setDonusYolu(donus);
    if (santral_id && ekipman_id && !baglamdanGeldi) {
      setBaglamdanGeldi(true);
      setFormuAcik(true);
      // Bu santral hangi holdinge aitse (o an ekranda seçili olan holdingle
      // aynı olmayabilir), formu ve GM ise üstteki Holding seçimini de o
      // holdinge göre ayarlıyoruz — aksi halde Santral kutusu, yanlış
      // holdinge göre süzüldüğü için hedef santrali hiç göstermezdi.
      istekAt(`/api/v1/santraller/${santral_id}`)
        .then((santral) => {
          setTaslak((t) => ({ ...t, santral_id, isletme_id: santral.isletme_id }));
          if (platformAdminMi) setSeciliHoldingId(santral.isletme_id);
        })
        .catch((err) => setHata(err.message));
    }
  }, [router.isReady, router.query, baglamdanGeldi, platformAdminMi]);

  // santralEkipmanlari yüklenince (yukarıdaki efekt santral_id'yi
  // ayarladıktan sonra), bağlamdan gelen ekipmanı otomatik seçiyoruz.
  useEffect(() => {
    if (baglamdanGeldi && router.query.ekipman_id && santralEkipmanlari && !sablonEkipmanId) {
      const varMi = santralEkipmanlari.find((e) => e.ekipman_id === router.query.ekipman_id);
      if (varMi) sablonEkipmanSecildi(router.query.ekipman_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [santralEkipmanlari, baglamdanGeldi]);

  const gosterilecekSantraller = (tumSantraller || []).filter(
    (s) => s.isletme_id === (platformAdminMi ? seciliHoldingId : kendiIsletmeId)
  );

  // ---- Klasöre göre şablon görüntüleme — sabit yolu (Elektromekanik >
  // Ünite NUMARASINA göre toplar — Türbin'in, Generatör'ün, HPU'nun vb.
  // "Ünite 1"i aynı grupta birleşir; tek bir ekipman yoluna bağlı değildir.
  const [agacHicYok, setAgacHicYok] = useState(false);
  const [agacKuruluyor, setAgacKuruluyor] = useState(false);

  const goruntuleUniteleriGetir = useCallback(async (santralId) => {
    if (!santralId) return;
    setGoruntuleUniteleri(null);
    setAcikUniteler({});
    setUniteSablonlari({});
    setGoruntuleHata(null);
    setAgacHicYok(false);
    try {
      const veri = await istekAt(`/api/v1/santraller/${santralId}/unite-sablonlari`);
      const uniteler = veri.veri.map((u) => ({ klasor_id: `unite-${u.unite_no}`, ad: u.ad }));
      setGoruntuleUniteleri(uniteler);
      setUniteSablonlari(Object.fromEntries(veri.veri.map((u) => [`unite-${u.unite_no}`, u.sablonlar])));
      if (uniteler.length === 0) {
        // Hiç "Ünite N" düğümü bulunamadıysa, bu santralde klasör ağacının
        // hiç kurulmamış olup olmadığını kontrol edip kurulum önerisi
        // gösteriyoruz.
        const kokVeri = await istekAt(`/api/v1/santraller/${santralId}/klasorler`);
        setAgacHicYok(kokVeri.veri.length === 0);
      }
    } catch (err) {
      setGoruntuleHata(err.message);
    }
  }, []);

  async function goruntuleAgaciKur() {
    setAgacKuruluyor(true);
    try {
      await istekAt(`/api/v1/santraller/${goruntuleSantralId}/klasor-agaci-yukle`, { method: "POST" });
      await goruntuleUniteleriGetir(goruntuleSantralId);
    } catch (err) {
      setGoruntuleHata(err.message);
    } finally {
      setAgacKuruluyor(false);
    }
  }

  useEffect(() => {
    if (goruntuleSantralId) goruntuleUniteleriGetir(goruntuleSantralId);
    else setGoruntuleUniteleri(null);
  }, [goruntuleSantralId, goruntuleUniteleriGetir]);

  // Görüntüleme bölümü için erişilebilir santralleri getirir. GM için
  // önce holding seçilmesini bekler ve yalnızca o holdingin santrallerini
  // gösterir; İşletme Admin/Santral Sorumlusu için (tek holding zaten
  // kendi holdingleri olduğundan) doğrudan listelenir — tek santrale
  // tanımlıysa o santral otomatik seçilir.
  useEffect(() => {
    setGoruntuleSantraller(null);
    setGoruntuleSantralId("");
    if (platformAdminMi && !seciliHoldingId) return;
    istekAt("/api/v1/santraller")
      .then((veri) => {
        const filtreli = platformAdminMi ? veri.veri.filter((s) => s.isletme_id === seciliHoldingId) : veri.veri;
        setGoruntuleSantraller(filtreli);
        if (filtreli.length === 1) {
          setGoruntuleSantralId(filtreli[0].santral_id);
        }
      })
      .catch((err) => setGoruntuleHata(err.message));
  }, [platformAdminMi, seciliHoldingId]);

  function uniteAcKapa(k) {
    setAcikUniteler((o) => ({ ...o, [k.klasor_id]: !o[k.klasor_id] }));
  }

  function grupAnahtari(santralId, periyot) {
    return `${santralId || "genel"}|${periyot}`;
  }
  function grupToggle(santralId, periyot) {
    const anahtar = grupAnahtari(santralId, periyot);
    setAcikGruplar((onceki) => ({ ...onceki, [anahtar]: !onceki[anahtar] }));
  }

  function yeniSablonBaslat() {
    setTaslak(bosSablon(platformAdminMi ? seciliHoldingId : kendiIsletmeId));
    setDuzenlenenSablonId(null);
    setKlasorYolu("");
    setFormuAcik(true);
    setBilgi(null);
    setHata(null);
  }

  async function duzenlemeyiBaslat(sablonOzet) {
    setHata(null);
    setBilgi(null);
    try {
      const s = await istekAt(`/api/v1/bakim-sablonlari/${sablonOzet.sablon_id}`);
      setTaslak({
        ad: s.ad,
        ekipman_adi: s.ekipman_adi || "",
        ekipman_tipi: s.ekipman_tipi,
        unite_no: s.unite_no || "",
        klasor_id: s.klasor_id || "",
        periyot_tipi: s.periyot_tipi,
        isletme_id: s.isletme_id,
        santral_id: s.santral_id || "",
        kalemler: (s.checklist_json?.kalemler || []).map((k) => ({ ...k })),
      });
      if (s.klasor_id) {
        istekAt(`/api/v1/klasorler/${s.klasor_id}/yol`)
          .then(async (yol) => {
            setKlasorYolu(yol.veri.map((y) => y.ad).join(" > "));
            // Bu şablonun BAĞLI OLDUĞU ekipmanı (yaprağın bir üstü) bulup
            // Ekipman/Periyot kutularında önceden seçili gösteriyoruz —
            // böylece "şu an yanlış üniteye mi bağlı" hemen görülebilir.
            const ustDugum = yol.veri[yol.veri.length - 2];
            if (ustDugum) {
              try {
                const ekipmanlarVeri = await istekAt(`/api/v1/klasorler/${ustDugum.klasor_id}/ekipmanlar`);
                if (ekipmanlarVeri.veri[0]) setSablonEkipmanId(ekipmanlarVeri.veri[0].ekipman_id);
                const periyotVeri = await istekAt(`/api/v1/klasorler/${ustDugum.klasor_id}/periyot-yapraklari`);
                setSablonPeriyotYapraklari(periyotVeri.veri);
              } catch {
                // sessizce geç — kutular boş kalır, elle seçilebilir
              }
            }
          })
          .catch(() => setKlasorYolu(""));
      } else {
        setKlasorYolu("");
        setSablonEkipmanId("");
        setSablonPeriyotYapraklari(null);
      }
      setDuzenlenenSablonId(s.sablon_id);
      setFormuAcik(true);
    } catch (err) {
      setHata(err.message);
    }
  }

  function kalemEkle() {
    setTaslak((t) => ({ ...t, kalemler: [...t.kalemler, bosKalem(t.kalemler.length + 1)] }));
  }
  function kalemGuncelle(index, alan, deger) {
    setTaslak((t) => {
      const kalemler = [...t.kalemler];
      kalemler[index] = { ...kalemler[index], [alan]: deger };
      return { ...t, kalemler };
    });
  }
  function kalemSil(index) {
    setTaslak((t) => ({ ...t, kalemler: t.kalemler.filter((_, i) => i !== index) }));
  }

  async function dosyaSecildi(e) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setHata(null);
    try {
      const buffer = await dosya.arrayBuffer();
      const sonuc = excelDenSablonCikar(buffer);
      if (sonuc.kalemler.length === 0) {
        setHata(
          'Dosyada "Kontrol" başlıklı bir bölüm bulunamadı, otomatik çıkarım yapılamadı. Maddeleri aşağıya elle ekleyebilirsiniz.'
        );
      } else {
        setBilgi(
          `Dosyadan ${sonuc.kalemler.length} kontrol maddesi bulundu. "Ekipman Tipi" alanını sistemde kayıtlı gerçek bir değerle doldurmayı unutmayın — otomatik tahmin edilemez. Kaydetmeden önce diğer alanları da gözden geçirin.`
        );
      }
      setTaslak((t) => ({
        ...t,
        ad: sonuc.ad || "",
        ekipman_adi: sonuc.ekipman_adi || "",
        ekipman_tipi: "",
        unite_no: sonuc.unite_no || "",
        periyot_tipi: sonuc.periyot_tipi || "AYLIK",
        kalemler: sonuc.kalemler.map((k) => ({ ...k, birim: "", zorunlu: true })),
      }));
      setFormuAcik(true);
    } catch (err) {
      setHata("Dosya okunamadı — geçerli bir .xlsx dosyası olduğundan emin olun.");
    } finally {
      e.target.value = "";
    }
  }

  async function sablonuKaydet(e) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);

    if (taslak.kalemler.length === 0) {
      setHata("En az bir kontrol maddesi eklemelisiniz.");
      return;
    }
    const eksikSoru = taslak.kalemler.find((k) => !k.soru.trim());
    if (eksikSoru) {
      setHata("Boş bırakılmış bir kontrol maddesi var — doldurun ya da silin.");
      return;
    }

    setGonderiliyor(true);
    try {
      if (duzenlenenSablonId) {
        await istekAt(`/api/v1/bakim-sablonlari/${duzenlenenSablonId}`, {
          method: "PATCH",
          body: JSON.stringify({
            ad: taslak.ad,
            ekipman_adi: taslak.ekipman_adi || null,
            ekipman_tipi: taslak.ekipman_tipi,
            unite_no: taslak.unite_no || null,
            klasor_id: taslak.klasor_id || null,
            periyot_tipi: taslak.periyot_tipi,
            checklist_json: { kalemler: taslak.kalemler },
            santral_id: taslak.santral_id || null,
          }),
        });
        setBilgi("Şablon güncellendi — yeni bir versiyon olarak kaydedildi, eski versiyon pasifleşti.");
      } else {
        const yeniSablon = await istekAt("/api/v1/bakim-sablonlari", {
          method: "POST",
          body: JSON.stringify({
            ad: taslak.ad,
            ekipman_adi: taslak.ekipman_adi || null,
            ekipman_tipi: taslak.ekipman_tipi,
            unite_no: taslak.unite_no || null,
            klasor_id: taslak.klasor_id || null,
            periyot_tipi: taslak.periyot_tipi,
            checklist_json: { kalemler: taslak.kalemler },
            isletme_id: taslak.isletme_id,
            santral_id: taslak.santral_id || null,
          }),
        });
        setBilgi("Bakım şablonu kaydedildi. Karekodu aşağıda görebilirsiniz.");
        setAcikKarekodId(yeniSablon.sablon_id);
        setAcikGruplar((onceki) => ({
          ...onceki,
          [grupAnahtari(taslak.santral_id || null, taslak.periyot_tipi)]: true,
        }));
      }
      setFormuAcik(false);
      setDuzenlenenSablonId(null);
      await verileriYukle();
      // Alttaki "Klasöre göre görüntüle" bölümü kendi başına önbelleklediği
      // için, bir şablon kaydedildiğinde/düzenlendiğinde onu da tazeleriz —
      // aksi halde az önce yapılan değişiklik orada eski (bayat) haliyle
      // görünmeye devam ederdi.
      if (goruntuleSantralId) await goruntuleUniteleriGetir(goruntuleSantralId);
    } catch (err) {
      setHata(err.message);
    } finally {
      setGonderiliyor(false);
    }
  }

  async function sablonDurumDegistir(sablon) {
    setHata(null);
    try {
      const yol = sablon.aktif_mi
        ? `/api/v1/bakim-sablonlari/${sablon.sablon_id}/pasiflestir`
        : `/api/v1/bakim-sablonlari/${sablon.sablon_id}/aktiflestir`;
      await istekAt(yol, { method: "POST" });
      await verileriYukle();
      if (goruntuleSantralId) await goruntuleUniteleriGetir(goruntuleSantralId);
    } catch (err) {
      setHata(err.message);
    }
  }

  async function sablonSil(sablon) {
    if (!confirm(`"${sablon.ad}" şablonunu kalıcı olarak silmek istediğinize emin misiniz?`)) return;
    setHata(null);
    try {
      await istekAt(`/api/v1/bakim-sablonlari/${sablon.sablon_id}`, { method: "DELETE" });
      await verileriYukle();
      if (goruntuleSantralId) await goruntuleUniteleriGetir(goruntuleSantralId);
    } catch (err) {
      setHata(err.message);
    }
  }

  async function sablonKopyala(sablon, hedefHoldingId) {
    setHata(null);
    setBilgi(null);
    try {
      await istekAt(`/api/v1/bakim-sablonlari/${sablon.sablon_id}/kopyala`, {
        method: "POST",
        body: JSON.stringify({ hedef_isletme_id: hedefHoldingId }),
      });
      const hedefAdi = isletmeler?.find((h) => h.isletme_id === hedefHoldingId)?.ad || "seçilen holdinge";
      setBilgi(`"${sablon.ad}" ${hedefAdi} kopyalandı.`);
      setKopyaAcikSablonId(null);
      await verileriYukle();
    } catch (err) {
      setHata(err.message);
    }
  }

  const gruplar = sablonlar ? santralVePeriyodaGoreGrupla(sablonlar) : null;
  const seciliHoldingAdi = isletmeler?.find((h) => h.isletme_id === seciliHoldingId)?.ad;

  return (
    <>
      <Head>
        <title>Bakım Şablonları — HES CMMS</title>
      </Head>
      <div className="sayfa">
        <UstBar />
        <div className="icerik">
          {donusYolu && (
            <div className="basariliKutu" style={{ marginBottom: "14px" }}>
              Bu sayfaya, bir ekipman için şablon eklemeniz üzere yönlendirildiniz.{" "}
              <button type="button" className="linkButon" style={{ fontWeight: 700 }} onClick={() => router.push(donusYolu)}>
                ◀ Şimdi geri dön
              </button>
            </div>
          )}
          <div className="bolumBaslik">
            <h2>Bakım Şablonları</h2>
            {(!platformAdminMi || seciliHoldingId) && (
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="kucukButon" onClick={() => dosyaInputRef.current.click()}>
                  Excel'den İçe Aktar
                </button>
                <button className="kucukButon" onClick={yeniSablonBaslat}>
                  + Elle Oluştur
                </button>
              </div>
            )}
            <input
              ref={dosyaInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={dosyaSecildi}
            />
          </div>

          {platformAdminMi && (
            <div className="alan" style={{ maxWidth: "340px" }}>
              <label>Holding</label>
              <select value={seciliHoldingId} onChange={(e) => setSeciliHoldingId(e.target.value)}>
                <option value="">Bir holding seçin…</option>
                {isletmeler &&
                  isletmeler.map((h) => (
                    <option key={h.isletme_id} value={h.isletme_id}>
                      {h.ad}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {goruntuleHata && <div className="hataKutusu">{goruntuleHata}</div>}
          {hata && <div className="hataKutusu">{hata}</div>}
          {bilgi && (
            <div className="basariliKutu">
              {bilgi}
              {donusYolu && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="linkButon"
                    style={{ fontWeight: 700 }}
                    onClick={() => router.push(donusYolu)}
                  >
                    ◀ Geldiğiniz sayfaya geri dönün
                  </button>
                </>
              )}
            </div>
          )}

          <div className="yonetimFormu" style={{ background: "var(--surface)" }}>
            {platformAdminMi && !seciliHoldingId && (
              <div className="bosDurum">Şablonları klasöre göre görmek için yukarıdan bir holding seçin.</div>
            )}

            {(!platformAdminMi || seciliHoldingId) && (
              <>
                {goruntuleSantraller && goruntuleSantraller.length > 1 && (
                  <div className="alan" style={{ maxWidth: "340px" }}>
                    <label>Santral</label>
                    <select value={goruntuleSantralId} onChange={(e) => setGoruntuleSantralId(e.target.value)}>
                      <option value="">Seçin…</option>
                      {goruntuleSantraller.map((s) => (
                        <option key={s.santral_id} value={s.santral_id}>
                          {s.ad}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!goruntuleSantraller && <div className="yukleniyor">Yükleniyor…</div>}
                {goruntuleSantraller && goruntuleSantraller.length === 0 && (
                  <div className="bosDurum">Bu holdingde santral yok.</div>
                )}
                {goruntuleSantraller && goruntuleSantraller.length > 1 && !goruntuleSantralId && (
                  <div className="bosDurum">Görmek için bir santral seçin.</div>
                )}
              </>
            )}

            {goruntuleSantralId && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: "2px" }}>
                    {(goruntuleSantraller || []).find((s) => s.santral_id === goruntuleSantralId)?.ad}
                  </h3>
                  <div className="gorevAlt" style={{ marginBottom: "8px" }}>
                    "Ünite N" olarak organize edilmiş TÜM ekipmanları (Türbin, Generatör, HPU vb.) kapsar — Ünite
                    ayrımı olmayan ortak ekipmanlar (ör. Trafolar, Şalt Sahası) bu listede yer almaz, bu yüzden
                    aşağıdaki tam listeden toplamı yine de farklı olabilir.
                  </div>
                </div>
                <button
                  type="button"
                  className="linkButon"
                  onClick={() => goruntuleUniteleriGetir(goruntuleSantralId)}
                >
                  ↻ Yenile
                </button>
              </div>
            )}

            {goruntuleSantralId && !goruntuleUniteleri && <div className="yukleniyor">Yükleniyor…</div>}

            {goruntuleUniteleri && goruntuleUniteleri.length === 0 && !goruntuleHata && agacHicYok && (
              <div className="bosDurum">
                Bu santralde henüz klasör ağacı kurulmamış.{" "}
                <button type="button" className="linkButon" onClick={goruntuleAgaciKur} disabled={agacKuruluyor}>
                  {agacKuruluyor ? "Kuruluyor…" : "Standart HES klasör ağacını kur"}
                </button>
              </div>
            )}
            {goruntuleUniteleri && goruntuleUniteleri.length === 0 && !goruntuleHata && !agacHicYok && (
              <div className="bosDurum">Bu santralde "Ünite N" olarak organize edilmiş bir klasör bulunamadı.</div>
            )}

            {goruntuleUniteleri &&
              goruntuleUniteleri.map((k) => {
                const acik = !!acikUniteler[k.klasor_id];
                const sablonlar = uniteSablonlari[k.klasor_id] || [];
                return (
                  <div key={k.klasor_id} style={{ marginBottom: "6px" }}>
                    <button
                      type="button"
                      className="periyotGrupBasligi"
                      onClick={() => uniteAcKapa(k)}
                    >
                      {acik ? "▾" : "▸"} {k.ad} Bakımları ({sablonlar.length})
                    </button>

                    {acik && (
                      <div style={{ marginTop: "6px", marginLeft: "6px" }}>
                        {sablonlar.length === 0 && (
                          <div className="bosDurum">Bu ünite için henüz bir bakım şablonu yüklenmemiş.</div>
                        )}
                        {sablonlar.map((s) => (
                          <div className="satirKart" key={s.sablon_id}>
                            <strong>{s.ad}</strong>
                            <div className="gorevAlt">{PERIYOT_ETIKETLERI[s.periyot_tipi] || s.periyot_tipi}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {formuAcik && (
            <form onSubmit={sablonuKaydet} className="yonetimFormu">
              {platformAdminMi && isletmeler && !duzenlenenSablonId && (
                <div className="alan">
                  <label>Holding</label>
                  <select
                    value={taslak.isletme_id || ""}
                    onChange={(e) => setTaslak({ ...taslak, isletme_id: e.target.value, santral_id: "" })}
                  >
                    {isletmeler.map((i) => (
                      <option key={i.isletme_id} value={i.isletme_id}>
                        {i.ad}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="alan">
                <label>Santral (isteğe bağlı — boş bırakılırsa holding genelinde geçerli olur)</label>
                <select
                  value={taslak.santral_id}
                  onChange={(e) =>
                    setTaslak({ ...taslak, santral_id: e.target.value, klasor_id: "" })
                  }
                >
                  <option value="">Genel (Tüm Santraller)</option>
                  {(tumSantraller || [])
                    .filter((s) => s.isletme_id === taslak.isletme_id)
                    .map((s) => (
                      <option key={s.santral_id} value={s.santral_id}>
                        {s.ad}
                      </option>
                    ))}
                </select>
              </div>

              {!taslak.santral_id && (
                <div className="kutuphaneBosUyari" style={{ marginBottom: "10px" }}>
                  ⚠ Bu şablonu klasör ağacındaki bir Üniteye bağlamak için önce yukarıdan bir <strong>Santral</strong> seçin — Santral seçilmeden Ekipman/Periyot kutuları görünmez.
                </div>
              )}

              {taslak.santral_id ? (
                <>
                  <div className="alan">
                    <label>Ekipman — daha önce Ekipman Oluştur'da eklenmiş kayıtlardan seçin</label>
                    <select
                      required
                      value={sablonEkipmanId}
                      onChange={(e) => sablonEkipmanSecildi(e.target.value)}
                    >
                      <option value="">Seçin…</option>
                      {(santralEkipmanlari || []).map((ek) => (
                        <option key={ek.ekipman_id} value={ek.ekipman_id}>
                          {ek.unite_no ? `${ek.unite_no} ` : ""}
                          {ek.ad} - ({ek.tip})
                        </option>
                      ))}
                    </select>
                    {santralEkipmanlari && santralEkipmanlari.length === 0 && (
                      <div className="kutuphaneBosUyari">
                        Bu santralde henüz ekipman yok — önce{" "}
                        <a href="/ekipman-olustur">Ekipman Oluştur</a>'dan, klasör ağacından yerini seçerek ekleyin.
                        Ekipmanı olmayan bir konuma şablon yüklenemez.
                      </div>
                    )}
                    {klasorYolu && <div className="gorevAlt" style={{ marginTop: "6px" }}>Konum: {klasorYolu}</div>}
                  </div>

                  {sablonEkipmanId && (
                    <div className="alan">
                      <label>Periyot — bu ekipmanın klasöründeki periyotlardan seçin</label>
                      <select
                        required
                        value={taslak.klasor_id}
                        onChange={(e) => {
                          const secilen = (sablonPeriyotYapraklari || []).find((p) => p.klasor_id === e.target.value);
                          setTaslak((t) => ({
                            ...t,
                            klasor_id: e.target.value,
                            periyot_tipi: secilen ? secilen.periyot_tipi : "",
                          }));
                        }}
                      >
                        <option value="">Seçin…</option>
                        {(sablonPeriyotYapraklari || []).map((p) => (
                          <option key={p.klasor_id} value={p.klasor_id}>
                            {p.ad}
                            {Number(p.sablon_sayisi) > 0 ? ` (${p.sablon_sayisi} şablon var)` : ""}
                          </option>
                        ))}
                      </select>
                      {sablonPeriyotYapraklari && sablonPeriyotYapraklari.length === 0 && (
                        <div className="kutuphaneBosUyari">
                          Bu ekipmanın klasöründe periyot tanımlı değil — klasör ağacınızı kontrol edin.
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="alan">
                    <label>Ünite No (isteğe bağlı — belirli bir üniteye özelse)</label>
                    <input
                      value={taslak.unite_no}
                      onChange={(e) => setTaslak({ ...taslak, unite_no: e.target.value })}
                      placeholder="Ör. 1, 2, 3…"
                    />
                  </div>
                  <div className="alan">
                    <label>Ekipman Adı</label>
                    <input
                      required
                      list="ekipman-adi-onerileri"
                      value={taslak.ekipman_adi}
                      onChange={(e) => setTaslak({ ...taslak, ekipman_adi: e.target.value })}
                      placeholder="Ör. Türbin, Jeneratör, Pompa…"
                    />
                    <datalist id="ekipman-adi-onerileri">
                      {EKIPMAN_ADI_ONERILERI.map((ad) => (
                        <option key={ad} value={ad} />
                      ))}
                    </datalist>
                  </div>
                  <div className="alan">
                    <label>Ekipman Tipi — sistemde kayıtlı ekipmanlarla eşleşmesi için gerçek değerlerden seçin</label>
                    <input
                      required
                      list="ekipman-tipi-onerileri"
                      value={taslak.ekipman_tipi}
                      onChange={(e) => setTaslak({ ...taslak, ekipman_tipi: e.target.value })}
                      placeholder="Ör. Francis Türbin, Senkron Jeneratör…"
                    />
                    <datalist id="ekipman-tipi-onerileri">
                      {(gercekEkipmanTipleri || []).map((tip) => (
                        <option key={tip} value={tip} />
                      ))}
                    </datalist>
                    {gercekEkipmanTipleri && gercekEkipmanTipleri.length === 0 && (
                      <div className="kutuphaneBosUyari">
                        Bu kapsamda henüz kayıtlı ekipman yok — buraya yazdığınız değerin, ekipmanı oluştururken
                        gireceğiniz "Tip" alanıyla BİREBİR aynı olduğundan emin olun (büyük/küçük harf dahil).
                      </div>
                    )}
                  </div>
                  <div className="alan">
                    <label>Periyot</label>
                    <select
                      value={taslak.periyot_tipi}
                      onChange={(e) => setTaslak({ ...taslak, periyot_tipi: e.target.value })}
                    >
                      {Object.entries(PERIYOT_ETIKETLERI).map(([deger, etiket]) => (
                        <option key={deger} value={deger}>
                          {etiket}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="alan">
                <label>Şablon adı</label>
                <input
                  required
                  value={taslak.ad}
                  onChange={(e) => setTaslak({ ...taslak, ad: e.target.value })}
                  placeholder="Ör. Ünite 1 Türbin Aylık Periyodik Bakım (ALP2-BKM-TUR-1AY-014)"
                />
              </div>

              <div className="kalemSoru" style={{ marginTop: "18px", marginBottom: "10px" }}>
                Kontrol Maddeleri ({taslak.kalemler.length})
              </div>

              {taslak.kalemler.map((k, i) => (
                <div className="sablonKalemSatiri" key={i}>
                  <input
                    className="sablonKalemSoru"
                    value={k.soru}
                    onChange={(e) => kalemGuncelle(i, "soru", e.target.value)}
                    placeholder="Kontrol maddesi metni"
                  />
                  <select value={k.tip} onChange={(e) => kalemGuncelle(i, "tip", e.target.value)}>
                    {Object.entries(TIP_ETIKETLERI).map(([deger, etiket]) => (
                      <option key={deger} value={deger}>
                        {etiket}
                      </option>
                    ))}
                  </select>
                  {k.tip === "olcum" && (
                    <input
                      className="sablonKalemBirim"
                      value={k.birim || ""}
                      onChange={(e) => kalemGuncelle(i, "birim", e.target.value)}
                      placeholder="Birim (ör. °C)"
                    />
                  )}
                  <button type="button" className="fotografKarti-sil" onClick={() => kalemSil(i)}>
                    ×
                  </button>
                </div>
              ))}

              <button type="button" className="fotografEkleButon" onClick={kalemEkle} style={{ marginTop: "8px" }}>
                + Madde Ekle
              </button>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button className="birincilButon" type="submit" disabled={gonderiliyor}>
                  {gonderiliyor
                    ? "Kaydediliyor…"
                    : duzenlenenSablonId
                    ? "Yeni Versiyon Olarak Kaydet"
                    : "Şablonu Kaydet"}
                </button>
                <button
                  type="button"
                  className="kucukButon"
                  style={{ background: "var(--ink-soft)" }}
                  onClick={() => {
                    setFormuAcik(false);
                    setDuzenlenenSablonId(null);
                  }}
                >
                  Vazgeç
                </button>
              </div>
            </form>
          )}

          {platformAdminMi && !seciliHoldingId && !formuAcik && (
            <div className="bosDurum">Şablonları görmek için yukarıdan bir holding seçin.</div>
          )}

          {(!platformAdminMi || seciliHoldingId) && (
            <>
              {!gruplar && !formuAcik && <div className="yukleniyor">Yükleniyor…</div>}
              {gruplar && gruplar.length === 0 && !formuAcik && (
                <div className="bosDurum">Bu holdingde henüz bir bakım şablonu eklenmemiş.</div>
              )}

              {gruplar &&
                gruplar.map((santralGrubu) => (
                  <div key={santralGrubu.santral_id || "genel"} style={{ marginBottom: "22px" }}>
                    <h3 className="holdingBasligi">
                      {platformAdminMi && seciliHoldingAdi ? `${seciliHoldingAdi} — ` : ""}
                      {santralGrubu.santral_adi || "Genel (Tüm Santraller)"}
                    </h3>

                    {PERIYOT_SIRASI.filter((p) => santralGrubu.periyotlar.has(p)).map((periyot) => {
                      const sablonListesi = santralGrubu.periyotlar.get(periyot);
                      const acik = acikGruplar[grupAnahtari(santralGrubu.santral_id, periyot)];
                      return (
                        <div key={periyot} style={{ marginBottom: "8px" }}>
                          <button
                            type="button"
                            className="periyotGrupBasligi"
                            onClick={() => grupToggle(santralGrubu.santral_id, periyot)}
                          >
                            {acik ? "▾" : "▸"} {PERIYOT_ETIKETLERI[periyot]} Bakımlar ({sablonListesi.length})
                          </button>
                          {acik &&
                            sablonListesi.map((s) => (
                              <div className="satirKart" key={s.sablon_id} style={{ marginLeft: "18px" }}>
                                <div>
                                  <strong>{s.ad}</strong>
                                  {!s.aktif_mi && (
                                    <span className="rozet rozet-GECIKTI" style={{ marginLeft: 8 }}>
                                      Pasif
                                    </span>
                                  )}
                                  {!s.klasor_id && (
                                    <span
                                      className="rozet rozet-GECIKTI"
                                      style={{ marginLeft: 8 }}
                                      title="Bu şablon henüz klasör ağacındaki bir Üniteye bağlı değil — Klasöre Göre Görüntüle bölümünde görünmez. Düzenleyip Ekipman/Periyot seçerek bağlayın."
                                    >
                                      ⚠ Klasöre bağlı değil
                                    </span>
                                  )}
                                </div>
                                <div className="gorevAlt">
                                  {s.ekipman_adi ? `${s.ekipman_adi} — ` : ""}
                                  {s.ekipman_tipi}
                                  {s.unite_no ? ` · Ünite ${s.unite_no}` : ""} · v{s.versiyon}
                                </div>
                                <div className="kullaniciAlt">
                                  <button className="linkButon" onClick={() => duzenlemeyiBaslat(s)}>
                                    Düzenle
                                  </button>
                                  <button className="linkButon" onClick={() => sablonDurumDegistir(s)}>
                                    {s.aktif_mi ? "Pasifleştir" : "Yeniden aktifleştir"}
                                  </button>
                                  <button className="linkButon" onClick={() => sablonSil(s)}>
                                    Sil
                                  </button>
                                  <button
                                    className="linkButon"
                                    onClick={() =>
                                      setAcikKarekodId((onceki) => (onceki === s.sablon_id ? null : s.sablon_id))
                                    }
                                  >
                                    {acikKarekodId === s.sablon_id ? "Karekodu Gizle" : "Karekod Göster"}
                                  </button>
                                  <a
                                    className="linkButon"
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      const site = encodeURIComponent(window.location.origin);
                                      dosyaIndir(
                                        `/api/v1/bakim-sablonlari/${s.sablon_id}/karekod-pdf?site=${site}`,
                                        `karekod-${s.ad}.pdf`
                                      );
                                    }}
                                  >
                                    Karekod PDF İndir
                                  </a>
                                </div>
                                {acikKarekodId === s.sablon_id && (
                                  <div style={{ textAlign: "center", padding: "12px 0" }}>
                                    <img
                                      src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
                                        `${typeof window !== "undefined" ? window.location.origin : ""}/karekod-sablon/${s.sablon_id}`
                                      )}`}
                                      alt={`${s.ad} karekodu`}
                                      width={220}
                                      height={220}
                                    />
                                    <div className="gorevAlt" style={{ marginTop: "6px", fontWeight: 600 }}>
                                      {s.ad}
                                    </div>
                                    <div className="gorevAlt">
                                      Bu karekodu yazdırıp ilgili ekipmanın üzerine yapıştırın.
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      );
                    })}
                  </div>
                ))}

              {platformAdminMi &&
                digerHoldingSablonlari &&
                digerHoldingSablonlari.filter((s) => s.isletme_id !== seciliHoldingId).length > 0 && (
                  <div style={{ marginTop: "28px" }}>
                    <h3 className="holdingBasligi">Diğer Holdinglerden Kopyala</h3>
                    {digerHoldingSablonlari
                      .filter((s) => s.isletme_id !== seciliHoldingId)
                      .map((s) => (
                      <div className="satirKart" key={s.sablon_id}>
                        <div>
                          <strong>{s.ad}</strong>
                          <span className="gorevAlt"> — {s.isletme_adi}</span>
                        </div>
                        <div className="gorevAlt">
                          {s.ekipman_adi ? `${s.ekipman_adi} — ` : ""}
                          {s.ekipman_tipi}
                          {s.unite_no ? ` · Ünite ${s.unite_no}` : ""} ·{" "}
                          {PERIYOT_ETIKETLERI[s.periyot_tipi] || s.periyot_tipi}
                        </div>
                        <div className="kullaniciAlt">
                          {kopyaAcikSablonId === s.sablon_id ? (
                            <>
                              <select
                                value={kopyaHedefHoldingId}
                                onChange={(e) => setKopyaHedefHoldingId(e.target.value)}
                                style={{ fontSize: "12px", padding: "4px", marginRight: "10px" }}
                              >
                                <option value="">Hedef holding seçin…</option>
                                {isletmeler &&
                                  isletmeler
                                    .filter((h) => h.isletme_id !== s.isletme_id)
                                    .map((h) => (
                                      <option key={h.isletme_id} value={h.isletme_id}>
                                        {h.ad}
                                      </option>
                                    ))}
                              </select>
                              <button
                                className="linkButon"
                                disabled={!kopyaHedefHoldingId}
                                onClick={() => sablonKopyala(s, kopyaHedefHoldingId)}
                              >
                                Kopyala
                              </button>
                              <button className="linkButon" onClick={() => setKopyaAcikSablonId(null)}>
                                Vazgeç
                              </button>
                            </>
                          ) : (
                            <button
                              className="linkButon"
                              onClick={() => {
                                setKopyaAcikSablonId(s.sablon_id);
                                setKopyaHedefHoldingId(seciliHoldingId || "");
                              }}
                            >
                              Bir Holdinge Kopyala
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
