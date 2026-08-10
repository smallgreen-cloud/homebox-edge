import { createKeyUi } from "./keys.js?v=acc6378544c1";
import { createPhotoUi } from "./photos.js?v=e4e113340478";
const byId = (id) => document.getElementById(id);

const COPY = {
  "zh-Hant": {
    documentTitle: "HomeBox Edge｜家庭資產管理",
    skipToAssets: "跳到資產清單",
    mastheadNote: "一份跟著你走的家庭資產清單",
    homeboxHome: "HomeBox Edge 首頁",
    lockData: "鎖定資料",
    loginTitleLine1: "房子會變，",
    loginTitleLine2: "物件要有跡可循。",
    loginIntro: "登入後從手機盤點、搜尋與補記；需要搬家時，用 HomeBox CSV 帶走。",
    adminCredential: "管理憑證",
    openAssetList: "開啟資產清單",
    credentialNote: "憑證只保存在這台裝置的瀏覽器。",
    assetSummary: "資產摘要",
    assetOverview: "資產概況",
    viewAssetList: "查看資產清單",
    familyAssets: "家庭資產",
    inventoryIntro: "搜尋、盤點與維護家中重要物件。",
    addAssetCta: "＋ 新增資產",
    exportCsv: "匯出 CSV",
    searchAssets: "搜尋資產",
    searchPlaceholder: "搜尋名稱、位置、品牌、序號或標籤",
    search: "搜尋",
    showArchived: "同時顯示已封存資產",
    assetList: "資產清單",
    clearSearch: "清除搜尋",
    managementTools: "管理工具",
    toolIntro: "需要新增、搬移資料或連接 AI 時再展開。",
    addOneAsset: "新增一件資產",
    name: "名稱",
    namePlaceholder: "例如：客廳除濕機",
    locationPath: "位置路徑",
    locationPlaceholder: "家 / 客廳 / 電視櫃",
    tags: "標籤",
    tagsPlaceholder: "家電；保固中",
    quantity: "數量",
    notes: "備註",
    notesPlaceholder: "購買來源、收納方式或家人需要知道的事",
    optionalPhoto: "首張照片（選填）",
    photoFileNote: "可直接拍照或選擇圖片，單張最多 8 MB。",
    assetPhotos: "資產照片",
    addPhoto: "＋ 新增照片",
    noPhotos: "還沒有照片。從手機拍一張，之後盤點會更快。",
    primaryPhoto: "主圖",
    makePrimary: "設為主圖",
    viewOriginal: "查看原圖",
    loadingOriginal: "載入原圖中…",
    photoLoadFailed: "照片載入失敗",
    uploadingPhoto: "正在處理照片與縮圖…",
    photoUploaded: "照片與縮圖已新增",
    selectingPrimary: "正在更新主圖…",
    primaryUpdated: "主圖已更新",
    unsupportedPhoto: "請選擇 JPEG、PNG、WebP、GIF 或 AVIF 圖片。",
    photoTooLarge: "照片超過 8 MB，請選擇較小的檔案。",
    assetAddedPhotoFailed: "資產已新增，但照片未上傳：{reason}",
    addAsset: "新增資產",
    importHomebox: "匯入 HomeBox 檔案",
    chooseFile: "選擇 CSV 或 TSV",
    checkFile: "先檢查檔案",
    confirmImport: "確認匯入這批資產",
    aiAndMcp: "AI 與 MCP 連線",
    mcpIntro: "建立可隨時撤銷的 Remote MCP Connector URL。",
    createMcpConnection: "建立 MCP 連線",
    assetDetails: "資產詳情",
    close: "關閉",
    closeAssetDetails: "關閉資產詳情",
    assetId: "資產編號",
    manufacturer: "品牌",
    modelNumber: "型號",
    serialNumber: "序號",
    purchasePrice: "購買價格",
    insured: "已投保",
    lifetimeWarranty: "終身保固",
    cancel: "取消",
    saveChanges: "儲存變更",
    requestFailed: "請求失敗（{status}）",
    noLocation: "尚未指定位置",
    loadingAssets: "正在載入資產",
    assetCountShown: "件目前顯示資產",
    assetCountActive: "件未封存資產",
    emptyTitle: "還沒有資產",
    emptyCopy: "先記下一件常找不到、需要保固，或搬家時不想遺漏的物件。",
    quantityValue: "數量 {value}",
    archived: "已封存",
    insuredBadge: "已投保",
    lifetimeWarrantyBadge: "終身保固",
    warrantyUntil: "保固至 {date}",
    openRecord: "開啟紀錄",
    more: "更多",
    restoreToList: "還原至資產清單",
    archive: "封存",
    checkingCredential: "正在核對憑證…",
    inventoryOpened: "資產清單已開啟",
    invalidCredential: "憑證無法使用，請重新確認。",
    addingAsset: "正在新增資產…",
    assetAdded: "資產已新增",
    restoring: "正在還原…",
    archiving: "正在封存…",
    assetRestored: "資產已還原至資產清單",
    assetArchived: "資產已封存，仍會保留在 HomeBox CSV 匯出中",
    saving: "正在儲存…",
    assetUpdated: "資產資料已更新",
    selectFile: "請先選擇 HomeBox CSV 或 TSV 檔案。",
    fileTooLarge: "檔案超過 5 MB。請拆成較小的 HomeBox CSV 再匯入。",
    checkingFormat: "正在檢查格式…",
    formatPassed: "格式通過：共 {count} 筆，以下顯示前 {sample} 筆。",
    importingAssets: "正在匯入資產…",
    importCompleted: "匯入完成：新增 {created} 筆、更新 {updated} 筆",
    preparingCsv: "正在整理 CSV…",
    csvDownloaded: "HomeBox CSV 已下載",
    noMcp: "目前沒有有效的 MCP 連線。",
    validUntil: "有效至 {date}",
    revoke: "撤銷",
    revoking: "撤銷中…",
    mcpRevoked: "MCP 連線已撤銷",
    creatingConnection: "正在建立連線…",
    mcpCreated: "MCP Connector URL 已建立；請把它當作密碼保管。",
  },
  en: {
    documentTitle: "HomeBox Edge | Household Inventory",
    skipToAssets: "Skip to asset list",
    mastheadNote: "A household inventory that moves with you",
    homeboxHome: "HomeBox Edge home",
    lockData: "Lock data",
    loginTitleLine1: "Homes change.",
    loginTitleLine2: "Keep every item accounted for.",
    loginIntro: "Sign in to inventory, search, and update items from your phone. Take everything with you as a HomeBox CSV when you move.",
    adminCredential: "Admin credential",
    openAssetList: "Open asset list",
    credentialNote: "Your credential stays in this browser on this device.",
    assetSummary: "Asset summary",
    assetOverview: "Asset overview",
    viewAssetList: "View asset list",
    familyAssets: "Household Assets",
    inventoryIntro: "Search, inventory, and maintain the important items in your home.",
    addAssetCta: "+ Add asset",
    exportCsv: "Export CSV",
    searchAssets: "Search assets",
    searchPlaceholder: "Search by name, location, brand, serial number, or tag",
    search: "Search",
    showArchived: "Include archived assets",
    assetList: "Asset List",
    clearSearch: "Clear search",
    managementTools: "Management Tools",
    toolIntro: "Open these tools only when you need to add assets, move data, or connect AI.",
    addOneAsset: "Add an asset",
    name: "Name",
    namePlaceholder: "Example: Living room dehumidifier",
    locationPath: "Location path",
    locationPlaceholder: "Home / Living room / TV cabinet",
    tags: "Tags",
    tagsPlaceholder: "Appliance; Under warranty",
    quantity: "Quantity",
    notes: "Notes",
    notesPlaceholder: "Purchase source, storage details, or anything your household should know",
    optionalPhoto: "First photo (optional)",
    photoFileNote: "Take a photo or choose an image, up to 8 MB each.",
    assetPhotos: "Asset Photos",
    addPhoto: "+ Add photo",
    noPhotos: "No photos yet. Add one from your phone to make future inventories faster.",
    primaryPhoto: "Primary",
    makePrimary: "Make primary",
    viewOriginal: "View original",
    loadingOriginal: "Loading original…",
    photoLoadFailed: "Photo failed to load",
    uploadingPhoto: "Processing photo and thumbnail…",
    photoUploaded: "Photo and thumbnail added",
    selectingPrimary: "Updating primary photo…",
    primaryUpdated: "Primary photo updated",
    unsupportedPhoto: "Choose a JPEG, PNG, WebP, GIF, or AVIF image.",
    photoTooLarge: "This photo is larger than 8 MB. Choose a smaller file.",
    assetAddedPhotoFailed: "Asset added, but its photo was not uploaded: {reason}",
    addAsset: "Add asset",
    importHomebox: "Import a HomeBox file",
    chooseFile: "Choose a CSV or TSV file",
    checkFile: "Check file first",
    confirmImport: "Import these assets",
    aiAndMcp: "AI and MCP Connections",
    mcpIntro: "Create a revocable Remote MCP Connector URL.",
    createMcpConnection: "Create MCP connection",
    assetDetails: "Asset Details",
    close: "Close",
    closeAssetDetails: "Close asset details",
    assetId: "Asset ID",
    manufacturer: "Manufacturer",
    modelNumber: "Model number",
    serialNumber: "Serial number",
    purchasePrice: "Purchase price",
    insured: "Insured",
    lifetimeWarranty: "Lifetime warranty",
    cancel: "Cancel",
    saveChanges: "Save changes",
    requestFailed: "Request failed ({status})",
    noLocation: "No location assigned",
    loadingAssets: "Loading assets",
    assetCountShown: "assets shown",
    assetCountActive: "active assets",
    emptyTitle: "No assets yet",
    emptyCopy: "Start with an item you often misplace, need to keep under warranty, or do not want to forget when moving.",
    quantityValue: "Quantity {value}",
    archived: "Archived",
    insuredBadge: "Insured",
    lifetimeWarrantyBadge: "Lifetime warranty",
    warrantyUntil: "Warranty until {date}",
    openRecord: "Open record",
    more: "More",
    restoreToList: "Restore to asset list",
    archive: "Archive",
    checkingCredential: "Checking credential…",
    inventoryOpened: "Asset list opened",
    invalidCredential: "That credential did not work. Check it and try again.",
    addingAsset: "Adding asset…",
    assetAdded: "Asset added",
    restoring: "Restoring…",
    archiving: "Archiving…",
    assetRestored: "Asset restored to the asset list",
    assetArchived: "Asset archived. It will remain in HomeBox CSV exports.",
    saving: "Saving…",
    assetUpdated: "Asset updated",
    selectFile: "Choose a HomeBox CSV or TSV file first.",
    fileTooLarge: "This file is larger than 5 MB. Split it into smaller HomeBox CSV files and try again.",
    checkingFormat: "Checking file format…",
    formatPassed: "Format passed: {count} assets found. Showing the first {sample}.",
    importingAssets: "Importing assets…",
    importCompleted: "Import complete: {created} created, {updated} updated",
    preparingCsv: "Preparing CSV…",
    csvDownloaded: "HomeBox CSV downloaded",
    noMcp: "No active MCP connections.",
    validUntil: "Valid until {date}",
    revoke: "Revoke",
    revoking: "Revoking…",
    mcpRevoked: "MCP connection revoked",
    creatingConnection: "Creating connection…",
    mcpCreated: "MCP Connector URL created. Store it like a password.",
  },
};

const state = {
  token: localStorage.getItem("homeboxEdgeToken") || "",
  locale: localStorage.getItem("homeboxEdgeLocale") === "en" ? "en" : "zh-Hant",
  assets: [],
  query: "",
  includeArchived: false,
  importCsv: "",
};

let statusTimer;

function t(key, values = {}) {
  const template = COPY[state.locale][key] ?? COPY["zh-Hant"][key] ?? key;
  return template.replace(/\{([a-zA-Z]+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
}

function setInlineLabel(element, value) {
  const textNode = [...element.childNodes].find(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "",
  );
  if (!textNode) return;
  const followsControl = textNode.previousSibling?.nodeType === Node.ELEMENT_NODE;
  textNode.textContent = followsControl ? ` ${value}` : value;
}

function applyTranslations() {
  document.documentElement.lang = state.locale;
  document.title = t("documentTitle");
  for (const element of document.querySelectorAll("[data-i18n]")) {
    if (element.id === "assetDialogTitle" && element.closest("dialog")?.open) continue;
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-label]")) {
    setInlineLabel(element, t(element.dataset.i18nLabel));
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }
  const languageButton = byId("languageButton");
  languageButton.textContent = state.locale === "zh-Hant" ? "EN" : "中文";
  languageButton.setAttribute(
    "aria-label",
    state.locale === "zh-Hant" ? "Switch to English" : "Switch to Traditional Chinese",
  );
  if (!byId("inventory").hidden) {
    renderAssets();
    keyUi.render();
  }
}

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
    let message = t("requestFailed", { status: response.status });
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

const photoUi = createPhotoUi({ api, byId, loadAssets, showStatus, t });
const keyUi = createKeyUi({
  api,
  byId,
  getLocale: () => state.locale,
  setBusy,
  showStatus,
  t,
});

function locationText(asset) {
  return asset.location?.length ? asset.location.join(" / ") : t("noLocation");
}

function renderAssetLoading() {
  const grid = byId("assetGrid");
  grid.setAttribute("aria-busy", "true");
  grid.replaceChildren();
  byId("assetCount").textContent = "—";
  byId("assetCountLabel").textContent = t("loadingAssets");
  for (let index = 0; index < 4; index += 1) {
    const placeholder = document.createElement("div");
    placeholder.className = "asset-skeleton";
    placeholder.setAttribute("aria-hidden", "true");
    grid.append(placeholder);
  }
}

function renderAssets() {
  const grid = byId("assetGrid");
  photoUi.beginCardRender();
  grid.setAttribute("aria-busy", "false");
  grid.replaceChildren();
  byId("assetCount").textContent = String(state.assets.length);
  byId("assetCountLabel").textContent = state.includeArchived
    ? t("assetCountShown")
    : t("assetCountActive");
  if (state.assets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = t("emptyTitle");
    const copy = document.createElement("span");
    copy.textContent = t("emptyCopy");
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
    quantity.textContent = t("quantityValue", { value: asset.quantity });
    metadata.append(quantity);
    if (asset.archived) {
      const archived = document.createElement("span");
      archived.className = "archived-badge";
      archived.textContent = t("archived");
      metadata.append(archived);
    }
    for (const tag of asset.tags || []) {
      const element = document.createElement("span");
      element.textContent = tag;
      metadata.append(element);
    }
    if (asset.insured) {
      const insured = document.createElement("span");
      insured.className = "status-badge";
      insured.textContent = t("insuredBadge");
      metadata.append(insured);
    }
    if (asset.lifetime_warranty || asset.warranty_expires) {
      const warranty = document.createElement("span");
      warranty.className = "status-badge";
      warranty.textContent = asset.lifetime_warranty
        ? t("lifetimeWarrantyBadge")
        : t("warrantyUntil", { date: asset.warranty_expires });
      metadata.append(warranty);
    }

    const actions = document.createElement("div");
    actions.className = "asset-actions";
    const edit = document.createElement("button");
    edit.className = "asset-open-button";
    edit.type = "button";
    edit.textContent = t("openRecord");
    edit.addEventListener("click", () => {
      openAssetDialog(asset.id).catch((error) => showStatus(error.message, true));
    });
    const menu = document.createElement("details");
    menu.className = "asset-menu";
    const menuLabel = document.createElement("summary");
    menuLabel.textContent = t("more");
    const archive = document.createElement("button");
    archive.className = "archive-button";
    archive.type = "button";
    archive.textContent = asset.archived ? t("restoreToList") : t("archive");
    archive.addEventListener("click", () => setAssetArchived(asset, archive));
    menu.append(menuLabel, archive);
    actions.append(edit, menu);
    article.append(heading, location, metadata, actions);
    grid.append(article);
    photoUi.attachCardImage(article, asset);
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
  renderAssetLoading();
  await Promise.all([loadAssets(), keyUi.load()]);
}

byId("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.dataset.label = button.textContent;
  state.token = byId("adminToken").value;
  setBusy(button, true, t("checkingCredential"));
  try {
    await enterInventory();
    localStorage.setItem("homeboxEdgeToken", state.token);
    showStatus(t("inventoryOpened"));
  } catch (error) {
    state.token = "";
    showStatus(error.message || t("invalidCredential"), true);
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
  photoUi.reset();
  byId("adminToken").focus();
});

byId("languageButton").addEventListener("click", () => {
  state.locale = state.locale === "zh-Hant" ? "en" : "zh-Hant";
  localStorage.setItem("homeboxEdgeLocale", state.locale);
  applyTranslations();
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
    await loadAssets("");
  } catch (error) {
    showStatus(error.message, true);
  }
});

byId("openCreateButton").addEventListener("click", () => {
  const panel = byId("createPanel");
  panel.open = true;
  panel.scrollIntoView({ block: "start" });
  panel.querySelector('input[name="name"]').focus();
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
  setBusy(button, true, t("addingAsset"));
  try {
    const response = await api("/api/assets", {
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
    const { asset } = await response.json();
    const photo = byId("createAssetPhotoInput").files?.[0];
    let photoError = null;
    if (photo) {
      try {
        await photoUi.uploadPhoto(asset.id, photo, true);
      } catch (error) {
        photoError = error;
      }
    }
    form.reset();
    form.elements.quantity.value = "1";
    byId("createPanel").open = false;
    await loadAssets();
    showStatus(
      photoError
        ? t("assetAddedPhotoFailed", { reason: photoError.message })
        : t("assetAdded"),
      Boolean(photoError),
    );
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

async function setAssetArchived(asset, button) {
  button.dataset.label = button.textContent;
  setBusy(button, true, asset.archived ? t("restoring") : t("archiving"));
  try {
    if (asset.archived) {
      await api(`/api/assets/${encodeURIComponent(asset.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      showStatus(t("assetRestored"));
    } else {
      await api(`/api/assets/${encodeURIComponent(asset.id)}/archive`, { method: "POST" });
      showStatus(t("assetArchived"));
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
  await photoUi.renderAsset(asset);
}

function closeAssetDialog() {
  photoUi.closeDialog();
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
  setBusy(button, true, t("saving"));
  try {
    await api(`/api/assets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    closeAssetDialog();
    await loadAssets();
    showStatus(t("assetUpdated"));
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

byId("previewImportButton").addEventListener("click", async () => {
  const file = byId("csvFile").files[0];
  if (!file) {
    showStatus(t("selectFile"), true);
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showStatus(t("fileTooLarge"), true);
    return;
  }
  const button = byId("previewImportButton");
  button.dataset.label = button.textContent;
  setBusy(button, true, t("checkingFormat"));
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
    summary.textContent = t("formatPassed", {
      count: preview.count,
      sample: preview.sample.length,
    });
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
  setBusy(button, true, t("importingAssets"));
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
    showStatus(t("importCompleted", { created: result.created, updated: result.updated }));
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

byId("exportButton").addEventListener("click", async () => {
  const button = byId("exportButton");
  button.dataset.label = button.textContent;
  setBusy(button, true, t("preparingCsv"));
  try {
    const response = await api("/api/homebox/export");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `homebox-edge-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showStatus(t("csvDownloaded"));
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    setBusy(button, false);
  }
});

applyTranslations();

if (state.token) {
  enterInventory().catch(() => {
    localStorage.removeItem("homeboxEdgeToken");
    state.token = "";
  });
}
