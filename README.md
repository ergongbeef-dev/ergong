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

未設定 Google 或資料庫時禁止正式下單。原 Cloudflare D1 訂單仍在原服務，不會自動匯入或刪除。部署前需另行搬移經授權的資料。

## 商品來源

讀取指定賣貨便公開頁的規格、售價、圖片及說明。伺服器快取與前台輪詢各五分鐘，可能有延遲。不是官方 API 或 webhook，沒有雙向庫存、自動寄件單與選店地圖；來源改版時需維護。門市手動填寫，訂單待店家確認。

## Vercel

匯入儲存庫後選 Next.js，專案根目錄使用本目錄，建置 npm run build。設定以上環境變數後再發布。尚未設定 Git 作者、Git 遠端、Vercel 帳號或正式環境，因此本次沒有 commit、push 或部署。

## Google 最小權限登入（取代 GIS 按鈕）

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

## 訂單 Email 通知

訂單與 order_notifications 的 pending 紀錄在同一筆交易保存，成功後才透過 Resend 通知固定收件人 ergongbeef@gmail.com。
通知內容為收件人姓名、電話、IG、門市、商品、金額、備註，不寄送 Google sub、登入憑證或 Google profile。
需同時啟用 TURSO_DATABASE_URL、TURSO_AUTH_TOKEN、RESEND_API_KEY、ORDER_EMAIL_FROM 後重新部署。
ORDER_EMAIL_FROM 應為 Resend 已驗證的寄件地址；若使用 onboarding@resend.dev，僅能寄至 Resend 帳號擁有者信箱，正式使用應驗證自有寄件網域。
寄信失敗不撤銷訂單，不向買家回報訂單失敗。待寄紀錄不會自動重試，管理員可用 POST /api/admin/orders/{orderNo}/notification 與原後台密碼重試；該端點不對一般買家開放。
Resend 回傳成功代表接受寄送，不代表信件已進入收件匣；需以實際收到的測試信驗證。
完整測試需先完成資料庫與寄信平台帳號、環境變數設定，再使用測試訂單確認保存與 Gmail 收信。
