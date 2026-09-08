import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const root = new URL("../", import.meta.url);
const readText = (path) => readFile(new URL(path, root), "utf8");
const readBytes = (path) => readFile(new URL(path, root));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const textAssets = {
  "/": await readText("dist/index.html"),
  "/index.html": await readText("dist/index.html"),
  "/style.css": await readText("dist/style.css"),
  "/app.js": await readText("dist/app.js"),
};

const binaryAssets = {
  "/assets/ergong-icon.svg": (await readBytes("dist/assets/ergong-icon.svg")).toString("base64"),
  "/assets/ergong-touch-icon.png": (await readBytes("dist/assets/ergong-touch-icon.png")).toString("base64"),
};

const products = [
  ["p1","原味濕式牛肉乾","經典口味",280,null,"整塊牛腱慢滷，鹹香回甘。","選用台灣牛腱心，手切逆紋，低溫濕滷 6 小時。\n不加防腐劑，冷藏保存 14 天、冷凍 3 個月。",40,"hot",[{n:"100g 袋裝",d:0},{n:"200g 家庭號",d:220}]],
  ["p2","黑胡椒濕式牛肉乾","經典口味",300,null,"現磨黑胡椒，辛香帶勁。","馬達加斯加黑胡椒現磨後入滷，辣度溫和。\n冷藏保存 14 天。",26,"hot",[{n:"100g 袋裝",d:0},{n:"200g 家庭號",d:240}]],
  ["p3","麻辣濕式牛肉乾","重口味",320,null,"花椒麻香在後段上來。","漢源花椒＋二荊條，麻多於辣，配酒剛好。",18,"new",[{n:"100g 袋裝",d:0},{n:"200g 家庭號",d:250}]],
  ["p4","蒜香濕式牛肉乾","重口味",300,null,"炸蒜酥拌入，香得很直接。","現炸蒜酥最後拌入，開袋香氣最明顯。",22,null,[{n:"100g 袋裝",d:0}]],
  ["p5","沙茶濕式牛肉乾","經典口味",300,null,"扁魚沙茶，台味熟悉。","自製沙茶醬，扁魚與蝦米比例偏重。",0,null,[{n:"100g 袋裝",d:0}]],
  ["p6","三口味綜合組","組合包",780,860,"原味＋黑胡椒＋麻辣，各一包。","三種 100g 各一包，附提袋，送禮自用都合適。",12,"hot",[]],
  ["p7","送禮禮盒（六入）","組合包",1580,1720,"六包任選，附硬盒與提袋。","可於備註指定口味組合，未指定則配原味×2、黑胡椒×2、麻辣×2。",8,"new",[]],
].map(([id,name,cat,price,orig,desc,detail,stock,badge,specs]) => ({
  id,name,cat,price,orig,desc,detail,stock,
  hot:badge === "hot", isNew:badge === "new", active:true, specs, photos:[],
}));

const settings = {
  lineUrl:"https://line.me/R/ti/p/@ergong",
  igUrl:"https://www.instagram.com/ergong_beef.ig/",
  payUrl:"",
  payHint:"超商貨到付款",
  shipFee:120,
  freeOver:1500,
  cats:["經典口味","重口味","組合包"],
  marquee:["滿 NT$1,500 免運","超商冷凍取貨・週一至週四出貨","新口味「麻辣」上架中"],
  about:"貳恭做的是濕式牛肉乾——不是嚼到腮幫子痠的那種。\n整塊牛腱心手切逆紋，低溫濕滷 6 小時，咬下去還吃得到肉纖維的濕潤感。\n\n一開始只是滷給家裡人吃，滷太多、朋友一直要，就變成現在這樣。\n沒有加防腐劑，所以保存期短，請冷藏、儘快吃完。",
};

const worker = `
const TEXT_ASSETS = ${JSON.stringify(textAssets)};
const BINARY_ASSETS = ${JSON.stringify(binaryAssets)};
const CONTENT_TYPES = ${JSON.stringify(contentTypes)};
const DEFAULT_PRODUCTS = ${JSON.stringify(products)};
const DEFAULT_SETTINGS = ${JSON.stringify(settings)};
const STATUSES = new Set(["待確認","備貨中","已出貨","已完成","已取消"]);

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"},
});
const fail = (error, status = 400) => json({error}, status);
const now = () => new Date().toISOString();
const parseJson = async (request) => {
  try { return await request.json(); } catch { return null; }
};

async function db(env) {
  if (!env.DB) throw new Error("Database unavailable");
  await seedIfNeeded(env.DB);
  return env.DB;
}

async function seedIfNeeded(database) {
  const existing = await database.prepare("SELECT value FROM settings WHERE key = ?").bind("shop").first();
  if (existing) return;
  const statements = [
    database.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)").bind("shop", JSON.stringify(DEFAULT_SETTINGS), now()),
    database.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)").bind("admin_pw", "ergong", now()),
    ...DEFAULT_PRODUCTS.map((product, index) =>
      database.prepare("INSERT INTO products (id, data, active, sort_order, updated_at) VALUES (?, ?, ?, ?, ?)")
        .bind(product.id, JSON.stringify(product), product.active ? 1 : 0, index, now())
    ),
  ];
  await database.batch(statements);
}

async function getSettings(database, includePassword = false) {
  const row = await database.prepare("SELECT value FROM settings WHERE key = ?").bind("shop").first();
  const settings = row ? JSON.parse(row.value) : DEFAULT_SETTINGS;
  if (!includePassword) return {...settings, adminPw:""};
  const pw = await database.prepare("SELECT value FROM settings WHERE key = ?").bind("admin_pw").first();
  return {...settings, adminPw: pw?.value || "ergong"};
}

async function getProducts(database, includeInactive = false) {
  const sql = includeInactive
    ? "SELECT data FROM products ORDER BY sort_order ASC, updated_at DESC"
    : "SELECT data FROM products WHERE active = 1 ORDER BY sort_order ASC, updated_at DESC";
  const rows = await database.prepare(sql).all();
  return (rows.results || []).map((row) => JSON.parse(row.data));
}

async function getOrders(database) {
  const rows = await database.prepare("SELECT data FROM orders ORDER BY created_at DESC").all();
  return (rows.results || []).map((row) => JSON.parse(row.data));
}

async function requireAdmin(database, password) {
  const settings = await getSettings(database, true);
  if (!password || password !== settings.adminPw) throw new Response("密碼不對，請再試一次。", {status: 401});
  return settings;
}

function publicSettings(settings) {
  const {adminPw, ...safe} = settings;
  return safe;
}

function cleanProduct(input, index = 0) {
  const id = String(input.id || ("p" + Date.now() + "-" + index)).slice(0, 80);
  const price = Math.max(1, Math.floor(Number(input.price) || 0));
  const stock = input.stock === null || input.stock === "" ? null : Math.max(0, Math.floor(Number(input.stock) || 0));
  return {
    id,
    name:String(input.name || "").trim().slice(0, 120),
    cat:String(input.cat || "經典口味").trim().slice(0, 40),
    price,
    orig:input.orig ? Math.max(0, Math.floor(Number(input.orig) || 0)) : null,
    desc:String(input.desc || "").trim().slice(0, 180),
    detail:String(input.detail || "").slice(0, 1200),
    stock,
    hot:Boolean(input.hot),
    isNew:Boolean(input.isNew),
    active:input.active !== false,
    specs:Array.isArray(input.specs) ? input.specs.map((spec) => ({n:String(spec.n || "").trim().slice(0, 80), d:Math.floor(Number(spec.d) || 0)})).filter((spec) => spec.n) : [],
    photos:Array.isArray(input.photos) ? input.photos.map((photo) => String(photo || "").trim()).filter(Boolean).slice(0, 8) : [],
  };
}

function cleanSettings(input, current) {
  return {
    ...current,
    lineUrl:String(input.lineUrl || "").trim(),
    igUrl:String(input.igUrl || "").trim(),
    payUrl:"",
    payHint:"超商貨到付款",
    shipFee:Math.max(0, Math.floor(Number(input.shipFee) || 0)),
    freeOver:Math.max(0, Math.floor(Number(input.freeOver) || 0)),
    cats:Array.isArray(input.cats) ? input.cats.map((cat) => String(cat || "").trim()).filter(Boolean).slice(0, 30) : current.cats,
    marquee:Array.isArray(input.marquee) ? input.marquee.map((line) => String(line || "").trim()).filter(Boolean).slice(0, 12) : current.marquee,
    about:String(input.about || current.about).slice(0, 2400),
  };
}

async function publicStore(database) {
  const settings = await getSettings(database);
  const products = await getProducts(database, false);
  return {settings: publicSettings(settings), products};
}

async function adminStore(database) {
  const settings = await getSettings(database);
  const products = await getProducts(database, true);
  const orders = await getOrders(database);
  return {settings: publicSettings(settings), products, orders};
}

async function createOrder(database, payload) {
  const customer = payload?.customer || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const name = String(customer.name || "").trim();
  const tel = String(customer.tel || "").trim();
  const mail = String(customer.mail || "").trim().replace(/\uFF20/g, "@").replace(/\s+/g, "");
  const addr = String(customer.addr || "").trim();
  const emailOk = !mail || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/i.test(mail);
  if (!name || !/^09\\d{8}$/.test(tel) || !emailOk || !addr || !customer.agree || !items.length) {
    return fail("請確認姓名、手機、Email、取貨門市、取貨同意與商品內容。");
  }
  const settings = await getSettings(database);
  const products = await getProducts(database, false);
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines = [];
  const counts = new Map();
  let sub = 0;
  for (const item of items) {
    const product = byId.get(String(item.id || ""));
    const qty = Math.max(0, Math.floor(Number(item.qty) || 0));
    if (!product || !qty) return fail("購物車內有商品已下架，請重新整理後再下單。");
    const specName = String(item.spec || "");
    const spec = specName ? (product.specs || []).find((entry) => entry.n === specName) : null;
    if (specName && !spec) return fail("商品規格已更新，請重新選擇後再下單。");
    counts.set(product.id, (counts.get(product.id) || 0) + qty);
    const price = product.price + (spec ? spec.d : 0);
    sub += price * qty;
    lines.push({key:product.id + "|" + specName, id:product.id, spec:specName, price, qty, name:product.name});
  }
  for (const [id, qty] of counts) {
    const product = byId.get(id);
    if (product.stock !== null && product.stock < qty) return fail("「" + product.name + "」庫存不足，請調整數量後再下單。");
  }
  const fee = sub >= settings.freeOver ? 0 : settings.shipFee;
  const order = {
    no:"EG-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(Math.random() * 9000 + 1000),
    name,tel,mail,ship:"超商冷凍取貨",pay:"超商貨到付款",addr,
    note:String(customer.note || "").trim().slice(0, 600),
    items:lines,sub,fee,total:sub + fee,status:"待確認",at:now(),
  };
  const statements = [
    database.prepare("INSERT INTO orders (no, data, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(order.no, JSON.stringify(order), order.status, order.at, order.at),
  ];
  for (const [id, qty] of counts) {
    const product = byId.get(id);
    if (product.stock === null) continue;
    product.stock = Math.max(0, product.stock - qty);
    statements.push(database.prepare("UPDATE products SET data = ?, active = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(product), product.active ? 1 : 0, now(), id));
  }
  await database.batch(statements);
  return json({order, ...(await publicStore(database))});
}

async function saveAdminStore(database, payload) {
  const current = await getSettings(database, true);
  await requireAdmin(database, payload?.password);
  const settings = cleanSettings(payload?.settings || {}, current);
  const products = Array.isArray(payload?.products) ? payload.products.map(cleanProduct).filter((product) => product.name) : [];
  const statements = [
    database.prepare("DELETE FROM products"),
    database.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind("shop", JSON.stringify(settings), now()),
  ];
  if (payload?.settings?.adminPw) {
    statements.push(database.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind("admin_pw", String(payload.settings.adminPw), now()));
  }
  products.forEach((product, index) => {
    statements.push(database.prepare("INSERT INTO products (id, data, active, sort_order, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(product.id, JSON.stringify(product), product.active ? 1 : 0, index, now()));
  });
  await database.batch(statements);
  return json(await adminStore(database));
}

async function updateOrderStatus(database, no, payload) {
  await requireAdmin(database, payload?.password);
  const status = String(payload?.status || "");
  if (!STATUSES.has(status)) return fail("訂單狀態不正確。");
  const row = await database.prepare("SELECT data FROM orders WHERE no = ?").bind(no).first();
  if (!row) return fail("找不到訂單。", 404);
  const order = JSON.parse(row.data);
  order.status = status;
  await database.prepare("UPDATE orders SET data = ?, status = ?, updated_at = ? WHERE no = ?")
    .bind(JSON.stringify(order), status, now(), no).run();
  return json({order});
}

async function handleApi(request, env, path) {
  const database = await db(env);
  if (request.method === "GET" && path === "/api/store") return json(await publicStore(database));
  if (request.method === "POST" && path === "/api/orders") return createOrder(database, await parseJson(request));
  if (request.method === "POST" && path === "/api/admin/login") {
    const payload = await parseJson(request);
    await requireAdmin(database, payload?.password);
    return json(await adminStore(database));
  }
  if (request.method === "PUT" && path === "/api/admin/store") return saveAdminStore(database, await parseJson(request));
  const statusMatch = path.match(/^\\/api\\/admin\\/orders\\/([^/]+)$/);
  if (request.method === "PATCH" && statusMatch) return updateOrderStatus(database, decodeURIComponent(statusMatch[1]), await parseJson(request));
  return fail("找不到這個 API。", 404);
}

function serveAsset(path) {
  if (TEXT_ASSETS[path]) {
    const ext = path === "/" ? ".html" : path.slice(path.lastIndexOf("."));
    return new Response(TEXT_ASSETS[path], {headers: {"content-type": CONTENT_TYPES[ext] || "text/plain; charset=utf-8"}});
  }
  if (BINARY_ASSETS[path]) {
    const ext = path.slice(path.lastIndexOf("."));
    const bytes = Uint8Array.from(atob(BINARY_ASSETS[path]), (char) => char.charCodeAt(0));
    return new Response(bytes, {headers: {"content-type": CONTENT_TYPES[ext] || "application/octet-stream", "cache-control": "public, max-age=31536000"}});
  }
  return null;
}

export default {
  async fetch(request, env, ctx) {
    void ctx;
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url.pathname);
      const asset = serveAsset(url.pathname === "" ? "/" : url.pathname);
      return asset || serveAsset("/") || new Response("Not found", {status:404});
    } catch (error) {
      if (error instanceof Response) return fail(await error.text(), error.status);
      return fail("系統暫時無法使用，請稍後再試。", 500);
    }
  },
};
`;

await mkdir(new URL("dist/server", root), {recursive: true});
await writeFile(new URL("dist/server/index.js", root), worker.trimStart());
