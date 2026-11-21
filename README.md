# 貳恭 ER GONG — Next.js 商店

Next.js App Router + React，已加入 Vercel 設定。原始靜態版本保留在 dist/ 作為轉換前備份，不是 Next.js 部署入口。

## 開發

```sh
npm ci
npm run dev
npm run build
npm start
npm test
```

預覽：http://127.0.0.1:8765

## 結構

- app/layout.js、page.js、storefront.js：React 頁面外框、導覽與頁尾。
- app/globals.css：目前一頁式響應排版。
- public/storefront.js：保留原生購物控制器；只操作 #app 與彈窗，避免與 React 管理同一子樹。本次為漸進遷移，尚非全元件化 React 商店。
- public/assets：品牌 IP 與其他素材。
- app/api/[...path]/route.js：Next.js 商品同步、Google 身分驗證與訂單 API。
- lib/commerce.js：由舊 Worker 遷出的訂單及後台服務邏輯，僅於伺服器使用。
- lib/database.js：Vercel 可用的 Turso/libSQL 連線介面，沿用原 SQLite 表結構，batch 交易寫入。

## 環境變數

參考 .env.example。不要提交 .env.local 或任何 token。

- GOOGLE_CLIENT_ID：Google Web OAuth client ID。授權 JavaScript 來源需加入本機與未來 Vercel 網域。
- TURSO_DATABASE_URL / TURSO_AUTH_TOKEN：正式資料庫連線。需自行建立/連接服務，並未建立付費帳號或搬移舊資料。
- ADMIN_PASSWORD：若需要啟用既有後台 API，設定強密碼。前台無後台入口，未設定時不可用預設密碼登入。
- SHIP_FEE / FREE_SHIPPING_OVER：預設 250 / 1999。

既有訂單 API 在未設定 Google 或資料庫時禁止寫入訂單；目前前台僅提供賣貨便連結與瀏覽器內的 LINE 草稿，不使用該 API。原 Cloudflare D1 訂單仍在原服務，不會自動匯入或刪除。部署前需另行搬移經授權的資料。

## 商品來源

讀取指定賣貨便公開頁的規格、售價、圖片及說明。伺服器快取與前台輪詢各五分鐘，可能有延遲。不是官方 API 或 webhook，沒有雙向庫存、自動寄件單與選店地圖；來源改版時需維護。門市手動填寫，訂單待店家確認。

## Vercel

匯入儲存庫後選 Next.js，專案根目錄使用本目錄，建置 npm run build。設定以上環境變數後再發布。尚未設定 Git 作者、Git 遠端、Vercel 帳號或正式環境，因此本次沒有 commit、push 或部署。

## 舊版 Google 最小權限登入（後端保留，前台不再使用）

正式 Next.js 入口使用 scripts/google-session.mjs 的 OAuth 2.0 authorization code flow。
授權要求固定為 `scope=openid email`、`include_granted_scopes=false`、`access_type=online`。
不呼叫 userinfo API、不要求 profile、不儲存 access token、refresh token 或原始 ID token。
Google 仍可能在選擇帳號畫面顯示姓名／頭像，或在 ID token 回傳額外 claims；本程式不映射、不持久化、不記錄這些額外欄位。
身分唯一識別使用 Google sub，Email 僅為聯絡資料。
Session Cookie 以 HMAC 簽章且有 HttpOnly、Secure、SameSite=Lax、__Host- 前綴及最多一小時有效期，只含 sub、email、到期時間。
登入交易以 state、nonce、PKCE S256 保護；登出清除 session，下單驗證 session 與 Origin。

部署前設定：
1. Google Cloud → Google Auth Platform → 用戶端 → ERGONG Production → 已授權的重新導向 URI 加入 `https://ergong.vercel.app/api/auth/callback`。
2. 資料存取權只列 openid、email（或 userinfo.email），移除 userinfo.profile 及不需要的 scopes；實際請求仍由程式固定。
3. Vercel → ergong → Environment Variables → Production 新增 `GOOGLE_CLIENT_SECRET`（來自上述用戶端）及 `AUTH_SESSION_SECRET`（以 `openssl rand -hex 32` 產生）；保留原 GOOGLE_CLIENT_ID。
4. `GOOGLE_REDIRECT_URI` 預設上述正式回呼網址；若另設環境必須與 Google 登錄的 HTTPS URL 相同。
5. Redeploy。設定不完整時停用登入，避免回退至要求 profile 的舊方式。
6. 使用一般外部瀏覽器登入，確認 /api/auth/config 的 buyer 僅含 googleSub、email、provider、expiresAt，登出後 buyer 為 null；不能在未實測前宣稱 Google 畫面不顯示姓名／頭像。

測試 `npm test` 包含精確 scope、state、nonce、PKCE、簽章／過期 session、跨站下單拒絕、模擬完整回呼及排除姓名／頭像／token 持久化。

## 訂單通知

依店家要求停用第三方寄信服務，訂單不會透過 Email 自動寄送。訂單保存仍需完成 Turso 資料庫設定。

## 人工接單與顧客備份

目前結帳只在瀏覽器產生草稿，不呼叫 POST /api/orders，不自動清空購物車、不保存個資至瀏覽器儲存空間，也不將草稿送至資料庫。前台不再要求 Google 登入，下載草稿不包含 Google ID／Email。顧客可下載 UTF-8 TXT 或使用瀏覽器列印存 PDF，重新整理會清除暫存草稿。顧客需自行透過 LINE 傳送，店家在 LINE 收件、核對庫存金額後回覆確認。無集中訂單後台，也無法跨裝置查詢歷史訂單。下載檔案包含收件個資，須妥善保管。


## 首頁預先產生與社群分享

- 首頁及 `/products/[id]` 使用 SSG / ISR，每 300 秒重新驗證公開商品資料；失敗時保留版本庫內商品快照。原始 HTML 含品牌、流程、FAQ 與可爬取商品連結。
- 首屏由 `public/home-content.mjs` 共用版型產生。瀏覽器直接讀取預先產生的商品資料，背景 `/api/store` 同步只更新商品區；API 失敗不清空首頁。
- 商品照片存於 `public/assets/products/`（WebP）。執行 `npm run sync:catalog` 可重新同步公開商品照片、對照表與商品快照，檢查差異後隨程式碼發布。新圖片尚未同步時使用本站商品照片備援，不直接引用外部圖床。
- 執行 `npm run image:share` 以既有商品照片及品牌角色重新製作 1200×630 分享圖。Open Graph / Twitter 中使用版本化圖片網址。
- 各商品頁含 Product/Offer JSON-LD；首頁含 Organization。沒有加入未經確認的評價或評分，社群區僅連到官方 Instagram。
- `npm test` 包含原始首頁內容、空商品骨架、HTML/JSON 跳脫、本地圖片及價格結構化資料驗證。發布前另執行 `npm run build`。

## 結帳入口

結帳頁以官方賣貨便賣場連結為主要入口，不附加本站購物車或個資；顧客在賣貨便自行登入及重選商品。亦保留免 Google 登入的 LINE 草稿流程，姓名、手機、IG、門市驗證仍有效，資料只留在目前頁面記憶體。
