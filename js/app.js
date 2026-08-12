(function () {
  "use strict";
  // 优先使用后台(admin)在本地保存的覆盖数据，否则用默认 data.js
  let DATA = window.PRODUCT_DATA;
  try {
    const raw = localStorage.getItem("cb2_admin_data_v1");
    if (raw) DATA = Object.assign({}, window.PRODUCT_DATA, JSON.parse(raw));
  } catch (e) {}
  if (!DATA) DATA = { brand: { name: "耗材二部" }, categories: [] };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const totalCount = () => DATA.categories.reduce((a, c) => a + c.products.length, 0);
  const productImage = (p) => (p && p.image ? p.image : null);

  /* ---------------- i18n ---------------- */
  let currentLang = "zh";
  try {
    currentLang = localStorage.getItem("cb2_lang") || "zh";
  } catch (e) {}
  if (!window.LANG) window.LANG = [{ code: "zh", label: "中文" }];

  function t(key) {
    const dict = (window.UI && window.UI[currentLang]) || (window.UI && window.UI.zh) || {};
    return dict[key] != null ? dict[key] : (window.UI && window.UI.zh && window.UI.zh[key] != null ? window.UI.zh[key] : key);
  }
  function enOfLabel(label) {
    const lines = String(label).split("\n");
    const last = lines[lines.length - 1];
    if (/[A-Za-z]/.test(last)) return last.trim();
    const eng = String(label).match(/[A-Za-z][A-Za-z \/\-]*[A-Za-z]/g);
    return eng ? eng.join(" ") : label;
  }
  function tlabel(label, lang) {
    if (!label) return "";
    if (lang === "zh") return label;
    if (lang === "en") return enOfLabel(label);
    const tr = (window.SPEC_LABELS && window.SPEC_LABELS[label]) || null;
    if (tr && tr[lang]) return tr[lang];
    return enOfLabel(label);
  }
  function tcat(c, lang) {
    if (lang === "zh") return c.name;
    if (lang === "en") return c.nameEn || c.name;
    return (c.i18n && c.i18n[lang] && c.i18n[lang].name) || c.nameEn || c.name;
  }
  function ttech(c, lang) {
    if (lang === "zh") return c.tech || "";
    return (c.i18n && c.i18n[lang] && c.i18n[lang].tech) || c.tech || "";
  }
  function tpoints(c, lang) {
    const arr = c.techPoints || [];
    if (lang === "zh") return arr;
    const ti = c.i18n && c.i18n[lang];
    return ti && ti.techPoints && ti.techPoints.length === arr.length ? ti.techPoints : arr;
  }
  function tfeature(p, lang) {
    const f = p.feature || "";
    if (lang === "zh") return f.split("\n")[0] || "";
    const fi = p.i18n && p.i18n[lang];
    if (fi && fi.feature) return fi.feature;
    const lines = f.split("\n");
    if (lang === "en" && lines.length > 1 && /[A-Za-z]/.test(lines[1])) return lines[1];
    return f.split("\n")[0] || "";
  }

  function applyStaticI18n() {
    $$("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    $$("[data-i18n-ph]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-ph"));
    });
  }
  function setLang(lang) {
    currentLang = lang;
    try {
      localStorage.setItem("cb2_lang", lang);
    } catch (e) {}
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
    applyStaticI18n();
    renderChrome();
    initHome();
    initCategory();
    const sel = $("#langSelect");
    if (sel) sel.value = lang;
  }
  function initLang() {
    const sel = $("#langSelect");
    if (!sel) return;
    if (!sel.options.length) {
      window.LANG.forEach((l) => {
        const o = document.createElement("option");
        o.value = l.code;
        o.textContent = l.label;
        sel.appendChild(o);
      });
    }
    sel.value = currentLang;
    sel.addEventListener("change", () => setLang(sel.value));
  }

  /* ---------------- shared chrome ---------------- */
  function renderChrome() {
    const y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
    const fc = $("#footerCats");
    if (fc)
      fc.innerHTML = DATA.categories
        .map((c) => `<li><a href="category.html?cat=${encodeURIComponent(c.id)}">${esc(tcat(c, currentLang))}</a></li>`)
        .join("");
    const sp = $("#statProducts");
    if (sp) sp.textContent = totalCount();
    const sc = $("#statCats");
    if (sc) sc.textContent = DATA.categories.length;
    const hi = $("#heroImg");
    if (hi) {
      for (const c of DATA.categories) {
        if (c.image) {
          hi.src = c.image;
          hi.alt = tcat(c, currentLang);
          break;
        }
      }
    }
  }

  /* ---------------- HOME: category technology cards ---------------- */
  function initHome() {
    const grid = $("#categoryGrid");
    if (!grid) return;
    const cats = DATA.categories;

    const cardHTML = (c) => {
      const enSub = currentLang === "zh" ? (c.nameEn || "") : (currentLang === "en" ? "" : c.name);
      const img = c.image
        ? `<img src="${esc(c.image)}" alt="${esc(tcat(c, currentLang))}" loading="lazy"/>`
        : `<div class="cat-card-noimg">${esc(tcat(c, currentLang))}</div>`;
      const points = tpoints(c, currentLang).map((p) => `<li>${esc(p)}</li>`).join("");
      return `<a class="cat-card" href="category.html?cat=${encodeURIComponent(c.id)}">
        <div class="cat-card-media">${img}<span class="cat-card-count">${c.products.length} ${esc(t("models.unit"))}</span></div>
        <div class="cat-card-body">
          <div class="cat-card-title">${esc(tcat(c, currentLang))}${enSub ? `<span class="cat-card-en">${esc(enSub)}</span>` : ""}</div>
          <p class="cat-card-tech">${esc(ttech(c, currentLang))}</p>
          <ul class="cat-card-points">${points}</ul>
          <span class="cat-card-link">${esc(t("view.models"))}</span>
        </div>
      </a>`;
    };

    const render = (list) => {
      grid.innerHTML = list.map(cardHTML).join("");
      const empty = $("#catEmpty");
      if (empty) empty.hidden = list.length > 0;
    };
    render(cats);

    const search = $("#catSearch");
    if (search) {
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        if (!q) return render(cats);
        render(
          cats.filter((c) => {
            const key = (tcat(c, currentLang) + " " + (c.nameEn || "") + " " + ttech(c, currentLang) + " " + tpoints(c, currentLang).join(" ")).toLowerCase();
            return key.includes(q);
          })
        );
      });
      const reset = $("#catReset");
      if (reset) reset.addEventListener("click", () => { search.value = ""; render(cats); });
    }
  }

  /* ---------------- CATEGORY PAGE: models ---------------- */
  let currentCat = null;
  const compareSet = new Set();

  function cardHTML(p, category) {
    const img = productImage(p)
      ? `<img src="${esc(p.image)}" alt="${esc(p.model)}" loading="lazy"/>`
      : `<div class="card-noimg">${esc(tcat(category, currentLang))}</div>`;
    const feat = tfeature(p, currentLang).split("\n")[0];
    const key = category.id + "||" + p.model;
    const headSpecs = (p.specs || []).slice(0, 3)
      .map((s) => `<div class="spec"><span>${esc(tlabel(s.label, currentLang))}</span><b>${esc(s.value)}</b></div>`)
      .join("");
    return `<article class="card" data-model="${esc(p.model)}" data-key="${esc(key)}">
      <div class="card-media">${img}
        <button class="card-compare" data-key="${esc(key)}" aria-pressed="false" title="${esc(t("card.compare"))}">${esc(t("card.compare"))}</button>
      </div>
      <div class="card-body">
        <div class="card-cat">${esc(tcat(category, currentLang))}</div>
        <h3 class="card-model">${esc(p.model)}</h3>
        <p class="card-feat">${esc(feat)}</p>
        <div class="card-specs">${headSpecs}</div>
      </div>
    </article>`;
  }

  function initCategory() {
    const grid = $("#productGrid");
    if (!grid) return;
    const params = new URLSearchParams(location.search);
    const id = params.get("cat");
    currentCat = DATA.categories.find((c) => c.id === id) || DATA.categories[0];

    const crumb = $("#crumbCat");
    if (crumb) crumb.textContent = tcat(currentCat, currentLang);
    document.title = tcat(currentCat, currentLang) + " · 耗材二部官网";
    const ce = $("#catHeroEn");
    if (ce) ce.textContent = currentLang === "en" ? "" : (currentCat.nameEn || tcat(currentCat, currentLang));
    const cn = $("#catHeroName");
    if (cn) cn.textContent = tcat(currentCat, currentLang);
    const ct = $("#catHeroTech");
    if (ct) ct.textContent = ttech(currentCat, currentLang);
    const cc = $("#catHeroCount");
    if (cc) cc.textContent = currentCat.products.length + " " + t("models.unit");
    const chi = $("#catHeroImg");
    if (chi) {
      if (currentCat.image) { chi.src = currentCat.image; chi.alt = tcat(currentCat, currentLang); }
      else chi.style.display = "none";
    }
    const pts = $("#catHeroPoints");
    if (pts) pts.innerHTML = tpoints(currentCat, currentLang).map((p) => `<li>${esc(p)}</li>`).join("");

    const render = (list) => {
      grid.innerHTML = list.map((p) => cardHTML(p, currentCat)).join("");
      const empty = $("#modelEmpty");
      if (empty) empty.hidden = list.length > 0;
      syncCompareButtons();
    };
    render(currentCat.products);

    const search = $("#modelSearch");
    if (search) {
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        if (!q) return render(currentCat.products);
        render(
          currentCat.products.filter((p) => {
            const key = (p.model + " " + tfeature(p, currentLang) + " " + (p.specs || []).map((s) => tlabel(s.label, currentLang) + " " + s.value).join(" ")).toLowerCase();
            return key.includes(q);
          })
        );
      });
      const reset = $("#modelReset");
      if (reset) reset.addEventListener("click", () => { search.value = ""; render(currentCat.products); });
    }

    grid.addEventListener("click", (e) => {
      const cmp = e.target.closest(".card-compare");
      if (cmp) {
        e.preventDefault();
        e.stopPropagation();
        toggleCompare(cmp.dataset.key);
        return;
      }
      const card = e.target.closest(".card");
      if (card) openDetail(card.dataset.model, currentCat);
    });
  }

  /* ---------------- detail modal ---------------- */
  function openDetail(model, category) {
    const p = category.products.find((x) => x.model === model);
    if (!p) return;
    const body = $("#detailBody");
    const img = productImage(p)
      ? `<img src="${esc(p.image)}" alt="${esc(p.model)}"/>`
      : `<div class="detail-noimg">${esc(tcat(category, currentLang))}</div>`;
    const specs = (p.specs || [])
      .map((s) => `<tr><th>${esc(tlabel(s.label, currentLang))}</th><td>${esc(s.value)}</td></tr>`)
      .join("");
    const feature = tfeature(p, currentLang).split("\n").filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join("");
    body.innerHTML = `
      <div class="detail-media">${img}</div>
      <div class="detail-info">
        <div class="detail-cat">${esc(tcat(category, currentLang))}${(category.nameEn && category.nameEn !== tcat(category, currentLang)) ? " · " + esc(category.nameEn) : ""}</div>
        <h2 id="detailTitle">${esc(p.model)}</h2>
        <div class="detail-feature">${feature}</div>
        <h4 class="detail-h">${esc(t("detail.specTitle"))}</h4>
        <table class="detail-table"><tbody>${specs}</tbody></table>
      </div>`;
    showModal("#detailModal");
  }

  /* ---------------- compare ---------------- */
  function toggleCompare(key) {
    if (compareSet.has(key)) compareSet.delete(key);
    else {
      if (compareSet.size >= 3) { alert(t("alert.max3")); return; }
      compareSet.add(key);
    }
    renderCompareTray();
    syncCompareButtons();
  }

  function syncCompareButtons() {
    $$(".card-compare").forEach((b) => {
      const on = compareSet.has(b.dataset.key);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.textContent = on ? t("card.compared") : t("card.compare");
    });
  }

  function renderCompareTray() {
    const tray = $("#compareTray");
    const slots = $("#compareSlots");
    const cnt = $("#compareCount");
    if (!tray) return;
    cnt.textContent = compareSet.size;
    if (compareSet.size === 0) {
      tray.hidden = true;
      slots.innerHTML = "";
      return;
    }
    tray.hidden = false;
    const items = [];
    DATA.categories.forEach((c) =>
      c.products.forEach((p) => {
        const k = c.id + "||" + p.model;
        if (compareSet.has(k)) items.push({ c, p });
      })
    );
    slots.innerHTML = items
      .map(
        ({ c, p }) => `
      <div class="slot">
        <button class="slot-x" data-key="${esc(c.id + "||" + p.model)}" aria-label="移除">×</button>
        <img src="${p.image ? esc(p.image) : ""}" alt="" onerror="this.style.display='none'"/>
        <span>${esc(p.model)}</span>
      </div>`
      )
      .join("");
    $$(".slot-x", slots).forEach((b) => b.addEventListener("click", () => toggleCompare(b.dataset.key)));
  }

  function openCompareModal() {
    if (compareSet.size < 2) { alert(t("alert.min2")); return; }
    const items = [];
    DATA.categories.forEach((c) =>
      c.products.forEach((p) => {
        const k = c.id + "||" + p.model;
        if (compareSet.has(k)) items.push({ c, p });
      })
    );
    const labelMap = new Map();
    items.forEach(({ p }) =>
      (p.specs || []).forEach((s) => {
        if (!labelMap.has(s.label)) labelMap.set(s.label, tlabel(s.label, currentLang));
      })
    );
    const labels = Array.from(labelMap.keys());
    const rows = labels
      .map((label) => {
        const cells = items
          .map(({ p }) => {
            const sp = (p.specs || []).find((s) => s.label === label);
            return `<td>${sp ? esc(sp.value) : '<span class="na">—</span>'}</td>`;
          })
          .join("");
        return `<tr><th>${esc(labelMap.get(label))}</th>${cells}</tr>`;
      })
      .join("");
    $("#compareBody").innerHTML = `
      <h2 id="compareTitle">${esc(t("compare.title"))}</h2>
      <div class="compare-scroll">
        <table class="compare-table">
          <thead><tr><th></th>${items
            .map(
              ({ c, p }) => `<th><img src="${p.image ? esc(p.image) : ""}" alt="" onerror="this.style.display='none'"/><span>${esc(p.model)}</span><small>${esc(tcat(c, currentLang))}</small></th>`
            )
            .join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    showModal("#compareModal");
  }

  /* ---------------- modal plumbing ---------------- */
  function showModal(sel) {
    const m = $(sel);
    if (!m) return;
    m.hidden = false;
    document.body.classList.add("no-scroll");
  }
  function hideModal(m) {
    m.hidden = true;
    if (!$$(".modal").some((x) => !x.hidden)) document.body.classList.remove("no-scroll");
  }
  function initModals() {
    $$(".modal").forEach((m) =>
      m.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => hideModal(m)))
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $$(".modal").forEach(hideModal);
    });
    const oc = $("#openCompare");
    if (oc) oc.addEventListener("click", openCompareModal);
    const cc = $("#clearCompare");
    if (cc)
      cc.addEventListener("click", () => {
        compareSet.clear();
        renderCompareTray();
        syncCompareButtons();
      });
  }

  /* ---------------- mobile menu ---------------- */
  function initMenu() {
    const t = $("#menuToggle");
    if (!t) return;
    t.addEventListener("click", () => document.body.classList.toggle("nav-open"));
    $$(".top-nav a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("nav-open")));
  }

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.lang = currentLang === "zh" ? "zh-CN" : currentLang;
    applyStaticI18n();
    renderChrome();
    initHome();
    initCategory();
    initModals();
    initMenu();
    initLang();
  });
})();
