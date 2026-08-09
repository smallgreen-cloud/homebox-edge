# HomeBox Edge

HomeBox Edge 是一套非官方、serverless、HomeBox-compatible 的家庭資產台帳。它沿用 TapCard MCP 的 Cloudflare-only 形狀：同一個 Worker 提供手機／網頁 UI、私人 API、Remote MCP、D1 資料與全文搜尋，以及可撤銷的 KV MCP key。

它不是 HomeBox fork，也不包含 HomeBox 的 AGPL 程式碼。v0.1 的「HomeBox-compatible」明確指向 HomeBox `v0.26.2` 的物件 CSV/TSV 雙向交換。

## 現有功能

- 手機與桌面共用的家庭資產台帳
- 新增、搜尋、詳情編輯、封存與還原
- 可選擇同時瀏覽及搜尋已封存資產
- D1 + FTS5：名稱、位置、品牌、型號、序號、標籤與自訂欄位搜尋
- HomeBox CSV/TSV 預覽；預覽不寫入
- 明確確認後才匯入；`HB.import_ref` 以 owner scope upsert
- HomeBox canonical CSV 匯出，包含封存項目
- `HB.parent_import_ref`、位置階層、標籤、日期、保固、出售資訊與 `HB.field.*`
- Remote MCP 與個別可撤銷的 `hi_` connector key
- UI 可列出 MCP key 預覽、到期日並個別撤銷；完整 URL 只在建立時顯示
- MCP tool schema 完整公開 HomeBox-compatible 欄位並拒絕未宣告輸入
- 完整 collection ZIP manifest/table 契約已固定，restore 尚未開放

## 架構

```text
Mobile / Browser / AI client
              │
       Cloudflare Worker
       ├── Static Assets：responsive UI
       ├── owner API + Remote MCP
       ├── HomeBox CSV compatibility boundary
       ├── D1：assets + FTS5
       └── KV：revocable MCP keys
```

格式細節與版本來源見 [docs/HOMEBOX-COMPATIBILITY.md](docs/HOMEBOX-COMPATIBILITY.md)，產品不變量見 [docs/SPEC.md](docs/SPEC.md)。
分階段交付與 release gate 見 [docs/ROADMAP.md](docs/ROADMAP.md)。

## MCP tools

| Tool | 行為 |
|---|---|
| `create_asset` | 建立已確認的家庭資產 |
| `search_assets` | 搜尋 owner scope 的未封存資產 |
| `get_asset` | 讀取完整資產 |
| `update_asset` | 更新允許欄位 |
| `archive_asset` | 封存，不永久刪除 |
| `preview_homebox_csv` | 驗證與預覽 CSV/TSV，不寫入 |
| `import_homebox_csv` | 僅在 `confirmed: true` 時匯入 |
| `export_homebox_csv` | 匯出 HomeBox v0.26.2 canonical CSV |

## 本機驗證

需求：Node.js 20+。

```bash
npm install
npm run cf-typegen
npm run migrate:local
npm test
npm run typecheck
npm run build
npm run dev
```

測試門檻：lines／functions／statements 80%，branches 75%。

## 部署準備

建立 Cloudflare 資源：

```bash
npx wrangler d1 create homebox-edge
npx wrangler kv namespace create MCP_KEYS
```

把 D1 與 KV ID、`PUBLIC_BASE_URL` 填入 `wrangler.jsonc`，再用 secret 設定管理憑證。管理憑證不得寫入原始碼或 Wrangler vars：

```bash
npx wrangler secret put ADMIN_TOKEN
npm run cf-typegen
npx wrangler d1 migrations apply homebox-edge --remote
npm test
npm run typecheck
npx wrangler deploy
```

部署後開啟 `/app`，輸入 `ADMIN_TOKEN`，再於「連接 AI 工具」建立 Connector URL。完整 URL 含私人 key，視同密碼。

## 資料聲明

repo 內只有依 HomeBox 公開格式製作的合成測試資料，不含真實家庭資產、部署 ID、API key 或其他 secrets。

## v0.1 邊界

- 支援 HomeBox item CSV/TSV；尚未宣稱完整 collection ZIP restore 相容。
- CSV 交換不包含照片與附件，這也符合 HomeBox CSV 的既有限制。
- R2 照片／文件將與 collection ZIP attachment mapping 一起進入下一階段。
- 目前為單一 owner 部署；多人 collection 不在 v0.1。

## License

Apache-2.0。HomeBox 是獨立的 AGPL 專案；本專案只實作其公開交換格式。
