<script>
(() => {
  // ڕێکخستنە شێواوەکان
  const _c = JSON.parse(
    atob("eyJyIjoxNDcwLCJtaW4iOjIwMDAsIm1heCI6NTAwMH0=")
    // {"r":1470,"min":2000,"max":5000}
  );

  const EXCHANGE_RATE = _c.r;
  const MIN_MARKUP = _c.min;
  const MAX_MARKUP = _c.max;

  // فەنکشنی هەژمارکردنی نرخ
  function calculatePriceInIQD(priceUSD) {
    const baseIQD = priceUSD * EXCHANGE_RATE;

    // هەڵبژاردنی قازانج بەپێی نرخ
    let markup;
    if (priceUSD <= 20) {
      markup = MIN_MARKUP;        // بۆ یارییە هەرزانەکان
    } else if (priceUSD >= 60) {
      markup = MAX_MARKUP;        // بۆ یارییە گرانەکان
    } else {
      // نێوانیان: قازانج بەپێی ڕێژەی نرخی یاری
      const ratio = (priceUSD - 20) / (60 - 20); // ٠ بۆ ١
      markup = MIN_MARKUP + ratio * (MAX_MARKUP - MIN_MARKUP);
    }

    return Math.round(baseIQD + markup);
  }

  let cfg = {
    rate: Number(localStorage.getItem("rate")) || 1470,
    markup: Number(localStorage.getItem("markup")) || 0,
    wa: String(localStorage.getItem("wa") || "9647700000000")
  };

  let lang = localStorage.getItem("lang") || "ku";
  let all = [], view = [], shown = 0;
  const PAGE = 900;
  const state = { q: "", type: "all", plat: "all", sort: "az" };
  let cart = [];

  /* ---------- i18n ---------- */
  const T = {
    ku: {
      results: n => `${fmt(n)} بەرهەم`,
      more: "زیاتر پیشان بدە",
      add: "زیادکردن بۆ سەبەتە",
      added: "زیادکرا ✓",
      order: "داواکاری ڕاستەوخۆ لە واتساپ",
      all: "هەموو",
      cartEmpty: "سەبەتەکەت بەتاڵە",
      sorts: { az: "ڕیزکردن: پیتی A-Z", low: "نرخ: کەمترین", high: "نرخ: زۆرترین", new: "نوێترین" },
      types: { Games: "گەیم", Software: "پرۆگرام", Subscriptions: "سەبسکرایبشن", DLC: "DLC", "Virtual Currency": "دراوی ناو گەیم" },
      waOne: (t, p) => `سڵاو Red Zone Store 👋\nدەمەوێت ئەمە بکڕم:\n\n🎮 ${t}\n💵 ${p} دینار\n\nتکایە زانیاریم بدەنێ.`,
      waMany: (lines, tot) => `سڵاو Red Zone Store 👋\nداواکاریەکەم:\n\n${lines}\n\nکۆی گشتی: ${tot} دینار\nتکایە پەیوەندیم پێوە بکەن.`
    },
    en: {
      results: n => `${fmt(n)} products`,
      more: "Show more",
      add: "Add to cart",
      added: "Added ✓",
      order: "Order now on WhatsApp",
      all: "All",
      cartEmpty: "Your cart is empty",
      sorts: { az: "Sort: A-Z", low: "Price: low to high", high: "Price: high to low", new: "Newest" },
      types: { Games: "Games", Software: "Software", Subscriptions: "Subscriptions", DLC: "DLC", "Virtual Currency": "In-game currency" },
      waOne: (t, p) => `Hello Red Zone Store 👋\nI would like to buy:\n\n🎮 ${t}\n💵 ${p} IQD\n\nPlease send me the details.`,
      waMany: (lines, tot) => `Hello Red Zone Store 👋\nMy order:\n\n${lines}\n\nTotal: ${tot} IQD\nPlease get back to me.`
    }
  };
  const t = () => T[lang];

  const fmt = n => Number(n).toLocaleString("en-US");
  const price = usd => Math.ceil((usd * cfg.rate * (1 + cfg.markup / 100)) / 250) * 250;
  const waLink = msg => `https://wa.me/${cfg.wa}?text=${encodeURIComponent(msg)}`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const $ = s => document.querySelector(s);
  const grid = $("#grid");

  /* ---------- language ---------- */
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ku" ? "rtl" : "ltr";
    document.querySelectorAll("[data-ku]").forEach(el => {
      const val = el.dataset[lang];
      if (val === undefined) return;
      if (el.tagName === "INPUT") el.placeholder = val; else el.textContent = val;
    });
    $("#langBtn").textContent = lang === "ku" ? "EN" : "KU";
    buildSort(); buildChips(); if (all.length) refresh(); renderCart();
  }

  /* ---------- filters ---------- */
  const PLATFORMS = ["Steam", "Xbox", "Game Pass", "PlayStation", "Epic", "Ubisoft", "EA", "Nintendo", "Rockstar", "GOG", "Battle.net"];

  function buildChips() {
    const types = ["all", "Games", "Software", "Subscriptions", "DLC", "Virtual Currency"];
    $("#typeChips").innerHTML = types.map(x =>
      `<button class="chip${state.type === x ? " on" : ""}" data-type="${esc(x)}">${x === "all" ? t().all : esc(t().types[x] || x)}</button>`).join("");
    $("#platChips").innerHTML = ["all", ...PLATFORMS].map(x =>
      `<button class="chip${state.plat === x ? " on" : ""}" data-plat="${esc(x)}">${x === "all" ? t().all : esc(x)}</button>`).join("");
  }

  function buildSort() {
    const s = $("#sort");
    s.innerHTML = Object.entries(t().sorts).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
    s.value = state.sort;
  }

  function compute() {
    const q = state.q.trim().toLowerCase();
    view = all.filter(g => {
      if (state.type !== "all" && g.type !== state.type) return false;
      if (state.plat !== "all") {
        const p = g.platforms || [];
        const match = state.plat === "PlayStation" ? p.some(x => x === "PlayStation" || x === "PSN")
          : state.plat === "EA" ? p.some(x => x === "EA" || x === "Origin") : p.includes(state.plat);
        if (!match) return false;
      }
      if (q && !g.title.toLowerCase().includes(q) && !(g.genres || []).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
    const s = state.sort;
    view.sort((a, b) =>
      s === "low" ? a.usd - b.usd :
      s === "high" ? b.usd - a.usd :
      s === "new" ? (b.new === a.new ? a.title.localeCompare(b.title) : (b.new ? 1 : -1)) :
      a.title.localeCompare(b.title));
    shown = 0;
  }

  function cardHTML(g, i) {
    const badge = g.new ? `<span class="badge new">${lang === "ku" ? "نوێ" : "NEW"}</span>`
      : g.platforms && g.platforms[0] ? `<span class="badge">${esc(g.platforms[0])}</span>` : "";
    return `<article class="card" data-i="${i}">
      <div class="thumb">${badge}<img loading="lazy" src="${esc(g.img)}" alt="${esc(g.title)}" onerror="this.style.opacity=.15"></div>
      <div class="card-body">
        <h3 class="card-title">${esc(g.title)}</h3>
        <div class="price-row"><span class="price">${fmt(price(g.usd))}</span><span class="price-cur">IQD</span></div>
        <button class="add-btn" data-add="${i}">${t().add}</button>
      </div></article>`;
  }

  // ✅ UPDATED: show ALL games at once
  function render() {
    if (!view.length && all.length) {
      grid.innerHTML = "";
      $("#empty").hidden = false;
      $("#moreBtn").hidden = true;
      $("#resultCount").textContent = t().results(0);
      return;
    }
    $("#empty").hidden = true;

    if (shown === 0) {
      // Render everything in one go
      grid.innerHTML = view.map((g, i) => cardHTML(g, i)).join("");
      shown = view.length;
    }

    $("#resultCount").textContent = t().results(view.length);
    $("#moreBtn").hidden = true; // always hide "Show more"
  }

  function refresh() { compute(); render(); }

  /* ---------- modal ---------- */
  function openModal(i) {
    const g = view[i]; if (!g) return;
    const p = price(g.usd);
    const tags = [...(g.platforms || []), ...(g.genres || [])].slice(0, 6)
      .map(x => `<span class="tag">${esc(x)}</span>`).join("");
    $("#modalBody").innerHTML = `
      <div><img src="${esc(g.img)}" alt="${esc(g.title)}"></div>
      <div>
        <h2>${esc(g.title)}</h2>
        <div class="tags">${tags}</div>
        <div class="modal-price">${fmt(p)} <span class="price-cur">IQD</span></div>
        ${g.desc ? `<p class="modal-desc">${esc(g.desc)}</p>` : ""}
        <div class="modal-actions">
          <a class="wa-btn" target="_blank" rel="noopener" href="${waLink(t().waOne(g.title, fmt(p)))}">${t().order}</a>
          <button class="add-btn" data-add="${i}">${t().add}</button>
        </div>
      </div>`;
    $("#modal").hidden = false;
  }

  /* ---------- cart ---------- */
  function renderCart() {
    const box = $("#cartItems");
    if (!cart.length) {
      box.innerHTML = `<p class="cart-empty">${t().cartEmpty}</p>`;
      $("#cartTotal").textContent = "0 IQD";
      $("#cartWa").href = waLink(lang === "ku" ? "سڵاو Red Zone Store 👋" : "Hello Red Zone Store 👋");
    } else {
      box.innerHTML = cart.map((c, i) => `<div class="cart-line">
        <img src="${esc(c.img)}" alt=""><span class="t">${esc(c.title)}</span>
        <span class="p">${fmt(price(c.usd))}</span>
        <button class="rm" data-rm="${i}" aria-label="remove">✕</button></div>`).join("");
      const total = cart.reduce((s, c) => s + price(c.usd), 0);
      $("#cartTotal").textContent = fmt(total) + " IQD";
      const lines = cart.map(c => `• ${c.title} — ${fmt(price(c.usd))}`).join("\n");
      $("#cartWa").href = waLink(t().waMany(lines, fmt(total)));
    }
    $("#cartCount").textContent = cart.length;
  }

  function addToCart(i, btn) {
    const g = view[i]; if (!g) return;
    if (!cart.some(c => c.title === g.title)) cart.push({ title: g.title, usd: g.usd, img: g.img });
    renderCart();
    if (btn) { const old = btn.textContent; btn.textContent = t().added; setTimeout(() => { btn.textContent = old; }, 1200); }
  }

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { e.stopPropagation(); addToCart(+add.dataset.add, add); return; }
    const card = e.target.closest(".card");
    if (card) { openModal(+card.dataset.i); return; }
    const chipT = e.target.closest("[data-type]");
    if (chipT) { state.type = chipT.dataset.type; buildChips(); refresh(); return; }
    const chipP = e.target.closest("[data-plat]");
    if (chipP) { state.plat = chipP.dataset.plat; buildChips(); refresh(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) { cart.splice(+rm.dataset.rm, 1); renderCart(); return; }
    if (e.target.closest("[data-close]")) $("#modal").hidden = true;
    if (e.target.closest("[data-cart-close]")) $("#drawer").hidden = true;
    if (e.target.closest("[data-admin-close]")) $("#admin").hidden = true;
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { $("#modal").hidden = true; $("#drawer").hidden = true; $("#admin").hidden = true; } });

  // "Show more" button is now unused, but kept for safety
  $("#moreBtn").addEventListener("click", render);
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; refresh(); });
  $("#cartBtn").addEventListener("click", () => { $("#drawer").hidden = false; });
  $("#langBtn").addEventListener("click", () => { lang = lang === "ku" ? "en" : "ku"; localStorage.setItem("lang", lang); applyLang(); });

  let deb;
  $("#search").addEventListener("input", e => { clearTimeout(deb); deb = setTimeout(() => { state.q = e.target.value; refresh(); }, 180); });

  $("#adminBtn").addEventListener("click", () => {
    $("#rateInput").value = cfg.rate; $("#markupInput").value = cfg.markup; $("#waInput").value = cfg.wa;
    $("#admin").hidden = false;
  });
  $("#saveAdmin").addEventListener("click", () => {
    cfg.rate = Number($("#rateInput").value) || cfg.rate;
    cfg.markup = Number($("#markupInput").value) || 0;
    cfg.wa = ($("#waInput").value || cfg.wa).replace(/[^0-9]/g, "");
    localStorage.setItem("rate", cfg.rate); localStorage.setItem("markup", cfg.markup); localStorage.setItem("wa", cfg.wa);
    $("#admin").hidden = true;
    $("#waFooter").href = waLink("Red Zone Store");
    $("#waFooter").textContent = "WhatsApp: +" + cfg.wa;
    shown = 0; render(); renderCart();
  });

  /* ---------- boot ---------- */
  $("#year").textContent = new Date().getFullYear();
  $("#waFooter").href = waLink(lang === "ku" ? "سڵاو Red Zone Store 👋" : "Hello Red Zone Store 👋");

  // 👇 Replace fetch with embedded catalog
  // Paste your catalog.json content inside the array below:
  all = [
    // Example item (replace with your real catalog):
    {
      title: "Example Game",
      usd: 59.99,
      type: "Games",
      platforms: ["Steam"],
      genres: ["Action"],
      img: "https://via.placeholder.com/300x400?text=Game",
      desc: "An example game description.",
      new: true
    }
    // ... paste all your catalog.json items here ...
  ];

  $("#statCount").textContent = fmt(all.length) + "+";
  applyLang();
})();
</script>
