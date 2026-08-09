const byId = (id) => document.getElementById(id);

const state = {
  token: localStorage.getItem("homeboxEdgeToken") || "",
  assets: [],
  keys: [],
  query: "",
  includeArchived: false,
  importCsv: "",
};

let statusTimer;

function showStatus(message, error = false) {
  const target = byId("status");
  target.textContent = message;
  target.classList.toggle("error", error);
  target.classList.add("visible");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => target.classList.remove("visible"), 4200);
}

function setBusy(element, busy, label) {
  element.disabled = busy;
  element.setAttribute("aria-busy", String(busy));
  if (label) element.textContent = busy ? label : element.dataset.label;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${state.token}`);
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    let message = `請求失敗（${response.status}）`;
    try {
      const body = await response.json();
      if (body.error) message = body.error;
    } catch {
      // A non-JSON platform error still receives the safe status fallback.
    }
    throw new Error(message);
  }
  return response;
}

function locationText(asset) {
  return asset.location?.length ? asset.location.join(" / ") : "尚未指定位置";
}

function renderAssets() {
  const grid = byId("assetGrid");
  grid.replaceChildren();
  byId("assetCount").textContent = String(state.assets.length);
  byId("assetCountLabel").textContent = state.includeArchived
    ? "件目前顯示資產"
    : "件未封存資產";
  if (state.assets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = "台帳還是空的";
    const copy = document.createElement("span");
    copy.textContent = "先記下一件常找不到、需要保固，或搬家時不想遺漏的物件。";
    empty.append(title, copy);
    grid.append(empty);
    return;
  }

  state.assets.forEach((asset, index) => {
    const article = document.createElement("article");
    article.className = "asset-card";
    article.classList.toggle("archived", asset.archived);
    article.style.setProperty("--i", String(index));

    const heading = document.createElement("div");
    heading.className = "asset-card-heading";
    const title = document.createElement("h3");
    title.textContent = asset.name;
    const id = document.createElement("span");
    id.className = "asset-id";
    id.textContent = asset.asset_id || asset.import_ref || "NO REF";
    heading.append(title, id);

    const location = document.createElement("p");
    location.className = "asset-location";
    location.textContent = locationText(asset);

    const metadata = document.createElement("div");
    metadata.className = "asset-meta";
    const quantity = document.createElement("span");
    quantity.textContent = `數量 ${asset.quantity}`;
    metadata.append(quantity);
    if (asset.archived) {
      const archived = document.createElement("span");
      archived.className = "archived-badge";
      archived.textContent = "已封存";
      metadata.append(archived);
    }
    for (const tag of asset.tags || []) {
      const element = document.createElement("span");
      element.textContent = tag;
      metadata.append(element);
    }

    const actions = document.createElement("div");
    actions.className = "asset-actions";
    const edit = document.createElement("button");
    edit.className = "text-button";
    edit.type = "button";
    edit.textContent = "查看／編輯";
    edit.addEventListener("click", () => {
      openAssetDialog(asset.id).catch((error) => showStatus(error.message, true));
    });
    const archive = document.createElement("button");
    archive.className = "archive-button";
    archive.type = "button";
    archive.textContent = asset.archived ? "還原到台帳" : "封存這件資產";
    archive.addEventListener("click", () => setAssetArchived(asset, archive));
    actions.append(edit, archive);
    article.append(heading, location, metadata, actions);
    grid.append(article);
  });
}

async function loadAssets(query = state.query) {
  state.query = query;
  const parameters = [];
  if (query) parameters.push(`q=${encodeURIComponent(query)}`);
  if (state.includeArchived) parameters.push("include_archived=true");
  const path = parameters.length ? `/api/assets?${parameters.join("&")}` : "/api/assets";
  const response = await api(path);
  const body = await response.json();
  state.assets = body.assets;
  renderAssets();
  byId("clearSearchButton").hidden = query === "";
}

async function enterInventory() {
  await api("/api/me");
  byId("login").hidden = true;
  byId("inventory").hidden = false;
  byId("logoutButton").hidden = false;
  await Promise.all([loadAssets(), loadKeys()]);
}

byId("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.dataset.label = button.textContent;
  state.token = byId("adminToken").value;
  setBusy(button, true, "正在核對憑證…");
  try {
    await enterInventory();
    localStorage.setItem("homeboxEdgeToken", state.token);
    showStatus("台帳已開啟");
  } catch (error) {
    state.token = "";
    showStatus(error.message || "憑證無法使用，請重新確認。", true);
  } finally {
    setBusy(button, false);
  }
});

byId("logoutButton").addEventListener("click", () => {
  localStorage.removeItem("homeboxEdgeToken");
  state.token = "";
  byId("inventory").hidden = true;
  byId("login").hidden = false;
  byId("logoutButton").hidden = true;
  byId("adminToken").value = "";
  byId("adminToken").focus();
});

byId("searchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await loadAssets(byId("searchInput").value.trim());
  } catch (error) {
    showStatus(error.message, true);
  }
});

byId("clearSearchButton").addEventListener("click", async () => {
  byId("searchInput").value = "";
  try {
    await loadAssets();
  } catch (error) {
    showStatus(error.message, true);
  }
});

byId("includeArchived").addEventListener("change", async (event) => {
  state.includeArchived = event.currentTarget.checked;
  try {
    await loadAssets();
  } catch (error) {
    showStatus(error.message, true);
  }
});

byId("assetForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const data = new FormData(form);
  const location = String(data.get("location") || "")
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);
  const tags = String(data.get("tags") || "")
    .split(/[;；]/)
    .map((value) => value.trim())
    .filter(Boolean);
  button.dataset.label = button.textContent;
  setBusy(button, true, "正在加入台帳…");
  try {
    await api("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        location,
        tags,
        quantity: Number(data.get("quantity") || 1),
        notes: String(data.get("notes") || "") || undefined,
      }),
    });
    form.reset();
    form.elements.quantity.value = "1";
    await loadAssets();
    showStatus("資產已加入台帳");
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

async function setAssetArchived(asset, button) {
  button.dataset.label = button.textContent;
  setBusy(button, true, asset.archived ? "正在還原…" : "正在封存…");
  try {
    if (asset.archived) {
      await api(`/api/assets/${encodeURIComponent(asset.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      showStatus("資產已還原到台帳");
    } else {
      await api(`/api/assets/${encodeURIComponent(asset.id)}/archive`, { method: "POST" });
      showStatus("資產已封存，仍會保留在 HomeBox CSV 匯出中");
    }
    await loadAssets();
  } catch (error) {
    showStatus(error.message, true);
    setBusy(button, false);
  }
}

const assetDialog = byId("assetDialog");

function formControl(form, name) {
  return form.elements.namedItem(name);
}

async function openAssetDialog(assetId) {
  const response = await api(`/api/assets/${encodeURIComponent(assetId)}`);
  const { asset } = await response.json();
  const form = byId("assetEditForm");
  formControl(form, "id").value = asset.id;
  formControl(form, "name").value = asset.name;
  formControl(form, "asset_id").value = asset.asset_id || "";
  formControl(form, "location").value = asset.location?.join(" / ") || "";
  formControl(form, "tags").value = asset.tags?.join("；") || "";
  formControl(form, "quantity").value = String(asset.quantity);
  formControl(form, "manufacturer").value = asset.manufacturer || "";
  formControl(form, "model_number").value = asset.model_number || "";
  formControl(form, "serial_number").value = asset.serial_number || "";
  formControl(form, "purchase_price").value = String(asset.purchase_price);
  formControl(form, "notes").value = asset.notes || "";
  formControl(form, "insured").checked = asset.insured;
  formControl(form, "lifetime_warranty").checked = asset.lifetime_warranty;
  byId("assetDialogTitle").textContent = asset.name;
  assetDialog.showModal();
}

function closeAssetDialog() {
  assetDialog.close();
}

byId("closeAssetDialog").addEventListener("click", closeAssetDialog);
byId("cancelAssetEdit").addEventListener("click", closeAssetDialog);

byId("assetEditForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const id = String(data.get("id"));
  const patch = {
    name: String(data.get("name") || ""),
    asset_id: String(data.get("asset_id") || "") || undefined,
    location: String(data.get("location") || "")
      .split("/")
      .map((value) => value.trim())
      .filter(Boolean),
    tags: String(data.get("tags") || "")
      .split(/[;；]/)
      .map((value) => value.trim())
      .filter(Boolean),
    quantity: Number(data.get("quantity")),
    manufacturer: String(data.get("manufacturer") || ""),
    model_number: String(data.get("model_number") || ""),
    serial_number: String(data.get("serial_number") || ""),
    purchase_price: Number(data.get("purchase_price") || 0),
    notes: String(data.get("notes") || ""),
    insured: data.get("insured") === "on",
    lifetime_warranty: data.get("lifetime_warranty") === "on",
  };
  button.dataset.label = button.textContent;
  setBusy(button, true, "正在儲存…");
  try {
    await api(`/api/assets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    closeAssetDialog();
    await loadAssets();
    showStatus("資產資料已更新");
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

byId("previewImportButton").addEventListener("click", async () => {
  const file = byId("csvFile").files[0];
  if (!file) {
    showStatus("請先選擇 HomeBox CSV 或 TSV 檔案。", true);
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showStatus("檔案超過 5 MB。請拆成較小的 HomeBox CSV 再匯入。", true);
    return;
  }
  const button = byId("previewImportButton");
  button.dataset.label = button.textContent;
  setBusy(button, true, "正在檢查格式…");
  try {
    state.importCsv = await file.text();
    const response = await api("/api/homebox/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv_text: state.importCsv }),
    });
    const preview = await response.json();
    const target = byId("importPreview");
    target.replaceChildren();
    const summary = document.createElement("p");
    summary.textContent = `格式通過：共 ${preview.count} 筆，以下顯示前 ${preview.sample.length} 筆。`;
    target.append(summary);
    for (const asset of preview.sample) {
      const row = document.createElement("div");
      row.className = "preview-row";
      const name = document.createElement("span");
      name.textContent = asset.name;
      const location = document.createElement("span");
      location.textContent = locationText(asset);
      row.append(name, location);
      target.append(row);
    }
    byId("confirmImportButton").hidden = false;
  } catch (error) {
    state.importCsv = "";
    byId("confirmImportButton").hidden = true;
    showStatus(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

byId("confirmImportButton").addEventListener("click", async () => {
  const button = byId("confirmImportButton");
  button.dataset.label = button.textContent;
  setBusy(button, true, "正在匯入資產…");
  try {
    const response = await api("/api/homebox/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv_text: state.importCsv, confirmed: true }),
    });
    const result = await response.json();
    await loadAssets();
    state.importCsv = "";
    byId("csvFile").value = "";
    byId("importPreview").replaceChildren();
    button.hidden = true;
    showStatus(`匯入完成：新增 ${result.created} 筆、更新 ${result.updated} 筆`);
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

byId("exportButton").addEventListener("click", async () => {
  const button = byId("exportButton");
  button.dataset.label = button.textContent;
  setBusy(button, true, "正在整理 CSV…");
  try {
    const response = await api("/api/homebox/export");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `homebox-edge-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showStatus("HomeBox CSV 已下載");
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

function renderKeys() {
  const target = byId("keyList");
  target.replaceChildren();
  if (state.keys.length === 0) {
    const empty = document.createElement("p");
    empty.className = "field-note";
    empty.textContent = "目前沒有有效的 MCP 連線。";
    target.append(empty);
    return;
  }
  for (const key of state.keys) {
    const row = document.createElement("div");
    row.className = "key-row";
    const details = document.createElement("div");
    const preview = document.createElement("strong");
    preview.textContent = key.preview;
    const expiry = document.createElement("span");
    expiry.textContent = `有效至 ${new Date(key.expires_at * 1000).toLocaleDateString("zh-TW")}`;
    details.append(preview, expiry);
    const revoke = document.createElement("button");
    revoke.className = "text-button danger-button";
    revoke.type = "button";
    revoke.textContent = "撤銷";
    revoke.addEventListener("click", async () => {
      revoke.dataset.label = revoke.textContent;
      setBusy(revoke, true, "撤銷中…");
      try {
        await api(`/api/keys/${encodeURIComponent(key.id)}`, { method: "DELETE" });
        await loadKeys();
        showStatus("MCP 連線已撤銷");
      } catch (error) {
        showStatus(error.message, true);
        setBusy(revoke, false);
      }
    });
    row.append(details, revoke);
    target.append(row);
  }
}

async function loadKeys() {
  const response = await api("/api/keys");
  const body = await response.json();
  state.keys = body.keys;
  renderKeys();
}

byId("createKeyButton").addEventListener("click", async () => {
  const button = byId("createKeyButton");
  button.dataset.label = button.textContent;
  setBusy(button, true, "正在建立連線…");
  try {
    const response = await api("/api/keys", { method: "POST" });
    const result = await response.json();
    byId("connectorOutput").textContent = result.connector_url;
    await loadKeys();
    showStatus("MCP Connector URL 已建立；請把它當作密碼保管。 ");
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

if (state.token) {
  enterInventory().catch(() => {
    localStorage.removeItem("homeboxEdgeToken");
    state.token = "";
  });
}
