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
