// Universal Till website i18n (static, no build step). Text nodes carry
// data-i18n keys; this swaps them and flips dir=rtl for Farsi. Adding a
// language = adding a column below. Launch markets: EN, TR, ZH, FA.
const I18N = {
  en: {
    _name: "English", _dir: "ltr",
    "nav.solutions": "Solutions", "nav.why": "Why it's different",
    "nav.hardware": "Hardware", "nav.plugins": "Plugins", "nav.store": "Store",
    "hero.title": "The point of sale that's actually yours.",
    "hero.lede": "Free, open source and offline-first — a full sale completes with no internet at all. Runs on a Raspberry Pi, an old laptop, or a proper touch terminal. No monthly fee for the core. Ever.",
    "hero.cta1": "Get started", "hero.cta2": "See the source",
    "hero.note": "MIT licensed · one small binary · works today",
    "sol.title": "A till for every kind of shop",
    "sol.sub": "One system, tuned to how you actually sell.",
    "sol.grocery.t": "Grocery & convenience", "sol.grocery.d": "Barcode scanning, weighed items, fast tender, and offline resilience for busy corner shops.",
    "sol.retail.t": "Retail & boutiques", "sol.retail.d": "Variants, product photos, catalogue import, and clean receipts with your own branding.",
    "sol.service.t": "Service trades", "sol.service.d": "Barbers, repairs and workshops: quick sales, VAT invoices and credit notes for business customers.",
    "sol.hospitality.t": "Cafés & restaurants", "sol.hospitality.d": "Held orders, split tender, fast repeat items, and a kitchen-ready workflow through plugins.",
    "sol.market.t": "Market stalls & pop-ups", "sol.market.d": "Runs on a phone-sized budget with no signal needed — pack up, move, and keep selling.",
    "sol.multi.t": "Growing to many tills", "sol.multi.d": "Add a second till by scanning a QR; they sync over your own LAN for free, no cloud required.",
    "why.title": "No lock-in. Of any kind.",
    "why.contracts.t": "No contracts or proprietary hardware", "why.contracts.d": "Runs on generic hardware you already own — a complete DIY till costs from about £70. No multi-year tie-ins.",
    "why.payments.t": "No payment-processor lock-in", "why.payments.d": "We never sit in your money flow. Use any card machine and any processor — no fee creep, no frozen payouts.",
    "why.data.t": "Your data, exportable, always", "why.data.d": "Full catalogue and sales export to CSV whenever you want. Your shop, your records — take them anywhere.",
    "why.offline.t": "Offline-first, truly", "why.offline.d": "The internet going down never stops a sale. Everything works locally; syncing is a bonus, never a requirement.",
    "hw.title": "Runs on hardware you choose",
    "hw.lede": "A Raspberry Pi, an old PC, a mini-PC, or a proper touch terminal — Universal Till is one small binary that runs on all of them. Buy a ready-made kit from our store, or build your own.",
    "hw.photo": "Product photo",
    "plugins.title": "Extend it with plugins",
    "plugins.lede": "A signed, verified plugin marketplace: payments, integrations, loyalty, themes and more. Install in one click; everything is checked before it reaches your till.",
    "store.title": "Get the hardware",
    "store.lede": "Ready-to-run devices and parts for a custom POS — buy assembled, or the pieces to build your own. Coming soon.",
    "store.cta": "Visit the store",
    "cta.title": "Start selling on your own terms",
    "cta.lede": "Free forever for a single till. Download it today.",
    "cta.btn": "Get started",
    "foot.tagline": "The free, offline-first point of sale.",
    "foot.owner": "Universal Till is a product of Task Runner Technology LTD.",
    "foot.rights": "Open source under the MIT licence."
  },
  tr: {
    _name: "Türkçe", _dir: "ltr",
    "nav.solutions": "Çözümler", "nav.why": "Farkı ne", "nav.hardware": "Donanım",
    "nav.plugins": "Eklentiler", "nav.store": "Mağaza",
    "hero.title": "Gerçekten size ait olan satış noktası.",
    "hero.lede": "Ücretsiz, açık kaynak ve çevrimdışı öncelikli — satış, internet olmadan da tamamlanır. Raspberry Pi'de, eski bir dizüstünde ya da dokunmatik terminalde çalışır. Çekirdek için asla aylık ücret yok.",
    "hero.cta1": "Başlayın", "hero.cta2": "Kaynağı görün",
    "hero.note": "MIT lisanslı · tek küçük dosya · bugün çalışır",
    "sol.title": "Her dükkâna uygun bir kasa",
    "sol.sub": "Tek sistem, sizin satış tarzınıza göre.",
    "sol.grocery.t": "Market & bakkal", "sol.grocery.d": "Barkod okuma, tartılı ürünler, hızlı ödeme ve yoğun dükkânlar için çevrimdışı dayanıklılık.",
    "sol.retail.t": "Perakende & butik", "sol.retail.d": "Varyantlar, ürün fotoğrafları, katalog içe aktarma ve kendi markanızla temiz fişler.",
    "sol.service.t": "Hizmet esnafı", "sol.service.d": "Berber, tamir ve atölyeler: hızlı satış, KDV faturaları ve kurumsal müşteriler için iade belgeleri.",
    "sol.hospitality.t": "Kafe & restoran", "sol.hospitality.d": "Bekletilen siparişler, bölünmüş ödeme, hızlı tekrar ürünler ve eklentilerle mutfağa hazır akış.",
    "sol.market.t": "Pazar tezgâhı & seyyar", "sol.market.d": "Telefon bütçesiyle, sinyal gerektirmeden çalışır — toplayın, taşıyın, satmaya devam edin.",
    "sol.multi.t": "Birden çok kasaya büyüme", "sol.multi.d": "QR okutarak ikinci kasa ekleyin; kendi yerel ağınızda ücretsiz eşitlenir, bulut gerekmez.",
    "why.title": "Hiçbir türden bağımlılık yok.",
    "why.contracts.t": "Sözleşme ya da özel donanım yok", "why.contracts.d": "Zaten sahip olduğunuz sıradan donanımda çalışır — komple bir kasa yaklaşık 70£'dan başlar. Yıllarca bağlanma yok.",
    "why.payments.t": "Ödeme sağlayıcı bağımlılığı yok", "why.payments.d": "Para akışınıza asla girmeyiz. Herhangi bir kart makinesi ve sağlayıcı kullanın — artan komisyon ya da donmuş ödeme yok.",
    "why.data.t": "Veriniz, her zaman dışa aktarılabilir", "why.data.d": "Tüm katalog ve satışları istediğinizde CSV'ye aktarın. Dükkânınız, kayıtlarınız — her yere götürün.",
    "why.offline.t": "Gerçekten çevrimdışı öncelikli", "why.offline.d": "İnternetin kesilmesi satışı asla durdurmaz. Her şey yerelde çalışır; eşitleme bir bonus, zorunluluk değil.",
    "hw.title": "Seçtiğiniz donanımda çalışır",
    "hw.lede": "Raspberry Pi, eski bir PC, mini PC ya da dokunmatik terminal — Universal Till hepsinde çalışan tek küçük dosyadır. Mağazamızdan hazır kit alın ya da kendinizinkini yapın.",
    "hw.photo": "Ürün fotoğrafı",
    "plugins.title": "Eklentilerle genişletin",
    "plugins.lede": "İmzalı, doğrulanmış eklenti pazarı: ödemeler, entegrasyonlar, sadakat, temalar ve daha fazlası. Tek tıkla kurun; her şey kasanıza ulaşmadan denetlenir.",
    "store.title": "Donanımı edinin",
    "store.lede": "Kullanıma hazır cihazlar ve özel POS için parçalar — kurulu alın ya da kendiniz yapmak için parçaları. Yakında.",
    "store.cta": "Mağazaya git",
    "cta.title": "Kendi kurallarınızla satmaya başlayın",
    "cta.lede": "Tek kasa için sonsuza dek ücretsiz. Bugün indirin.",
    "cta.btn": "Başlayın",
    "foot.tagline": "Ücretsiz, çevrimdışı öncelikli satış noktası.",
    "foot.owner": "Universal Till, Task Runner Technology LTD ürünüdür.",
    "foot.rights": "MIT lisansı altında açık kaynak."
  },
  zh: {
    _name: "中文", _dir: "ltr",
    "nav.solutions": "解决方案", "nav.why": "有何不同", "nav.hardware": "硬件",
    "nav.plugins": "插件", "nav.store": "商店",
    "hero.title": "真正属于你的收银系统。",
    "hero.lede": "免费、开源、离线优先——完全断网也能完成一笔交易。可运行在树莓派、旧笔记本或专业触屏终端上。核心永久免费，绝无月费。",
    "hero.cta1": "开始使用", "hero.cta2": "查看源码",
    "hero.note": "MIT 许可 · 单个小程序 · 今天即可用",
    "sol.title": "适合每种店铺的收银台",
    "sol.sub": "一套系统，贴合你真实的销售方式。",
    "sol.grocery.t": "杂货 & 便利店", "sol.grocery.d": "条码扫描、称重商品、快速收款，为繁忙的街角小店提供离线可靠性。",
    "sol.retail.t": "零售 & 精品店", "sol.retail.d": "多规格、商品图片、目录导入，以及带有你自己品牌的整洁小票。",
    "sol.service.t": "服务行业", "sol.service.d": "理发、维修与工作室：快速开单、增值税发票，以及面向企业客户的红字发票。",
    "sol.hospitality.t": "咖啡馆 & 餐厅", "sol.hospitality.d": "挂单、拆分收款、快速重复商品，并通过插件实现厨房就绪流程。",
    "sol.market.t": "集市摊位 & 快闪", "sol.market.d": "手机级预算即可运行，无需信号——收摊、转场，继续营业。",
    "sol.multi.t": "扩展到多台收银", "sol.multi.d": "扫描二维码即可添加第二台收银机；通过你自己的局域网免费同步，无需云端。",
    "why.title": "毫无任何形式的锁定。",
    "why.contracts.t": "无合同、无专有硬件", "why.contracts.d": "运行在你已有的通用硬件上——一整套自建收银台约 70 英镑起。没有多年捆绑。",
    "why.payments.t": "无支付渠道锁定", "why.payments.d": "我们绝不介入你的资金流。任选读卡器与支付渠道——不会有费率蔓延或冻结结算。",
    "why.data.t": "你的数据，随时可导出", "why.data.d": "随时将完整目录与销售导出为 CSV。你的店铺、你的记录——带到任何地方。",
    "why.offline.t": "真正的离线优先", "why.offline.d": "断网绝不会中断交易。一切本地运行；同步是加分项，绝非必需。",
    "hw.title": "运行在你选择的硬件上",
    "hw.lede": "树莓派、旧电脑、迷你主机或专业触屏终端——Universal Till 是一个可在所有设备上运行的小程序。从我们的商店购买成品套件，或自行搭建。",
    "hw.photo": "产品照片",
    "plugins.title": "用插件扩展",
    "plugins.lede": "经签名验证的插件市场：支付、集成、会员、主题等。一键安装；一切在到达你的收银台前都经过审核。",
    "store.title": "获取硬件",
    "store.lede": "即插即用的设备与定制 POS 配件——买组装好的，或购买零件自行搭建。即将上线。",
    "store.cta": "前往商店",
    "cta.title": "按自己的方式开始销售",
    "cta.lede": "单台收银永久免费。今天就下载。",
    "cta.btn": "开始使用",
    "foot.tagline": "免费、离线优先的收银系统。",
    "foot.owner": "Universal Till 是 Task Runner Technology LTD 的产品。",
    "foot.rights": "基于 MIT 许可的开源软件。"
  },
  fa: {
    _name: "فارسی", _dir: "rtl",
    "nav.solutions": "راهکارها", "nav.why": "چه فرقی دارد", "nav.hardware": "سخت‌افزار",
    "nav.plugins": "افزونه‌ها", "nav.store": "فروشگاه",
    "hero.title": "صندوق فروشی که واقعاً مال شماست.",
    "hero.lede": "رایگان، متن‌باز و آفلاین‌محور — یک فروش کامل بدون هیچ اینترنتی انجام می‌شود. روی رزبری‌پای، لپ‌تاپ قدیمی یا ترمینال لمسی حرفه‌ای کار می‌کند. برای هستهٔ اصلی هرگز هزینهٔ ماهانه‌ای نیست.",
    "hero.cta1": "شروع کنید", "hero.cta2": "دیدن کد منبع",
    "hero.note": "مجوز MIT · یک برنامهٔ کوچک · همین امروز کار می‌کند",
    "sol.title": "صندوقی برای هر نوع مغازه",
    "sol.sub": "یک سیستم، متناسب با شیوهٔ واقعی فروش شما.",
    "sol.grocery.t": "خواروبار و سوپرمارکت", "sol.grocery.d": "اسکن بارکد، اقلام وزنی، پرداخت سریع و پایداری آفلاین برای مغازه‌های پرمشغله.",
    "sol.retail.t": "خرده‌فروشی و بوتیک", "sol.retail.d": "تنوع محصول، عکس کالا، ورود کاتالوگ و رسیدهای تمیز با برند خودتان.",
    "sol.service.t": "مشاغل خدماتی", "sol.service.d": "آرایشگاه، تعمیرات و کارگاه‌ها: فروش سریع، فاکتور مالیاتی و برگ بستانکاری برای مشتریان تجاری.",
    "sol.hospitality.t": "کافه و رستوران", "sol.hospitality.d": "سفارش‌های معلق، پرداخت تقسیمی، اقلام پرتکرار سریع و گردش‌کار آمادهٔ آشپزخانه با افزونه‌ها.",
    "sol.market.t": "بساط بازار و دوره‌گرد", "sol.market.d": "با بودجه‌ای در حد یک گوشی و بدون نیاز به سیگنال کار می‌کند — جمع کنید، جابه‌جا شوید و به فروش ادامه دهید.",
    "sol.multi.t": "رشد به چند صندوق", "sol.multi.d": "با اسکن یک کد QR صندوق دوم را اضافه کنید؛ روی شبکهٔ محلی خودتان رایگان همگام می‌شوند، بدون نیاز به ابر.",
    "why.title": "هیچ نوع وابستگی و قفلی نیست.",
    "why.contracts.t": "بدون قرارداد یا سخت‌افزار اختصاصی", "why.contracts.d": "روی سخت‌افزار معمولی که همین حالا دارید کار می‌کند — یک صندوق کامل خودساز از حدود ۷۰ پوند. بدون قرارداد چندساله.",
    "why.payments.t": "بدون وابستگی به درگاه پرداخت", "why.payments.d": "ما هرگز در جریان پول شما نیستیم. هر کارت‌خوان و هر درگاهی را به کار ببرید — نه افزایش کارمزد، نه مسدودی تسویه.",
    "why.data.t": "داده‌های شما، همیشه قابل برون‌بری", "why.data.d": "کاتالوگ و فروش کامل را هر وقت خواستید به CSV بگیرید. مغازهٔ شما، سوابق شما — هر جا خواستید ببرید.",
    "why.offline.t": "به‌راستی آفلاین‌محور", "why.offline.d": "قطع اینترنت هرگز فروش را متوقف نمی‌کند. همه‌چیز محلی کار می‌کند؛ همگام‌سازی یک امتیاز است، نه یک الزام.",
    "hw.title": "روی سخت‌افزار دلخواه شما اجرا می‌شود",
    "hw.lede": "رزبری‌پای، رایانهٔ قدیمی، مینی‌پی‌سی یا ترمینال لمسی — Universal Till یک برنامهٔ کوچک است که روی همهٔ آن‌ها اجرا می‌شود. کیت آمادهٔ ما را بخرید یا خودتان بسازید.",
    "hw.photo": "عکس محصول",
    "plugins.title": "با افزونه‌ها گسترش دهید",
    "plugins.lede": "بازار افزونهٔ امضاشده و تأییدشده: پرداخت، یکپارچه‌سازی، وفاداری، پوسته و بیشتر. با یک کلیک نصب کنید؛ همه‌چیز پیش از رسیدن به صندوق شما بررسی می‌شود.",
    "store.title": "سخت‌افزار را تهیه کنید",
    "store.lede": "دستگاه‌های آمادهٔ کار و قطعات برای POS سفارشی — مونتاژشده بخرید یا قطعات را برای ساخت خودتان. به‌زودی.",
    "store.cta": "به فروشگاه بروید",
    "cta.title": "با قواعد خودتان فروش را آغاز کنید",
    "cta.lede": "برای یک صندوق، برای همیشه رایگان. همین امروز دانلود کنید.",
    "cta.btn": "شروع کنید",
    "foot.tagline": "صندوق فروش رایگان و آفلاین‌محور.",
    "foot.owner": "Universal Till محصولی از Task Runner Technology LTD است.",
    "foot.rights": "متن‌باز تحت مجوز MIT."
  }
};

(function () {
  const supported = Object.keys(I18N);
  function pick() {
    const saved = localStorage.getItem("ut_lang");
    if (saved && supported.includes(saved)) return saved;
    const nav = (navigator.language || "en").slice(0, 2);
    return supported.includes(nav) ? nav : "en";
  }
  function apply(lang) {
    const dict = I18N[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = dict._dir;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      const v = dict[el.getAttribute("data-i18n")];
      if (v != null) el.textContent = v;
    });
    document.querySelectorAll(".lang-switch button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.lang === lang);
    });
    localStorage.setItem("ut_lang", lang);
  }
  function buildSwitcher() {
    const host = document.querySelector(".lang-switch");
    if (!host) return;
    supported.forEach(function (lang) {
      const b = document.createElement("button");
      b.dataset.lang = lang;
      b.textContent = I18N[lang]._name;
      b.addEventListener("click", function () { apply(lang); });
      host.appendChild(b);
    });
  }
  document.addEventListener("DOMContentLoaded", function () {
    buildSwitcher();
    apply(pick());
  });
})();
