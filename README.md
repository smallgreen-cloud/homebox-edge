# HomeBox Edge

HomeBox Edge 是一套非官方、serverless、HomeBox-compatible 的家庭資產管理系統。它沿用 TapCard MCP 的 Cloudflare-only 形狀：同一個 Worker 提供手機／網頁 UI、私人 API、Remote MCP、D1 資料與全文搜尋，以及可撤銷的 MCP key。

它不是 HomeBox fork，也不包含 HomeBox 的 AGPL 程式碼。v0.1 的「HomeBox-compatible」明確指向 HomeBox `v0.26.2` 的物件 CSV/TSV 雙向交換。

正式服務：<https://homebox-edge.alan-chen75.workers.dev>

## 現有功能

- 手機與桌面共用的家庭資產清單
- 新增、搜尋、詳情編輯、封存與還原
- 可選擇同時瀏覽及搜尋已封存資產
- D1 + FTS5：名稱、位置、品牌、型號、序號、標籤與自訂欄位搜尋
- HomeBox CSV/TSV 預覽；預覽不寫入
- 明確確認後才匯入；`HB.import_ref` 以 owner scope upsert
- HomeBox canonical CSV 匯出，包含封存項目
- `HB.parent_import_ref`、位置階層、標籤、日期、保固、出售資訊與 `HB.field.*`
- Remote MCP 與個別可撤銷的 `hi_` connector key；D1/KV 只保存 SHA-256 指紋索引
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
       ├── D1：assets + FTS5 + MCP key registry
       └── KV：legacy MCP credential compatibility mirror
```

格式細節與版本來源見 [docs/HOMEBOX-COMPATIBILITY.md](docs/HOMEBOX-COMPATIBILITY.md)，產品不變量見 [docs/SPEC.md](docs/SPEC.md)。
分階段交付與 release gate 見 [docs/ROADMAP.md](docs/ROADMAP.md)，正式發布與回復程序見 [docs/RELEASE.md](docs/RELEASE.md)。

## 部署驗證範例

`examples/homebox-v0.26.2-household-assets.csv` 提供 24 筆可直接預覽、匯入及重播的合成家庭資產，涵蓋父子關係、中文位置與標籤、保固、投保、封存、出售及自訂欄位。資料全部標示為 `Synthetic for testing only`，不含真實家庭資產。預期結果與 agent 驗證順序見 [examples/README.md](examples/README.md)。

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
npx wrangler types --check
npm run build
npm audit --omit=dev --audit-level=high
npm run dev
```

測試門檻：lines／functions／statements 80%，branches 75%。`npm test` 同時執行 production-build Worker harness，使用真正的 Workerd、D1 migrations 與 KV binding 驗證資產生命週期、HomeBox CSV、MCP key 撤銷、關聯不變量、安全標頭及 request-size 邊界。

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

正式操作必須依 [release runbook](docs/RELEASE.md) 先記錄 D1 Time Travel bookmark、檢查待套 migration，部署後再跑 health、owner API、MCP revoke 與瀏覽器 smoke test。部署後開啟 `/app`，輸入 `ADMIN_TOKEN`，再於「AI 與 MCP 連線」建立 Connector URL。完整 URL 含私人 key，視同密碼。

需要限時測試登入時，可另外設定 `TEMP_ADMIN_TOKEN` 與 ISO 8601 格式的 `TEMP_ADMIN_TOKEN_EXPIRES_AT`。Worker 只會在到期時間前接受這組憑證，既有 `ADMIN_TOKEN` 不受影響；兩者都應以 `wrangler secret put` 互動輸入，不得寫入設定檔或版本庫。

## 資料聲明

repo 內只有依 HomeBox 公開格式製作的合成測試資料，不含真實家庭資產、部署 ID、API key 或其他 secrets。

## v0.1 邊界

- 支援 HomeBox item CSV/TSV；尚未宣稱完整 collection ZIP restore 相容。
- CSV 交換不包含照片與附件，這也符合 HomeBox CSV 的既有限制。
- R2 照片／文件將與 collection ZIP attachment mapping 一起進入下一階段。
- 目前為單一 owner 部署；多人 collection 不在 v0.1。

## License

Apache-2.0。HomeBox 是獨立的 AGPL 專案；本專案只實作其公開交換格式。
