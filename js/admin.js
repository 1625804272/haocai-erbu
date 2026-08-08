(function () {
  "use strict";

  const LS_DATA = "cb2_admin_data_v1";
  const LS_PASS = "cb2_admin_pass";
  const LS_SETTINGS = "cb2_admin_settings";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );

  /* ---------------- state ---------------- */
  let DATA = null;
  let currentSpecs = []; // 当前机型弹窗里的参数
  let loginOk = false;

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveSettings(s) {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  }
  function getPass() {
    return localStorage.getItem(LS_PASS) || "admin";
  }
  function loadData() {
    const raw = localStorage.getItem(LS_DATA);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    // 深拷贝官方默认数据
    return JSON.parse(JSON.stringify(window.PRODUCT_DATA));
  }
  function saveLocal() {
    localStorage.setItem(LS_DATA, JSON.stringify(DATA));
    toast("已保存到本地（官网预览将使用此数据）");
  }

  function toast(msg) {
    const t = $("#adminToast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

  function allProducts() {
    const list = [];
    DATA.categories.forEach((c) =>
      c.products.forEach((p) => list.push({ cat: c, p }))
    );
    return list;
  }

  /* ---------------- login ---------------- */
  function doLogin() {
    const v = $("#loginPass").value;
    if (v === getPass()) {
      loginOk = true;
      $("#loginOverlay").hidden = true;
      $("#adminApp").hidden = false;
      initAdmin();
    } else {
      $("#loginErr").textContent = "密码错误";
    }
  }

  /* ---------------- init ---------------- */
  function ensureIds() {
    // 给缺失 id 的品类/机型补上稳定 id，避免后台编辑/删除因 data-pid 为空而失效
    DATA.categories.forEach((c, ci) => {
      if (!c.id) c.id = "cat_" + ci;
      c.products.forEach((p, pi) => {
        if (!p.id) p.id = c.id + "_p" + pi;
      });
    });
  }

  function initAdmin() {
    DATA = loadData();
    ensureIds();
    populateCatSelects();
    renderProducts();
    renderCategories();
    bindEvents();
    const st = loadSettings();
    if (st.repo) $("#setRepo").value = st.repo;
    if (st.branch) $("#setBranch").value = st.branch;
  }

  function populateCatSelects() {
    const opts = DATA.categories
      .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
      .join("");
    $("#adminCatFilter").innerHTML = `<option value="">全部品类</option>` + opts;
    // 机型弹窗下拉
    $("#pfCat").innerHTML = DATA.categories
      .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`)
      .join("");
  }

  /* ---------------- products ---------------- */
  function renderProducts() {
    const kw = $("#adminSearch").value.trim().toLowerCase();
    const cf = $("#adminCatFilter").value;
    let rows = allProducts();
    if (cf) rows = rows.filter((r) => r.cat.id === cf);
    if (kw) {
      rows = rows.filter((r) => {
        const txt =
          (r.p.model || "") +
          " " +
          (r.p.modelEn || "") +
          " " +
          (r.p.feature || "") +
          " " +
          (r.p.specs || []).map((s) => s.label + s.value).join(" ") +
          " " +
          (r.cat.name || "");
        return txt.toLowerCase().includes(kw);
      });
    }
    const tbody = $("#productTbody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">没有匹配的机型</td></tr>`;
    } else {
      tbody.innerHTML = rows
        .map((r) => {
          const img = r.p.image
            ? `<img src="${esc(r.p.image)}" alt="" class="row-img"/>`
            : `<span class="row-noimg">无图</span>`;
          return `<tr data-pid="${esc(r.p.id)}" data-cid="${esc(r.cat.id)}">
            <td class="col-img">${img}</td>
            <td><strong>${esc(r.p.model)}</strong>${
            r.p.modelEn ? `<br><small>${esc(r.p.modelEn)}</small>` : ""
          }</td>
            <td>${esc(r.cat.name)}</td>
            <td class="col-feature">${esc(r.p.feature || "—")}</td>
            <td class="col-ops">
              <button class="btn btn-ghost btn-sm act-edit">编辑</button>
              <button class="btn btn-danger btn-sm act-del">删除</button>
            </td>
          </tr>`;
        })
        .join("");
    }
    $("#productCount").textContent = `共 ${rows.length} 款`;
  }

  function openProductModal(pid, cid) {
    currentSpecs = [];
    let prod = null,
      cat = null;
    if (pid) {
      const found = allProducts().find((r) => r.p.id === pid);
      prod = found.p;
      cat = found.cat;
    }
    $("#productModalTitle").textContent = prod ? "编辑机型" : "新增机型";
    $("#pfId").value = prod ? prod.id : "";
    $("#pfCat").value = cat ? cat.id : $("#pfCat").value;
    $("#pfModel").value = prod ? prod.model || "" : "";
    $("#pfModelEn").value = prod ? prod.modelEn || "" : "";
    $("#pfTags").value = prod && prod.tags ? prod.tags.join(", ") : "";
    $("#pfFeature").value = prod ? prod.feature || "" : "";
    setImgPreview("#pfImg", "#pfImgPreview", prod ? prod.image : null);
    currentSpecs = prod && prod.specs ? prod.specs.map((s) => ({ ...s })) : [];
    renderSpecRows();
    showModal("productModal");
  }

  function renderSpecRows() {
    const wrap = $("#pfSpecs");
    if (!currentSpecs.length) {
      wrap.innerHTML = `<p class="hint empty-spec">暂无参数，点击「+ 添加参数」。</p>`;
      return;
    }
    wrap.innerHTML = currentSpecs
      .map(
        (s, i) => `<div class="spec-row" data-i="${i}">
        <input type="text" class="spec-label" placeholder="参数名" value="${esc(s.label)}"/>
        <input type="text" class="spec-value" placeholder="参数值" value="${esc(s.value)}"/>
        <button type="button" class="btn btn-ghost btn-sm spec-del">×</button>
      </div>`
      )
      .join("");
  }

  function openCategoryModal(cid) {
    let cat = cid ? DATA.categories.find((c) => c.id === cid) : null;
    $("#categoryModalTitle").textContent = cat ? "编辑品类" : "新增品类";
    $("#cfId").value = cat ? cat.id : "";
    $("#cfName").value = cat ? cat.name || "" : "";
    $("#cfNameEn").value = cat ? cat.nameEn || "" : "";
    $("#cfTech").value = cat ? cat.tech || "" : "";
    $("#cfTechPoints").value =
      cat && cat.techPoints ? cat.techPoints.join("\n") : "";
    setImgPreview("#cfImg", "#cfImgPreview", cat ? cat.image : null);
    showModal("categoryModal");
  }

  function setImgPreview(hiddenSel, previewSel, val) {
    $(hiddenSel).value = val || "";
    const prev = $(previewSel);
    if (val) {
      prev.src = val;
      prev.style.display = "block";
    } else {
      prev.removeAttribute("src");
      prev.style.display = "none";
    }
  }

  function showModal(id) {
    $("#" + id).hidden = false;
  }
  function hideModal(id) {
    $("#" + id).hidden = true;
  }

  /* ---------------- categories ---------------- */
  function renderCategories() {
    const list = $("#categoryList");
    list.innerHTML = DATA.categories
      .map((c) => {
        const img = c.image
          ? `<img src="${esc(c.image)}" alt="" class="cat-edit-img"/>`
          : `<span class="row-noimg">无图</span>`;
        return `<div class="cat-edit-card" data-cid="${esc(c.id)}">
          <div class="cat-edit-imgbox">${img}</div>
          <div class="cat-edit-body">
            <h4>${esc(c.name)} ${c.nameEn ? `<small>${esc(c.nameEn)}</small>` : ""}</h4>
            <p class="cat-edit-tech">${esc(c.tech || "（未填写技术简介）")}</p>
            <p class="cat-edit-count">${c.products.length} 款机型</p>
          </div>
          <div class="cat-edit-ops">
            <button class="btn btn-ghost btn-sm act-cat-edit">编辑</button>
            <button class="btn btn-danger btn-sm act-cat-del">删除</button>
          </div>
        </div>`;
      })
      .join("");
    $("#catCount").textContent = `共 ${DATA.categories.length} 个品类`;
  }

  /* ---------------- events ---------------- */
  function bindEvents() {
    $("#btnLogout").addEventListener("click", () => location.reload());

    // tabs
    $$(".admin-tab").forEach((t) =>
      t.addEventListener("click", () => {
        $$(".admin-tab").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        const tab = t.dataset.tab;
        $$(".admin-panel").forEach((p) => (p.hidden = true));
        $("#tab-" + tab).hidden = false;
      })
    );

    // products
    $("#adminSearch").addEventListener("input", renderProducts);
    $("#adminCatFilter").addEventListener("change", renderProducts);
    $("#btnAddProduct").addEventListener("click", () => openProductModal());
    $("#productTbody").addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (!tr || !tr.dataset.pid) return;
      if (e.target.classList.contains("act-edit"))
        openProductModal(tr.dataset.pid, tr.dataset.cid);
      if (e.target.classList.contains("act-del")) {
        if (confirm("确定删除该机型？")) {
          const cat = DATA.categories.find((c) => c.id === tr.dataset.cid);
          cat.products = cat.products.filter((p) => p.id !== tr.dataset.pid);
          saveLocal();
          renderProducts();
        }
      }
    });

    // product form
    $("#productForm").addEventListener("submit", (e) => {
      e.preventDefault();
      saveProduct();
    });
    $("#pfAddSpec").addEventListener("click", () => {
      currentSpecs.push({ label: "", value: "" });
      renderSpecRows();
    });
    $("#pfSpecs").addEventListener("click", (e) => {
      if (e.target.classList.contains("spec-del")) {
        const i = +e.target.closest(".spec-row").dataset.i;
        currentSpecs.splice(i, 1);
        renderSpecRows();
      }
    });
    $("#pfSpecs").addEventListener("input", (e) => {
      const row = e.target.closest(".spec-row");
      if (!row) return;
      const i = +row.dataset.i;
      if (e.target.classList.contains("spec-label"))
        currentSpecs[i].label = e.target.value;
      if (e.target.classList.contains("spec-value"))
        currentSpecs[i].value = e.target.value;
    });
    bindImgUpload("#pfImgFile", "#pfImg", "#pfImgPreview", "#pfImgClear");

    // categories
    $("#btnAddCategory").addEventListener("click", () => openCategoryModal());
    $("#categoryList").addEventListener("click", (e) => {
      const card = e.target.closest(".cat-edit-card");
      if (!card) return;
      const cid = card.dataset.cid;
      if (e.target.classList.contains("act-cat-edit")) openCategoryModal(cid);
      if (e.target.classList.contains("act-cat-del")) {
        const cat = DATA.categories.find((c) => c.id === cid);
        if (cat.products.length) {
          alert("该品类下还有 " + cat.products.length + " 款机型，请先移走或删除后再删除品类。");
          return;
        }
        if (confirm("确定删除该品类？")) {
          DATA.categories = DATA.categories.filter((c) => c.id !== cid);
          saveLocal();
          populateCatSelects();
          renderCategories();
        }
      }
    });
    $("#categoryForm").addEventListener("submit", (e) => {
      e.preventDefault();
      saveCategory();
    });
    bindImgUpload("#cfImgFile", "#cfImg", "#cfImgPreview", "#cfImgClear");

    // settings
    $("#btnSaveSettings").addEventListener("click", () => {
      const p1 = $("#setPass").value,
        p2 = $("#setPass2").value;
      if (p1 || p2) {
        if (p1.length < 3) return settingsMsg("密码至少 3 位", true);
        if (p1 !== p2) return settingsMsg("两次输入的密码不一致", true);
        localStorage.setItem(LS_PASS, p1);
      }
      const st = loadSettings();
      st.repo = $("#setRepo").value.trim();
      st.branch = $("#setBranch").value.trim() || "main";
      saveSettings(st);
      settingsMsg("设置已保存", false);
    });
    $("#btnReset").addEventListener("click", () => {
      if (confirm("将清空本地所有改动，恢复到官方网站默认数据？")) {
        localStorage.removeItem(LS_DATA);
        DATA = loadData();
        populateCatSelects();
        renderProducts();
        renderCategories();
        toast("已恢复默认数据");
      }
    });

    // modal close buttons
    $$("[data-close]").forEach((b) =>
      b.addEventListener("click", () => hideModal(b.dataset.close))
    );
    $$(".modal").forEach((m) =>
      m.addEventListener("click", (e) => {
        if (e.target === m) m.hidden = true;
      })
    );

    // export
    $("#btnExport").addEventListener("click", exportDataJs);
    // publish
    $("#btnPublish").addEventListener("click", () => {
      const st = loadSettings();
      if (st.repo) $("#pubRepo").value = st.repo;
      if (st.branch) $("#pubBranch").value = st.branch;
      showModal("publishModal");
    });
    $("#publishForm").addEventListener("submit", (e) => {
      e.preventDefault();
      publishToGitHub();
    });
  }

  function settingsMsg(msg, isErr) {
    const el = $("#settingsMsg");
    el.textContent = msg;
    el.className = "settings-msg" + (isErr ? " err" : " ok");
  }

  function bindImgUpload(fileSel, hiddenSel, previewSel, clearSel) {
    $(fileSel).addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => setImgPreview(hiddenSel, previewSel, reader.result);
      reader.readAsDataURL(f);
    });
    $(clearSel).addEventListener("click", () =>
      setImgPreview(hiddenSel, previewSel, null)
    );
  }

  /* ---------------- save ---------------- */
  function saveProduct() {
    const catId = $("#pfCat").value;
    const cat = DATA.categories.find((c) => c.id === catId);
    if (!cat) return;
    const specs = currentSpecs
      .filter((s) => s.label.trim() || s.value.trim())
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }));
    const tags = $("#pfTags").value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const obj = {
      id: $("#pfId").value || "p_" + Date.now(),
      model: $("#pfModel").value.trim(),
      modelEn: $("#pfModelEn").value.trim(),
      image: $("#pfImg").value || "",
      feature: $("#pfFeature").value.trim(),
      tags,
      specs,
    };
    const existing = cat.products.find((p) => p.id === obj.id);
    if (existing) {
      Object.assign(existing, obj);
    } else {
      cat.products.push(obj);
    }
    saveLocal();
    hideModal("productModal");
    renderProducts();
  }

  function saveCategory() {
    const id = $("#cfId").value || "cat_" + Date.now();
    const obj = {
      id,
      name: $("#cfName").value.trim(),
      nameEn: $("#cfNameEn").value.trim(),
      tech: $("#cfTech").value.trim(),
      techPoints: $("#cfTechPoints").value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      image: $("#cfImg").value || "",
    };
    const existing = DATA.categories.find((c) => c.id === id);
    if (existing) {
      Object.assign(existing, obj);
    } else {
      obj.products = [];
      DATA.categories.push(obj);
    }
    saveLocal();
    hideModal("categoryModal");
    populateCatSelects();
    renderCategories();
  }

  /* ---------------- export ---------------- */
  function buildDataJs() {
    const obj = {
      brand: DATA.brand || { name: "耗材二部" },
      totalProducts: DATA.categories.reduce((a, c) => a + c.products.length, 0),
      categories: DATA.categories,
    };
    return "window.PRODUCT_DATA = " + JSON.stringify(obj, null, 2) + ";\n";
  }
  function exportDataJs() {
    const content = buildDataJs();
    const blob = new Blob([content], { type: "application/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.js";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("已导出 data.js");
  }

  /* ---------------- publish to GitHub ---------------- */
  function utoa(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  async function publishToGitHub() {
    const token = $("#pubToken").value.trim();
    const repo = $("#pubRepo").value.trim();
    const branch = $("#pubBranch").value.trim() || "main";
    if (!token || !repo) return;
    const status = $("#publishStatus");
    status.textContent = "正在发布…";
    status.className = "publish-status";
    $("#pubSubmit").disabled = true;
    try {
      const [owner, name] = repo.split("/");
      const path = "data/data.js";
      const api = `https://api.github.com/repos/${owner}/${name}/contents/${path}`;
      const headers = {
        Authorization: "token " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      };
      // get sha if exists
      let sha = null;
      const getR = await fetch(api, { headers });
      if (getR.ok) sha = (await getR.json()).sha;
      const body = {
        message: "Update products via 耗材二部 admin",
        content: utoa(buildDataJs()),
        branch,
      };
      if (sha) body.sha = sha;
      const putR = await fetch(api, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      if (!putR.ok) {
        const err = await putR.json().catch(() => ({}));
        throw new Error(err.message || "GitHub 返回 " + putR.status);
      }
      status.textContent = "✅ 发布成功！GitHub Pages 将在 1 分钟内更新。";
      status.className = "publish-status ok";
    } catch (e) {
      status.textContent = "❌ 发布失败：" + e.message;
      status.className = "publish-status err";
    } finally {
      $("#pubSubmit").disabled = false;
    }
  }

  /* ---------------- boot ---------------- */
  function boot() {
    // 登录相关在 initAdmin 之前就要可用
    $("#loginBtn").addEventListener("click", doLogin);
    $("#loginPass").addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
