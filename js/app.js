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

  /* ---------------- shared chrome ---------------- */
  function renderChrome() {
    const y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
    const fc = $("#footerCats");
    if (fc)
      fc.innerHTML = DATA.categories
        .map((c) => `<li><a href="category.html?cat=${encodeURIComponent(c.id)}">${esc(c.name)}</a></li>`)
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
          hi.alt = c.name;
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
      const img = c.image
        ? `<img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy"/>`
        : `<div class="cat-card-noimg">${esc(c.nameEn || c.name)}</div>`;
      const points = (c.techPoints || []).map((p) => `<li>${esc(p)}</li>`).join("");
      return `<a class="cat-card" href="category.html?cat=${encodeURIComponent(c.id)}">
        <div class="cat-card-media">${img}<span class="cat-card-count">${c.products.length} 款机型</span></div>
        <div class="cat-card-body">
          <div class="cat-card-title">${esc(c.name)}<span class="cat-card-en">${esc(c.nameEn || "")}</span></div>
          <p class="cat-card-tech">${esc(c.tech || "")}</p>
          <ul class="cat-card-points">${points}</ul>
          <span class="cat-card-link">查看机型 →</span>
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
            const key = (c.name + " " + (c.nameEn || "") + " " + (c.tech || "") + " " + (c.techPoints || []).join(" ")).toLowerCase();
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
      : `<div class="card-noimg">${esc(category ? category.name : "")}</div>`;
    const feat = (p.feature || "").split("\n")[0];
    const key = category.id + "||" + p.model;
    const headSpecs = (p.specs || []).slice(0, 3)
      .map((s) => `<div class="spec"><span>${esc(s.label.split("\n")[0])}</span><b>${esc(s.value)}</b></div>`)
      .join("");
    return `<article class="card" data-model="${esc(p.model)}" data-key="${esc(key)}">
      <div class="card-media">${img}
        <button class="card-compare" data-key="${esc(key)}" aria-pressed="false" title="加入对比">＋ 对比</button>
      </div>
      <div class="card-body">
        <div class="card-cat">${esc(category.name)}</div>
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
    if (crumb) crumb.textContent = currentCat.name;
    document.title = currentCat.name + " · 耗材二部官网";
    const ce = $("#catHeroEn");
    if (ce) ce.textContent = currentCat.nameEn || "";
    const cn = $("#catHeroName");
    if (cn) cn.textContent = currentCat.name;
    const ct = $("#catHeroTech");
    if (ct) ct.textContent = currentCat.tech || "";
    const cc = $("#catHeroCount");
    if (cc) cc.textContent = currentCat.products.length + " 款机型";
    const chi = $("#catHeroImg");
    if (chi) {
      if (currentCat.image) { chi.src = currentCat.image; chi.alt = currentCat.name; }
      else chi.style.display = "none";
    }
    const pts = $("#catHeroPoints");
    if (pts) pts.innerHTML = (currentCat.techPoints || []).map((p) => `<li>${esc(p)}</li>`).join("");

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
            const key = (p.model + " " + (p.feature || "") + " " + p.specs.map((s) => s.label + " " + s.value).join(" ")).toLowerCase();
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
      : `<div class="detail-noimg">${esc(category.name)}</div>`;
    const specs = (p.specs || [])
      .map((s) => `<tr><th>${esc(s.label)}</th><td>${esc(s.value)}</td></tr>`)
      .join("");
    const feature = (p.feature || "").split("\n").filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join("");
    body.innerHTML = `
      <div class="detail-media">${img}</div>
      <div class="detail-info">
        <div class="detail-cat">${esc(category.name)} · ${esc(category.nameEn || "")}</div>
        <h2 id="detailTitle">${esc(p.model)}</h2>
        <div class="detail-feature">${feature}</div>
        <h4 class="detail-h">技术参数</h4>
        <table class="detail-table"><tbody>${specs}</tbody></table>
      </div>`;
    showModal("#detailModal");
  }

  /* ---------------- compare ---------------- */
  function toggleCompare(key) {
    if (compareSet.has(key)) compareSet.delete(key);
    else {
      if (compareSet.size >= 3) { alert("最多对比 3 款机型"); return; }
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
      b.textContent = on ? "✓ 已选" : "＋ 对比";
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
    if (compareSet.size < 2) { alert("请至少选择 2 款机型进行对比"); return; }
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
        if (!labelMap.has(s.label)) labelMap.set(s.label, s.label.split("\n")[0]);
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
      <h2 id="compareTitle">机型参数对比</h2>
      <div class="compare-scroll">
        <table class="compare-table">
          <thead><tr><th></th>${items
            .map(
              ({ c, p }) => `<th><img src="${p.image ? esc(p.image) : ""}" alt="" onerror="this.style.display='none'"/><span>${esc(p.model)}</span><small>${esc(c.name)}</small></th>`
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
    renderChrome();
    initHome();
    initCategory();
    initModals();
    initMenu();
  });
})();
