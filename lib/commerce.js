// API business logic migrated from the original Worker; server-side only.
const MYSHIP_URL='https://myship.7-11.com.tw/general/detail/GM2505137999911';
function decodeEntities(value){return String(value).replace(/&(?:quot|amp|lt|gt|apos|#39|#x[0-9a-f]+|#\d+);/gi,entity=>{const named={'&quot;':'"','&amp;':'&','&lt;':'<','&gt;':'>','&apos;':"'",'&#39;':"'"};if(named[entity])return named[entity];const raw=entity.slice(2,-1);const n=raw[0].toLowerCase()==='x'?parseInt(raw.slice(1),16):parseInt(raw,10);return Number.isFinite(n)&&n<=0x10ffff?String.fromCodePoint(n):entity;});}
function plainText(value){return decodeEntities(String(value).replace(/<br\s*\/?\s*>|<\/p>/gi,'\n').replace(/<[^>]*>/g,'')).replace(/&nbsp;/g,' ').replace(/\n{3,}/g,'\n\n').trim();}
function parseMyship(html){
 const products=[];
 for(const match of html.matchAll(/data-product="([^"]+)"/g)){
  const item=JSON.parse(decodeEntities(match[1]));
  if(item.Cgdd_Is_Ban===true)continue;
  for(const spec of item.Spec||[]){
   const price=Number(spec.Cgds_SPrice),orig=Number(spec.Cgds_Price);
   if(!Number.isFinite(price)||price<=0)throw Error('商品價格格式改變');
   const name=String(spec.Cgds_Spec||'').trim();if(!name)continue;
   const image=String(spec.Cgds_CgimImagePath||item.GoodsFirstImg||'');
   const photo=/^[\w.-]+$/.test(image)?'https://myship.7-11.com.tw/i/cgdm/GM2505137999911/'+image:'';
   products.push({id:'myship-'+spec.Cgds_Id,name,cat:/優惠|團購/.test(name)?'組合優惠':'單包口味',price,orig:orig>price?orig:null,desc:/團購/.test(name)?'團購需求請先加 LINE 洽詢。':/優惠/.test(name)?'組合優惠，適合分享與囤貨。':'濕式肉感，選一包喜歡的口味。',detail:plainText(item.Cgdd_Product_Description),stock:Number(spec.Inventory)<=0?0:null,hot:false,isNew:false,active:true,specs:[],photos:photo?[photo]:[],source:'myship',sourceUrl:MYSHIP_URL,sourceStock:Math.max(0,Number(spec.Inventory)||0)});
  }
 }
 if(!products.length)throw Error('賣貨便未回傳可辨識商品');
 return [...new Map(products.map(product=>[product.id,product])).values()];
}
let myshipCache=null;
async function fetchMyship({force=false}={}){
 if(!force&&myshipCache&&Date.now()-myshipCache.time<300000)return myshipCache;
 const response=await fetch(MYSHIP_URL,{signal:AbortSignal.timeout(12000),headers:{accept:'text/html'}});
 if(!response.ok)throw Error('賣貨便暫時無法讀取');
 const products=parseMyship(await response.text());
 myshipCache={products,time:Date.now(),updatedAt:new Date().toISOString()};return myshipCache;
}

function authConfig(request,env){
 const clientId=String(env.GOOGLE_CLIENT_ID||'');
 if(!clientId)return Response.json({enabled:false,clientId:null});
 const nonce=crypto.randomUUID();const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
 return Response.json({enabled:true,clientId,nonce},{headers:{'cache-control':'no-store','set-cookie':'ergong_google_nonce='+nonce+'; Path=/api/; HttpOnly; SameSite=Strict; Max-Age=3600'+secure}});
}
let googleKeys=null,googleKeysExpires=0;
async function verifyGoogleBuyer(request,env,token){
 if(!env.GOOGLE_CLIENT_ID)throw new Response('Google 登入尚未啟用，暫時無法下單。',{status:503});
 if(request.headers.get('origin')!==new URL(request.url).origin)throw new Response('不允許的訂單來源。',{status:403});
 if(typeof token!=='string'||token.length>12000)throw new Response('請先使用 Google 帳號登入。',{status:401});
 try{
 const parts=token.split('.');if(parts.length!==3)throw Error();
 const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
 const decode=s=>JSON.parse(new TextDecoder().decode(bytes(s)));
 const header=decode(parts[0]),claims=decode(parts[1]);
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error();
 const now=Math.floor(Date.now()/1000);
 const nonce=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ergong_google_nonce='))?.split('=')[1];
 if(!nonce||claims.nonce!==nonce||claims.aud!==env.GOOGLE_CLIENT_ID||(claims.azp&&claims.azp!==env.GOOGLE_CLIENT_ID)||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||typeof claims.exp!=='number'||claims.exp<=now||typeof claims.iat!=='number'||claims.iat>now+60||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||claims.email_verified!==true||typeof claims.email!=='string'||!claims.email.toLowerCase().endsWith('@gmail.com'))throw Error();
 if(!googleKeys||Date.now()>=googleKeysExpires){const response=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();googleKeys=(await response.json()).keys;googleKeysExpires=Date.now()+3600000;}
 const jwk=googleKeys.find(key=>key.kid===header.kid&&key.kty==='RSA'&&key.alg==='RS256');if(!jwk)throw Error();
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error();
 return {provider:'google',googleSub:claims.sub,email:claims.email,name:typeof claims.name==='string'?claims.name.slice(0,120):'',expiresAt:claims.exp*1000};
 }catch{throw new Response('Google 驗證失敗或已過期，請重新登入 Gmail。',{status:401});}
}

const DEFAULT_PRODUCTS = [{"id":"p1","name":"原味濕式牛肉乾","cat":"經典口味","price":280,"orig":null,"desc":"整塊牛腱慢滷，鹹香回甘。","detail":"選用台灣牛腱心，手切逆紋，低溫濕滷 6 小時。\n不加防腐劑，冷藏保存 14 天、冷凍 3 個月。","stock":40,"hot":true,"isNew":false,"active":true,"specs":[{"n":"100g 袋裝","d":0},{"n":"200g 家庭號","d":220}],"photos":[]},{"id":"p2","name":"黑胡椒濕式牛肉乾","cat":"經典口味","price":300,"orig":null,"desc":"現磨黑胡椒，辛香帶勁。","detail":"馬達加斯加黑胡椒現磨後入滷，辣度溫和。\n冷藏保存 14 天。","stock":26,"hot":true,"isNew":false,"active":true,"specs":[{"n":"100g 袋裝","d":0},{"n":"200g 家庭號","d":240}],"photos":[]},{"id":"p3","name":"麻辣濕式牛肉乾","cat":"重口味","price":320,"orig":null,"desc":"花椒麻香在後段上來。","detail":"漢源花椒＋二荊條，麻多於辣，配酒剛好。","stock":18,"hot":false,"isNew":true,"active":true,"specs":[{"n":"100g 袋裝","d":0},{"n":"200g 家庭號","d":250}],"photos":[]},{"id":"p4","name":"蒜香濕式牛肉乾","cat":"重口味","price":300,"orig":null,"desc":"炸蒜酥拌入，香得很直接。","detail":"現炸蒜酥最後拌入，開袋香氣最明顯。","stock":22,"hot":false,"isNew":false,"active":true,"specs":[{"n":"100g 袋裝","d":0}],"photos":[]},{"id":"p5","name":"沙茶濕式牛肉乾","cat":"經典口味","price":300,"orig":null,"desc":"扁魚沙茶，台味熟悉。","detail":"自製沙茶醬，扁魚與蝦米比例偏重。","stock":0,"hot":false,"isNew":false,"active":true,"specs":[{"n":"100g 袋裝","d":0}],"photos":[]},{"id":"p6","name":"三口味綜合組","cat":"組合包","price":780,"orig":860,"desc":"原味＋黑胡椒＋麻辣，各一包。","detail":"三種 100g 各一包，附提袋，送禮自用都合適。","stock":12,"hot":true,"isNew":false,"active":true,"specs":[],"photos":[]},{"id":"p7","name":"送禮禮盒（六入）","cat":"組合包","price":1580,"orig":1720,"desc":"六包任選，附硬盒與提袋。","detail":"可於備註指定口味組合，未指定則配原味×2、黑胡椒×2、麻辣×2。","stock":8,"hot":false,"isNew":true,"active":true,"specs":[],"photos":[]}];
const DEFAULT_SETTINGS = {"lineUrl":"https://line.me/R/ti/p/@ergong","igUrl":"https://www.instagram.com/ergong_beef.ig/","payUrl":"","payHint":"超商貨到付款","shipFee":120,"freeOver":1500,"cats":["經典口味","重口味","組合包"],"marquee":["滿 NT$1,500 免運","超商冷凍取貨・週一至週四出貨","新口味「麻辣」上架中"],"about":"貳恭做的是濕式牛肉乾——不是嚼到腮幫子痠的那種。\n整塊牛腱心手切逆紋，低溫濕滷 6 小時，咬下去還吃得到肉纖維的濕潤感。\n\n一開始只是滷給家裡人吃，滷太多、朋友一直要，就變成現在這樣。\n沒有加防腐劑，所以保存期短，請冷藏、儘快吃完。"};
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
    database.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)").bind("admin_pw", "", now()),
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
  return {...settings, adminPw: pw?.value || ""};
}

async function getProducts(database, includeInactive = false) {
  if(!includeInactive){const source=await fetchMyship();return source.products;}
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
  if (!password || !settings.adminPw || password !== settings.adminPw) throw new Response("密碼不對，請再試一次。", {status: 401});
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
  return {settings: {...publicSettings(settings), myshipUrl:MYSHIP_URL,cats:["單包口味","組合優惠"]}, products, sync:{source:"myship",updatedAt:myshipCache?.updatedAt,refreshSeconds:300}};
}

async function adminStore(database) {
  const settings = await getSettings(database);
  const products = await getProducts(database, true);
  const orders = await getOrders(database);
  return {settings: publicSettings(settings), products, orders};
}

async function createOrder(database, payload, buyer) {
  const customer = payload?.customer || {};
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const name = String(customer.name || "").trim();
  const tel = String(customer.tel || "").trim();
  const mail = String(buyer.email || "").trim().replace(/＠/g, "@").replace(/s+/g, "");
  const addr = String(customer.addr || "").trim();
  const instagram = String(customer.instagram || "").trim().replace(/^@/, "");
  const emailOk = !mail || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(mail);
  if (!name || !/^09\d{8}$/.test(tel) || !emailOk || !addr || !/^[A-Za-z0-9._]{1,30}$/.test(instagram) || !customer.agree || !items.length) {
    return fail("請確認姓名、手機、IG 帳號、取貨門市、取貨同意與商品內容。");
  }
  const settings = await getSettings(database);
  await fetchMyship({force:true});
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
    if(Number(item.price)!==price)return fail("商品價格已更新，請重新整理購物車後再下單。");
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
    name,tel,mail,instagram,identity:{provider:"google",googleSub:buyer.googleSub,email:buyer.email},ship:"超商冷凍取貨",pay:"超商貨到付款",addr,
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
  if(request.method === "GET" && path === "/api/auth/config")return authConfig(request,env);
  if(request.method === "POST" && path === "/api/auth/google"){
    const payload=await parseJson(request);const buyer=await verifyGoogleBuyer(request,env,payload?.credential);return json({buyer});
  }
  if(request.method === "POST" && path === "/api/orders"){
    const payload=await parseJson(request);const buyer=await verifyGoogleBuyer(request,env,payload?.credential);
    return createOrder(await db(env),payload,buyer);
  }
  const database = await db(env);
  if (request.method === "GET" && path === "/api/store") return json(await publicStore(database));
  if (request.method === "POST" && path === "/api/admin/login") {
    const payload = await parseJson(request);
    await requireAdmin(database, payload?.password);
    return json(await adminStore(database));
  }
  if (request.method === "PUT" && path === "/api/admin/store") return saveAdminStore(database, await parseJson(request));
  const statusMatch = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
  if (request.method === "PATCH" && statusMatch) return updateOrderStatus(database, decodeURIComponent(statusMatch[1]), await parseJson(request));
  return fail("找不到這個 API。", 404);
}

export default {
  async fetch(request, env, ctx) {
    void ctx;
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(request, env, url.pathname);
      return new Response("Not found", {status:404});
    } catch (error) {
      if (error instanceof Response) return fail(await error.text(), error.status);
      return fail("系統暫時無法使用，請稍後再試。", 500);
    }
  },
};