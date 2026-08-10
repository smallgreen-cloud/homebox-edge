const PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export function createPhotoUi({ api, byId, loadAssets, showStatus, t }) {
  const cardUrls = new Set();
  const dialogUrls = new Set();
  let cardRenderId = 0;
  let currentAsset = null;

  function revokeUrls(urls) {
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
  }

  async function protectedImageUrl(path, urls) {
    const response = await api(path);
    const url = URL.createObjectURL(await response.blob());
    urls.add(url);
    return url;
  }

  function validatePhoto(file) {
    if (!file || !PHOTO_TYPES.has(file.type)) throw new Error(t("unsupportedPhoto"));
    if (file.size > MAX_PHOTO_BYTES) throw new Error(t("photoTooLarge"));
  }

  async function uploadPhoto(assetId, file, primary = false) {
    validatePhoto(file);
    const query = new URLSearchParams({
      title: file.name || "Photo",
      primary: String(primary),
    });
    const response = await api(
      `/api/assets/${encodeURIComponent(assetId)}/photos?${query.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      },
    );
    return response.json();
  }

  function beginCardRender() {
    cardRenderId += 1;
    revokeUrls(cardUrls);
  }

  async function attachCardImage(article, asset) {
    const attachment = asset.primary_photo;
    if (!attachment?.thumbnail_url) return;
    const renderId = cardRenderId;
    const frame = document.createElement("div");
    frame.className = "asset-card-photo";
    frame.setAttribute("aria-busy", "true");
    const image = document.createElement("img");
    image.alt = `${asset.name} — ${attachment.title}`;
    image.loading = "lazy";
    image.decoding = "async";
    frame.append(image);
    article.prepend(frame);
    try {
      const url = await protectedImageUrl(attachment.thumbnail_url, cardUrls);
      if (renderId !== cardRenderId || !article.isConnected) {
        URL.revokeObjectURL(url);
        cardUrls.delete(url);
        return;
      }
      image.src = url;
      frame.setAttribute("aria-busy", "false");
    } catch {
      frame.remove();
    }
  }

  async function selectPrimary(attachment) {
    if (!currentAsset || attachment.primary_photo) return;
    showStatus(t("selectingPrimary"));
    await api(
      `/api/assets/${encodeURIComponent(currentAsset.id)}/attachments/${encodeURIComponent(attachment.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary: true }),
      },
    );
    const response = await api(`/api/assets/${encodeURIComponent(currentAsset.id)}`);
    const { asset } = await response.json();
    await renderAsset(asset);
    await loadAssets();
    showStatus(t("primaryUpdated"));
  }

  async function loadOriginal(image, attachment, button) {
    button.disabled = true;
    button.textContent = t("loadingOriginal");
    try {
      image.src = await protectedImageUrl(attachment.original_url, dialogUrls);
      button.remove();
    } catch (error) {
      button.disabled = false;
      button.textContent = t("viewOriginal");
      showStatus(error.message, true);
    }
  }

  async function renderAsset(asset) {
    currentAsset = asset;
    revokeUrls(dialogUrls);
    const hero = byId("assetPhotoHero");
    const gallery = byId("assetPhotoGallery");
    hero.replaceChildren();
    gallery.replaceChildren();
    const photos = (asset.attachments || []).filter((attachment) => attachment.type === "photo");
    if (photos.length === 0) {
      const empty = document.createElement("p");
      empty.className = "photo-empty";
      empty.textContent = t("noPhotos");
      hero.append(empty);
      return;
    }

    const primary = photos.find((photo) => photo.primary_photo) || photos[0];
    const heroImage = document.createElement("img");
    heroImage.alt = `${asset.name} — ${primary.title}`;
    heroImage.decoding = "async";
    const caption = document.createElement("div");
    caption.className = "asset-photo-caption";
    const title = document.createElement("span");
    title.textContent = primary.title;
    const original = document.createElement("button");
    original.type = "button";
    original.className = "text-button";
    original.textContent = t("viewOriginal");
    original.addEventListener("click", () => loadOriginal(heroImage, primary, original));
    caption.append(title, original);
    hero.append(heroImage, caption);
    if (primary.thumbnail_url) {
      try {
        heroImage.src = await protectedImageUrl(primary.thumbnail_url, dialogUrls);
      } catch {
        heroImage.alt = t("photoLoadFailed");
      }
    }

    for (const attachment of photos) {
      const wrapper = document.createElement("div");
      wrapper.className = "asset-photo-item";
      wrapper.setAttribute("role", "listitem");
      const item = document.createElement("button");
      item.type = "button";
      item.className = "asset-photo-thumb";
      item.setAttribute("aria-label", attachment.primary_photo
        ? `${attachment.title} — ${t("primaryPhoto")}`
        : `${attachment.title} — ${t("makePrimary")}`);
      if (attachment.primary_photo) item.setAttribute("aria-current", "true");
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      const label = document.createElement("span");
      label.textContent = attachment.primary_photo ? t("primaryPhoto") : t("makePrimary");
      item.append(image, label);
      item.addEventListener("click", () => {
        selectPrimary(attachment).catch((error) => showStatus(error.message, true));
      });
      wrapper.append(item);
      gallery.append(wrapper);
      if (attachment.thumbnail_url) {
        protectedImageUrl(attachment.thumbnail_url, dialogUrls)
          .then((url) => { image.src = url; })
          .catch(() => { wrapper.hidden = true; });
      }
    }
  }

  function closeDialog() {
    currentAsset = null;
    revokeUrls(dialogUrls);
  }

  function reset() {
    beginCardRender();
    closeDialog();
  }

  byId("assetPhotoInput").addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !currentAsset) return;
    input.disabled = true;
    showStatus(t("uploadingPhoto"));
    try {
      await uploadPhoto(currentAsset.id, file, (currentAsset.attachments || []).length === 0);
      const response = await api(`/api/assets/${encodeURIComponent(currentAsset.id)}`);
      const { asset } = await response.json();
      await renderAsset(asset);
      await loadAssets();
      showStatus(t("photoUploaded"));
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      input.value = "";
      input.disabled = false;
    }
  });

  return { attachCardImage, beginCardRender, closeDialog, renderAsset, reset, uploadPhoto };
}
