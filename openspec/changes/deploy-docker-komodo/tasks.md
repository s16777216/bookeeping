## 1. 應用建置與根路徑

- [x] 1.1 將 `vite.config.ts` 的 application base 與 PWA manifest `start_url`、`scope`、`id` 固定為 `/`，並移除 `BASE_URL` 覆寫
- [x] 1.2 建立 `.dockerignore`，排除 Git metadata、dependencies、build output、OpenSpec／agent working files、runner state 與 local environment files
- [x] 1.3 建立 multi-stage application `Dockerfile`，使用固定版本與 digest 的 Node 24 Alpine builder 及 Nginx Alpine runtime
- [ ] 1.4 確認 runtime image 只包含 `dist` 與 Nginx 設定，不包含 Node.js、dependencies 或應用原始碼
- [x] 1.5 設定自動相依更新 PR，使 Node 與 Nginx image tag／digest 可追蹤升版

## 2. Nginx 與應用 Compose

- [x] 2.1 建立 `nginx.conf`，設定 SPA fallback
- [x] 2.2 對 `index.html`、PWA manifest 與 `sw.js` 設定禁止快取，並對 hash assets 設定一年 immutable 快取
- [x] 2.3 加入 CSP、`nosniff`、Referrer-Policy 與 frame 限制，且 CSP 只額外允許 Google Fonts 所需 origins
- [x] 2.4 建立 application `compose.yml`，讓 `bookkeeping` 加入既有 `cloudflared-tunnel-network` external network 且不發布宿主機 port
- [x] 2.5 在 application Compose 加入 `GET /` healthcheck，設定 10 秒 interval、3 次 retries 與 30 秒 start period

## 3. Deployment Runner

- [x] 3.1 建立 runner Dockerfile，下載固定版本的 GitHub 官方 runner release 並驗證固定 SHA-256
- [x] 3.2 實作 runner 啟動流程，支援以短效 token 首次註冊及從 named volume 重用既有設定
- [x] 3.3 建立 `compose.runner.yml`，只加入 `komodo-networks` external network 並保存 runner 設定 volume
- [x] 3.4 驗證 runner service 未使用 privileged mode、Docker socket 或宿主機目錄掛載
- [x] 3.5 建立不含有效憑證的 `.env.runner.example`，並確保 `.env.runner` 不會被提交
- [x] 3.6 設定自動升版 PR，使 runner version 與 checksum 必須成對更新

## 4. GitHub Actions 部署流程

- [x] 4.1 將 `.github/workflows/deploy.yml` 的第一階段改為在 GitHub-hosted runner 使用 Node 24 執行 `npm ci` 與 `npm run build`
- [x] 4.2 新增相依於 validation 成功的 deploy job，在 self-hosted runner 上只呼叫 `KOMODO_WEBHOOK_URL`
- [x] 4.3 確保 deploy job 不 checkout repository、不執行 repository scripts，且 HTTP request 失敗時 workflow 明確失敗
- [x] 4.4 保留 `main` push 與 `workflow_dispatch` triggers，設定最小 permissions
- [x] 4.5 設定 production concurrency，使執行中 deployment 不被取消，且 pending deployment 只保留最新一筆

## 5. 維運文件

- [x] 5.1 記錄 `cloudflared-tunnel-network` 與 `komodo-networks` external network prerequisites、Application Stack、Cloudflare origin 及 Komodo health-gated replacement 設定
- [x] 5.2 記錄 runner 首次註冊、移除短效 token、升版、重建、重新註冊與故障排查流程
- [x] 5.3 記錄 `KOMODO_WEBHOOK_URL` secret、內網 webhook、手動首次部署與自動部署流程
- [x] 5.4 記錄 GitHub Pages cutover、空 IndexedDB 起始條件與舊 commit rebuild 回退流程

## 6. 本機與 CI 驗證

- [x] 6.1 執行 production build，確認輸出使用根路徑且 PWA manifest、Service Worker 與 icons 正常生成
- [ ] 6.2 驗證 application 與 runner Dockerfiles 可建置，兩份 Compose 均可通過 syntax／resolved configuration 檢查
- [ ] 6.3 啟動 application container，確認 healthcheck 成功且 `/` 回傳 2xx
- [ ] 6.4 驗證 SPA fallback、PWA no-cache、hash asset immutable cache 與所有安全標頭
- [ ] 6.5 驗證 CSP 未阻擋 production JavaScript、PWA registration、manifest、images 或 Google Fonts
- [ ] 6.6 檢查 runtime image 不包含 builder dependencies／原始碼，並檢查 runner container 的 networks、mounts 與 privileges 符合設計

## 7. 地端部署與 Cutover

- [ ] 7.1 確認地端已存在 `cloudflared-tunnel-network` 與 `komodo-networks` external networks
- [ ] 7.2 在 repository 仍為 public 且 GitHub Pages 仍運作時，於 Komodo UI 建立 application Stack、build-before-replace 與 health gate
- [ ] 7.3 設定 Cloudflare Tunnel 指向 `http://bookkeeping:80`，由 Komodo UI 手動完成首次部署
- [ ] 7.4 人工驗證 production 網域公開存取、PWA 安裝、更新及離線啟動
- [ ] 7.5 將 GitHub repository 改為 private；確認 Pages 已下線，必要時手動 unpublish
- [ ] 7.6 建置並啟動 Deployment Runner，以 repository-level 短效 token 完成首次註冊後移除 token
- [ ] 7.7 在 Komodo UI 建立僅供 `komodo-networks` network 存取的 webhook，並設定 `KOMODO_WEBHOOK_URL` repository secret
- [ ] 7.8 以 `workflow_dispatch` 驗證自動部署、concurrency、health gate，以及失敗版本不取代現行容器
