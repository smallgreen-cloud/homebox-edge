export function createKeyUi({ api, byId, getLocale, setBusy, showStatus, t }) {
  let keys = [];

  function render() {
    const target = byId("keyList");
    target.replaceChildren();
    if (keys.length === 0) {
      const empty = document.createElement("p");
      empty.className = "field-note";
      empty.textContent = t("noMcp");
      target.append(empty);
      return;
    }
    for (const key of keys) {
      const row = document.createElement("div");
      row.className = "key-row";
      const details = document.createElement("div");
      const preview = document.createElement("strong");
      preview.textContent = key.preview;
      const expiry = document.createElement("span");
      expiry.textContent = t("validUntil", {
        date: new Date(key.expires_at * 1000).toLocaleDateString(
          getLocale() === "en" ? "en-US" : "zh-TW",
        ),
      });
      details.append(preview, expiry);
      const revoke = document.createElement("button");
      revoke.className = "text-button danger-button";
      revoke.type = "button";
      revoke.textContent = t("revoke");
      revoke.addEventListener("click", async () => {
        revoke.dataset.label = revoke.textContent;
        setBusy(revoke, true, t("revoking"));
        try {
          await api(`/api/keys/${encodeURIComponent(key.id)}`, { method: "DELETE" });
          await load();
          showStatus(t("mcpRevoked"));
        } catch (error) {
          showStatus(error.message, true);
          setBusy(revoke, false);
        }
      });
      row.append(details, revoke);
      target.append(row);
    }
  }

  async function load() {
    const response = await api("/api/keys");
    const body = await response.json();
    keys = body.keys;
    render();
  }

  byId("createKeyButton").addEventListener("click", async () => {
    const button = byId("createKeyButton");
    button.dataset.label = button.textContent;
    setBusy(button, true, t("creatingConnection"));
    try {
      const response = await api("/api/keys", { method: "POST" });
      const result = await response.json();
      byId("connectorOutput").textContent = result.connector_url;
      await load();
      showStatus(t("mcpCreated"));
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      setBusy(button, false);
    }
  });

  return { load, render };
}
