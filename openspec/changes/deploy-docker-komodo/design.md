## Context

參見 `proposal.md`。目前 production 由 GitHub Pages workflow 建置並部署，build 時注入 `/bookeeping/` base path。目標環境已有 Komodo、Cloudflare Tunnel，以及兩個用途分離的 Docker external networks：

- `cloudflare`：Cloudflare Tunnel 與應用服務間的流量。
- `komodo`：Deployment Runner 與 Komodo webhook 間的控制流量。

應用資料使用瀏覽器端 IndexedDB。更換 origin 後舊資料不會自動移轉，本次明確接受新站從空資料庫開始。

Repository 必須先由 public 改為 private，才能啟用地端 self-hosted runner。公開 production 網站不使用 Cloudflare Access，並繼續載入 Google Fonts。

## Goals / Non-Goals

**Goals:**

- 建立可重現的 multi-stage application image。
- 以 Nginx 正確提供 SPA、PWA 快取及基本安全標頭。
- 讓應用只透過 `cloudflare` Docker network 提供服務，不發布宿主機 port。
- 以兩階段 CI/CD 驗證 commit，再透過地端 Deployment Runner 通知 Komodo。
- 將 runner 與應用的生命週期、網路及權限分離。
- build 或新容器健康檢查失敗時保留現行服務。
- 提供可重現的 runner bootstrap、升版與 cutover 操作。

**Non-Goals:**

- 不使用 Container Registry。
- 不提供 zero-downtime 或 blue-green deployment。
- 不保留舊版 image；需要回退時重新 build 舊 commit。
- 不移轉舊 GitHub Pages origin 的 IndexedDB 資料。
- 不為公開網站加入 Cloudflare Access。
- 不移除或自託管 Google Fonts。
- 不讓 Deployment Runner 直接操作 Docker。
- 不在宿主機安裝 Node.js。

## Decisions

### 1. Application image

Application `Dockerfile` 使用兩階段建置：

1. 使用仍受支援的 Node 24 Alpine image 執行 `npm ci` 與 production build。
2. 使用穩定 Nginx Alpine image，只複製 `dist` 與 Nginx 設定。

兩個 base images 都使用明確版本 tag 加 digest。自動相依更新工具以 PR 更新引用，避免 build 時無聲取得不同內容。

Runtime image 不包含 Node.js、dependencies、repository metadata 或原始碼。不設定任意的 image size 驗收門檻；驗證重點是內容與分層，而不是壓縮後大小。

`.dockerignore` 排除至少：

- `.git`
- `node_modules`
- `dist`
- OpenSpec／agent working files
- runner state、local environment 與不必要的開發輸出

### 2. Nginx routing、cache 與 security headers

SPA 路由使用：

```nginx
try_files $uri $uri/ /index.html;
```

快取分為兩類：

- `index.html`、PWA manifest、`sw.js`：`no-cache, no-store, must-revalidate`。
- 帶 hash 的 `/assets/`：`public, max-age=31536000, immutable`。

加入以下基本安全標頭：

- Content-Security-Policy
- X-Content-Type-Options: nosniff
- Referrer-Policy
- frame-ancestors 或等效 frame 限制

CSP 預設限制為同源，並只額外開放 Google Fonts 所需的 stylesheet 與 font origins。實作時需以 production build 驗證 Vite module、PWA registration、manifest、圖片及字型均未被 CSP 阻擋。

### 3. Application Compose 與健康檢查

`compose.yml` 只管理 `bookkeeping` application service：

- `restart: unless-stopped`
- 不設定 `ports`
- 加入既有且由外部管理的 `cloudflare` network
- Cloudflare Tunnel origin 指向 `http://bookkeeping:80`

容器透過 HTTP `GET /` 健康檢查 Nginx 與 `index.html`：

- interval：10 秒
- retries：3
- start period：30 秒

Komodo 必須先成功 build 並確認新容器健康，才替換現行容器。單一 service 更新時可接受數秒中斷；若 build 或健康檢查失敗，現行容器保持運作。

### 4. 固定根路徑

`vite.config.ts` 的 application base，以及 PWA manifest 的 `start_url`、`scope`、`id`，全部固定為 `/`。

移除 `BASE_URL` 環境變數覆寫，避免退役的 GitHub Pages `/bookeeping/` path 再次進入 production build。

### 5. 兩階段 GitHub Actions workflow

Workflow 由 `main` push 與 `workflow_dispatch` 觸發：

1. **Validate job**
   - 在 GitHub-hosted runner 執行。
   - checkout、安裝指定 Node 24、執行 `npm ci` 與 `npm run build`。
   - 不部署 artifact；其目的為在進入地端部署前阻擋無法建置的 commit。

2. **Deploy job**
   - 依賴 Validate job 成功。
   - 在 repository-level self-hosted runner 執行。
   - 不 checkout repository，不執行任意 repository script。
   - 只使用 repository secret `KOMODO_WEBHOOK_URL` 發出失敗即中止的 HTTP request。
   - permissions 採最小權限。

Production concurrency group 同時最多一個 running job 及一個 pending job。`cancel-in-progress` 為 false，因此執行中的部署不中斷；新的 queued run 取代較舊的 pending run，以最新 commit 為準。

### 6. Deployment Runner isolation

Repository 在 runner 啟用前改為 private。Runner 註冊於此 repository，workflow 使用預設 `self-hosted` label。

Runner 使用獨立 Dockerfile 與 `compose.runner.yml`，不與 application Compose 共用生命週期。Runner：

- 只加入既有 `komodo` external network。
- 不加入 `cloudflare` network。
- 不使用 privileged mode。
- 不掛載 Docker socket。
- 不掛載宿主機目錄。
- 只保留 runner registration/configuration 的 named volume。
- 只需要 outbound GitHub access 與 internal Komodo webhook access。

Docker build、container replacement、health gate 與 cleanup 均由 Komodo 負責。

### 7. Runner image、註冊與升版

Runner image 從 GitHub 官方 runner release 下載，並校驗固定 SHA-256。版本與 checksum 必須成對更新。

首次啟動：

1. 從 GitHub UI 取得一小時有效的 repository registration token。
2. 將 repository URL 與短效 token 放入不提交的 `.env.runner`。
3. 啟動 runner 並將註冊設定寫入 named volume。
4. 確認 runner online 後，從 `.env.runner` 移除 token。
5. 後續重啟若偵測到既有設定，直接使用 volume，不再次註冊。

Repository 提供 `.env.runner.example`，但不得包含有效 token。自動更新流程提出 runner version／checksum PR，經 CI 與人工合併後才重建 runner image；禁止容器啟動時下載未固定的 `latest`。

### 8. Komodo ownership

Application Compose 保存在 repository；Komodo Stack、webhook、build／replace policy 與 webhook endpoint 在 Komodo UI 建立。

維運文件記錄：

- Stack 對應 repository 與 branch。
- `cloudflare`、`komodo` external network prerequisites。
- webhook 建立與 `KOMODO_WEBHOOK_URL` secret 設定。
- build-before-replace 與 health gate。
- runner bootstrap、升版、重新註冊與故障排查。
- Cloudflare route 與 GitHub Pages cutover。

Komodo 管理 UI 與 webhook 不公開到 Internet；Deployment Runner 透過 `komodo` network 以內部 service name 呼叫。

### 9. 發布、回退與資料邊界

新站保持公開，無 Cloudflare Access。帳本內容仍只位於各訪客自己的 IndexedDB，但瀏覽器會向 Google Fonts 發出第三方請求。

GitHub Pages origin 的 IndexedDB 不移轉，新網域首次啟動建立空資料庫。新網域、PWA 安裝及離線行為驗收完成後，手動停用 GitHub Pages，而不只是刪除 workflow。

不保留舊 application image。若新版本上線後才發現問題：

1. 選定先前可用 Git commit。
2. 由 Komodo checkout 並依該 commit 固定的 base image digests 重新 build。
3. 通過健康檢查後替換故障版本。

## Risks / Trade-offs

- **[短暫停機]** 單一 service 更新可能中斷數秒
  → 接受此成本；PWA 已快取內容仍可離線使用。

- **[回退速度]** 不保留舊 image，回退需要重新 build
  → 使用 Git commit 與固定 base image digests 確保可重建；接受較慢恢復時間。

- **[Runner 風險]** Self-hosted runner 位於地端網路
  → Repository 先轉 private；runner 採 repository scope、無 Docker socket、無 privileged、無主機掛載，且 deploy job 不 checkout 或執行 repository code。

- **[Runner 版本過期]** 固定版本不會在啟動時自行升級
  → 由自動 PR 更新版本與 checksum，納入日常維運。

- **[外部 network 缺失]** `cloudflare` 或 `komodo` 不存在時 Compose 無法啟動
  → 在部署前置檢查與維運文件中明列並驗證。

- **[Google Fonts 隱私與可用性]** 公開站仍會聯絡第三方，首次離線載入可能缺少 web font
  → 視為已接受的產品取捨，CSP 僅放行必要 origins。

- **[資料不連續]** 新 origin 無法讀取舊 Pages IndexedDB
  → 明確接受從空資料庫開始，停用舊站前不進行資料移轉。

- **[PWA 快取鎖死]** 舊 shell 可能延遲取得更新
  → 對 HTML、manifest、Service Worker 禁止快取，僅 hash assets 使用 immutable。

## Migration Plan

1. 確認 `cloudflare` 與 `komodo` external networks 存在。
2. 在 repository 仍為 public、既有 GitHub Pages 仍可用時，於 Komodo UI 建立 application Stack、build-before-replace 與 health gate。
3. 建立 Cloudflare Tunnel route，origin 指向 `http://bookkeeping:80`。
4. 由 Komodo UI 手動執行首次部署。
5. 執行 Compose syntax、container health、cache headers、安全標頭及 PWA 檔案驗證。
6. 人工驗證 production 網域、公開存取、PWA 安裝、更新與離線啟動。
7. 將 GitHub repository 改為 private；確認 GitHub Pages 已自動下線，若方案仍保留 Pages，則手動 unpublish。
8. 建置並啟動 Deployment Runner，完成一次性 repository registration。
9. 在 Komodo UI 建立只供 `komodo` network 使用的內部 webhook。
10. 建立 `KOMODO_WEBHOOK_URL` repository secret，啟用兩階段 GitHub Actions workflow。
11. 以 `workflow_dispatch` 執行首次自動部署並確認 concurrency、health gate 與失敗保留行為。

若新站在第 6 步前驗收失敗，GitHub Pages 保持原狀並修正後重試。Repository 只有在新站驗收成功後才改為 private，因此不依賴付費方案提供 private-repository Pages。若 cutover 後版本故障，依前述舊 commit rebuild 流程回退。
