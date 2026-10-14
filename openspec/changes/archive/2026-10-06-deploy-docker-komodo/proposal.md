## Why

目前專案透過 GitHub Pages 部署，受限於 repository 子路徑，且無法整合既有的地端 Docker、Komodo 與 Cloudflare Tunnel。此變更將應用遷移至地端容器部署，保留瀏覽器端 Local-first 資料模型，並建立可驗證且不公開 Komodo 管理入口的自動發布流程。

## What Changes

- 新增使用 Node 24 Alpine builder 與 Nginx Alpine runtime 的 multi-stage Docker build；基底映像固定版本與 digest，runtime 不包含 Node.js 或應用原始碼。
- 新增 Nginx 設定：
  - SPA fallback。
  - `index.html`、PWA manifest 與 Service Worker 禁止快取。
  - hash 靜態資源使用 immutable 長期快取。
  - 加入 CSP、`nosniff`、Referrer-Policy 與 frame 限制；CSP 保留 Google Fonts 所需來源。
- 新增應用 Compose：
  - 不發布宿主機 port。
  - 將 `bookkeeping` 加入既有 `cloudflared-tunnel-network` external network。
  - 透過 `GET /` healthcheck 判定可用性。
- 新增獨立的 Deployment Runner 容器與 Compose：
  - repository-level GitHub self-hosted runner。
  - 只加入既有 `komodo-networks` external network 並呼叫 Komodo webhook。
  - 不使用 privileged mode、不掛載 Docker socket 或宿主機目錄。
  - runner release 與 checksum 固定，由自動 PR 管理升版。
  - 首次以短效 registration token 註冊，設定保存於獨立 volume。
- 將 GitHub repository 改為 private，之後才啟用 Deployment Runner。
- 將 CI/CD 改為兩階段：
  - GitHub-hosted runner 先執行依賴安裝與 production build。
  - 驗證成功後，由 self-hosted runner 使用 `KOMODO_WEBHOOK_URL` secret 呼叫內網 Komodo webhook。
  - 支援 `main` push 與 `workflow_dispatch`；部署序列化，執行中的部署不中斷，待執行版本只保留最新 commit。
- 將 Vite 與 PWA 路徑固定為 `/`，移除 `BASE_URL` 覆寫。
- 新站從空 IndexedDB 開始，不移轉 GitHub Pages origin 的既有資料。
- 新站與 PWA 驗收完成後，停用 GitHub Pages。
- Komodo Stack、webhook 與更新流程在 Komodo UI 設定，並由維運文件記錄。
- 部署採單一應用容器，可接受更新時數秒中斷；失敗 build 或 healthcheck 不取代現行容器。
- 不使用 Container Registry，也不保留舊版 image；回退時由舊 Git commit 重新 build。

## Capabilities

### New Capabilities
<!-- 純部署、CI/CD 與維運工具鏈調整，不新增產品行為規範；由 change 的 skip_specs 設定略過 specs。 -->

### Modified Capabilities
<!-- 無既有產品 capability requirement 變更。 -->

## Impact

- **新增或調整的 repository 檔案**
  - `.dockerignore`
  - `Dockerfile`
  - `nginx.conf`
  - `compose.yml`
  - runner Dockerfile 與 `compose.runner.yml`
  - `.env.runner.example`
  - `.github/workflows/deploy.yml`
  - 自動相依版本更新設定
  - 部署與 cutover 維運文件
  - `vite.config.ts`

- **外部系統與人工設定**
  - GitHub repository visibility、Actions secret 與 repository-level runner registration。
  - Komodo Stack、內網 webhook、build／replace 與失敗保留策略。
  - 既有 `cloudflared-tunnel-network` 與 `komodo-networks` Docker external networks。
  - Cloudflare Tunnel route。
  - 新站驗收後停用 GitHub Pages。

- **使用者可見影響**
  - Production URL 改為獨立網域根路徑。
  - 舊 GitHub Pages 瀏覽器資料不移轉，新站從空資料庫開始。
  - 網站維持公開存取，帳本資料仍僅儲存在各訪客自己的瀏覽器。
  - Google Fonts 第三方請求維持不變。
