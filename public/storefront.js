
/* Storefront data is loaded from the hosted database. Cart/favorites stay device-local. */
const SHOP_KEY = 'ergong:shopping:v3';
let DB = null;
let storageAvailable = true;
let sourceSync=null;
let googleBuyer=null,googleConfig=null;
let adminToken = sessionStorage.getItem('ergong:admin') || '';

function seed(){
  const p = (id,name,cat,price,orig,desc,detail,stock,badge,specs)=>({
    id,name,cat,price,orig,desc,detail,stock,
    hot:badge==='hot',isNew:badge==='new',active:true,
    specs:specs||[],photos:[]
  });
  return {
    products:[
      p('p1','原味濕式牛肉乾','經典口味',280,null,'整塊牛腱慢滷，鹹香回甘。','選用台灣牛腱心，手切逆紋，低溫濕滷 6 小時。\n不加防腐劑，冷藏保存 14 天、冷凍 3 個月。',40,'hot',[{n:'100g 袋裝',d:0},{n:'200g 家庭號',d:220}]),
      p('p2','黑胡椒濕式牛肉乾','經典口味',300,null,'現磨黑胡椒，辛香帶勁。','馬達加斯加黑胡椒現磨後入滷，辣度溫和。\n冷藏保存 14 天。',26,'hot',[{n:'100g 袋裝',d:0},{n:'200g 家庭號',d:240}]),
      p('p3','麻辣濕式牛肉乾','重口味',320,null,'花椒麻香在後段上來。','漢源花椒＋二荊條，麻多於辣，配酒剛好。',18,'new',[{n:'100g 袋裝',d:0},{n:'200g 家庭號',d:250}]),
      p('p4','蒜香濕式牛肉乾','重口味',300,null,'炸蒜酥拌入，香得很直接。','現炸蒜酥最後拌入，開袋香氣最明顯。',22,null,[{n:'100g 袋裝',d:0}]),
      p('p5','沙茶濕式牛肉乾','經典口味',300,null,'扁魚沙茶，台味熟悉。','自製沙茶醬，扁魚與蝦米比例偏重。',0,null,[{n:'100g 袋裝',d:0}]),
      p('p6','三口味綜合組','組合包',780,860,'原味＋黑胡椒＋麻辣，各一包。','三種 100g 各一包，附提袋，送禮自用都合適。',12,'hot',[]),
      p('p7','送禮禮盒（六入）','組合包',1580,1720,'六包任選，附硬盒與提袋。','可於備註指定口味組合，未指定則配原味×2、黑胡椒×2、麻辣×2。',8,'new',[])
    ],
    orders:[],
    settings:{
      lineUrl:'https://line.me/R/ti/p/@634xhfoj',
      myshipUrl:'https://myship.7-11.com.tw/general/detail/GM2505137999911',
      igUrl:'https://www.instagram.com/ergong_beef.ig/',
      payUrl:'',
      payHint:'進入付款頁後，請填入下方應付金額並在備註填訂單編號。',
      shipFee:120,
      freeOver:1500,
      cats:['經典口味','重口味','組合包'],
      marquee:['滿 NT$1,500 免運','超商冷凍取貨・週一至週四出貨','新口味「麻辣」上架中'],
      about:'貳恭做的是濕式牛肉乾——不是嚼到腮幫子痠的那種。\n整塊牛腱心手切逆紋，低溫濕滷 6 小時，咬下去還吃得到肉纖維的濕潤感。\n\n一開始只是滷給家裡人吃，滷太多、朋友一直要，就變成現在這樣。\n沒有加防腐劑，所以保存期短，請冷藏、儘快吃完。',
      adminPw:'ergong'
    }
  };
}
const store = {
  async load(){
    try{
      const res = await fetch('/api/store', {headers:{'accept':'application/json'}});
      if(!res.ok) throw new Error('Store unavailable');
      const data = await res.json();
      const base = seed();
      sourceSync=data.sync||null;
      DB = {products:data.products||base.products, settings:{...base.settings,...(data.settings||{})}, orders:[]};
      storageAvailable = true;
    }catch(e){
      DB = seed();
      storageAvailable = false;
      DB.products=[];toast('商品暫時無法更新，請稍後重試或前往賣貨便。');
    }
  },
  async save(){
    if(!isAdmin || !adminToken){toast('請先登入正式後台');return false;}
    try{
      const res=await api('/api/admin/store',{method:'PUT',body:{password:adminToken,products:DB.products,settings:DB.settings}});
      DB={products:res.products,settings:{...seed().settings,...res.settings},orders:res.orders||DB.orders||[]};
      storageAvailable = true;
      return true;
    }catch(e){
      storageAvailable = false;
      if(String(e.message||'').includes('密碼')){
        isAdmin=false;adminToken='';sessionStorage.removeItem('ergong:admin');
      }
      toast(e.message||'資料庫儲存失敗');
      return false;
    }
  }
};

/* ---------- 狀態 ---------- */
let view='home', cur=null, cart=[], favs=[], filter='全部', kw='';
let admView='sum', admEdit=null, isAdmin=false;
let curSpec=0, curQty=1, curPhoto=0;
const NT = n => 'NT$'+Number(n).toLocaleString('en-US');
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arg = value => esc(JSON.stringify(String(value)));
function safeUrl(value){
  if(!value || !String(value).trim()) return '';
  try { const u=new URL(String(value),location.origin); return /^https?:$/.test(u.protocol) ? u.href : ''; }
  catch(e){ return ''; }
}
let lastShoppingJSON='';
function saveShopping(){
  const json=JSON.stringify({cart,favs});
  if(json===lastShoppingJSON)return;
  try { localStorage.setItem(SHOP_KEY,json);lastShoppingJSON=json; } catch(e) {}
}
function savedToast(message){toast(storageAvailable ? message+'（已同步到線上）' : '線上資料庫暫時無法儲存，請稍後再試。');}
async function api(url,{method='GET',body=null}={}){
  const res=await fetch(url,{method,headers:{'content-type':'application/json','accept':'application/json'},body:body?JSON.stringify(body):null});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||'操作失敗，請稍後再試');
  return data;
}
function inCart(id){return cart.filter(i=>i.id===id).reduce((n,i)=>n+i.qty,0);}
function remaining(p){return p.stock===null ? Math.max(0,99-inCart(p.id)) : Math.max(0,p.stock-inCart(p.id));}
function syncCart(){
  const counts = new Map();
  cart = cart.filter(i=>i&&typeof i.id==='string').map(i=>{
    const p=DB.products.find(p=>p.id===i.id && p.active);
    if(!p) return null;
    const spec=(p.specs||[]).find(s=>s.n===i.spec);
    if(i.spec && !spec) return null;
    const max=p.stock===null?99:Math.max(0,p.stock);
    const available=max-(counts.get(p.id)||0);
    const qty=Math.max(0,Math.min(available,Math.floor(Number(i.qty)||0)));
    if(!qty) return null;
    counts.set(p.id,(counts.get(p.id)||0)+qty);
    return {key:p.id+'|'+(spec?spec.n:''),id:p.id,spec:spec?spec.n:'',price:p.price+(spec?spec.d:0),qty};
  }).filter(Boolean);
  favs=favs.filter(id=>DB.products.some(p=>p.id===id));
}

/* ---------- 商品插圖（沒照片時用漫畫風包裝圖） ---------- */
const palette = {'經典口味':['#F26A21','#8C4A22'],'重口味':['#C0392B','#5C2E14'],'組合包':['#24503A','#8C4A22']};
function artFor(p,big){
  const [c1,c2] = palette[p.cat]||['#F26A21','#8C4A22'];
  const t = esc(p.name.replace('濕式牛肉乾','').replace('（六入）','')||'貳恭');
  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(p.name)} 插圖">
    <rect width="300" height="300" fill="${c1}"/>
    <g opacity=".18">${Array.from({length:16},(_,i)=>`<path d="M150 150 L${150+300*Math.cos(i*Math.PI/8)} ${150+300*Math.sin(i*Math.PI/8)} L${150+300*Math.cos((i+.35)*Math.PI/8)} ${150+300*Math.sin((i+.35)*Math.PI/8)} Z" fill="#16110E"/>`).join('')}</g>
    <g transform="translate(150 158)">
      <path d="M-66 -76 h132 a10 10 0 0 1 10 10 v128 a10 10 0 0 1 -10 10 h-132 a10 10 0 0 1 -10 -10 v-128 a10 10 0 0 1 10 -10 z" fill="#F5E7CE" stroke="#16110E" stroke-width="6"/>
      <path d="M-66 -76 h132 v18 h-132 z" fill="${c2}" stroke="#16110E" stroke-width="6"/>
      <rect x="-42" y="-34" width="84" height="52" rx="4" fill="${c2}" stroke="#16110E" stroke-width="5"/>
      ${Array.from({length:7},(_,i)=>`<line x1="${-34+i*11}" y1="-28" x2="${-34+i*11}" y2="12" stroke="#16110E" stroke-width="2" opacity=".45"/>`).join('')}
      <text x="0" y="42" text-anchor="middle" font-family="Anton, Impact, sans-serif" font-size="17" fill="#16110E">ER GONG</text>
      <text x="0" y="64" text-anchor="middle" font-family="'Noto Sans TC',sans-serif" font-weight="900" font-size="${t.length>5?15:20}" fill="#16110E">${t}</text>
    </g>
  </svg>`;
}
function imgOf(p,idx){
  const ph=safeUrl((p.photos||[])[idx||0]);
  return ph?`<img src="${esc(ph)}" alt="${esc(p.name)}" width="300" height="300" loading="lazy" decoding="async" onerror="this.onerror=null;this.replaceWith(document.createTextNode('商品圖片暫時無法載入'))">`:artFor(p);
}

/* ---------- IP 角色（首圖） ---------- */
function mascot(){return `<img class="hero__mascot" src="assets/ergong-ip-chibi-v1.png" alt="貳恭 Q 版品牌 IP：金黃色紋理頭部、棕色牛角，穿著深綠上衣並比讚" width="1145" height="1374" decoding="async" fetchpriority="high">`}

/* =========================================================
   前台畫面
   ========================================================= */
const live = ()=>DB.products.filter(p=>p.active);
const pageViews=['home','shop','product','cart','checkout','done','about','terms','privacy','admin'];
let routeSerial=0;
let checkoutDraft={};
const pageScroll=new Map();
function routeURL(){return location.pathname+location.search+(view==='home'?'':'#'+view+(view==='product'?'='+encodeURIComponent(cur):''));}
function routeSnapshot(){return {ergong:true,route:routeSerial,view,cur,filter,kw,curSpec,curQty,curPhoto};}
function rememberPosition(){
  if(history.state?.ergong){pageScroll.set(history.state.route,window.scrollY);history.replaceState({...history.state,...routeSnapshot()},'');}
}
function rememberCheckout(){
  if(view!=='checkout')return;
  ['f-name','f-tel','f-ig','f-store'].forEach(id=>{const el=document.getElementById(id);if(el)checkoutDraft[id]=el.value;});
  const agree=document.getElementById('f-agree');if(agree)checkoutDraft['f-agree']=agree.checked;
}
function restoreCheckout(){
  if(view!=='checkout')return;
  Object.entries(checkoutDraft).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value;});
  const agree=document.getElementById('f-agree');if(agree)agree.checked=Boolean(checkoutDraft['f-agree']);
}
function closeMenu(){
  document.getElementById('nav').classList.remove('open');
  const button=document.querySelector('.menubtn');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','開啟選單');
}
function jumpSection(id){
  if(view!=='home'){view='home';history.replaceState(routeSnapshot(),'',routeURL());render({preserveScroll:false});}
  closeMenu();document.getElementById(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function go(v,id){
  if(v==='shop'){jumpSection('products');return;}
  if(v==='about'){jumpSection('brand-story');return;}

  rememberCheckout();rememberPosition();
  const previous=view;
  const same=view===v&&(v!=='product'||cur===id);
  view=v; if(id) cur=id;
  if(v==='product'){curSpec=0;curQty=1;curPhoto=0;}
  closeMenu();
  if(!same){routeSerial=Date.now()+Math.random();history.pushState({...routeSnapshot(),returnToCatalog:v==='product'&&['home','shop'].includes(previous)},'',routeURL());}
  render({preserveScroll:false}); window.scrollTo({top:0,behavior:'instant'});
  (document.querySelector('.flow-sheet')||document.getElementById('app')).focus({preventScroll:true});
}
function returnToCatalog(){if(history.state?.returnToCatalog)history.back();else go('shop');}
function updateCartBadge(){
  const n=cart.reduce((a,i)=>a+i.qty,0),badge=document.getElementById('cartBadge');
  badge.textContent=n;badge.classList.toggle('hidden',n===0);
  document.getElementById('cartButton').setAttribute('aria-label',`購物車，目前 ${n} 件`);
}
function render({preserveScroll=true}={}){
  const scrollY=window.scrollY,filterScroll=document.querySelector('.filters')?.scrollLeft||0;
  rememberCheckout();
  clearInterval(mqT); mqT=null;
  syncCart(); saveShopping();
  document.body.dataset.view=view;
  const s=DB.settings;
  [['fabLine',s.lineUrl],['ftLine',s.lineUrl],['ftIg',s.igUrl]].forEach(([id,value])=>{
    const el=document.getElementById(id), url=safeUrl(value);
    el.href=url||'#'; el.hidden=!url;
  });
  document.querySelectorAll('nav.main button').forEach(b=>b.setAttribute('aria-current', b.dataset.v===view?'true':'false'));
  updateCartBadge();
  const V={home:vHome,shop:vShop,product:vProduct,cart:vCart,checkout:vCheckout,done:vDone,about:vAbout,terms:vTerms,privacy:vPrivacy,admin:vAdmin};
  const sheet=!['home','admin'].includes(view);
  document.getElementById('app').innerHTML=sheet?`<div inert>${vHome()}</div>`+`<div class="flow-backdrop" onclick="go('home')"></div><section class="flow-sheet" tabindex="-1" role="dialog" aria-modal="true" aria-label="${view==='product'?'商品詳情':view==='cart'?'購物車':'訂購資訊'}"><div class="flow-top"><span class="en">ER GONG / YOUR ORDER</span><button class="iconbtn" onclick="go('home')" aria-label="關閉訂購視窗">✕</button></div>${(V[view]||vHome)()}</section>`:(V[view]||vHome)();
  document.body.classList.toggle('flow-open',sheet);
  if(sheet)document.querySelector('.flow-sheet').focus({preventScroll:true});
  restoreCheckout();
  const filters=document.querySelector('.filters');if(filters)filters.scrollLeft=filterScroll;
  if(view==='admin') paintAdmin();
  if(view==='checkout')prepareGoogleLogin();
  if(view==='home') startMarquee();
  document.querySelectorAll('.flow-sheet').forEach(el=>el.tabIndex=-1);
  if(preserveScroll)window.scrollTo({top:scrollY,behavior:'instant'});
}

function cardHtml(p){
  const fav=favs.includes(p.id), out=p.stock!==null&&p.stock<=0;
  return `<article class="card">
    <div class="card__img">${imgOf(p)}
      <div class="card__tags">${p.isNew?'<span class="tag tag--new">新品</span>':''}${p.hot?'<span class="tag tag--hot">熱銷</span>':''}</div>
      ${out?'<div class="soldout">已售完</div>':''}
    </div>
    <div class="card__bd">
      <div class="card__nm">${esc(p.name)}</div>
      <div class="card__ds">${esc(p.desc)}</div>
      <div class="card__pr">${NT(p.price)}${p.orig?`<s>${NT(p.orig)}</s>`:''}</div>
      <button class="btn btn--sm card__go" onclick="go('product',${arg(p.id)})" aria-label="查看${esc(p.name)}詳細資訊">選購 →</button>
    </div>
  </article>
  <span style="display:none">${fav}</span>`.replace('<span style="display:none">'+fav+'</span>','');
}
function gridOf(list){
  return list.length?`<div class="grid">${list.map(p=>`<div style="position:relative">${cardHtml(p)}
    <button class="card__fav" data-favorite-id="${esc(p.id)}" aria-pressed="${favs.includes(p.id)}" aria-label="${favs.includes(p.id)?'取消收藏':'收藏'}${esc(p.name)}" title="收藏" onclick="toggleFav(event,${arg(p.id)})">♥</button></div>`).join('')}</div>`
  :`<div class="empty panel"><h3>這裡還沒有商品</h3><p>換個分類或關鍵字再看看。</p><button class="btn" onclick="filter='全部';kw='';go('shop')">看全部商品</button></div>`;
}
function toggleFav(e,id){
  e.stopPropagation();favs=favs.includes(id)?favs.filter(x=>x!==id):[...favs,id];saveShopping();
  if(view==='shop'&&filter==='收藏'){render();return;}
  const p=DB.products.find(p=>p.id===id),selected=favs.includes(id);
  document.querySelectorAll('[data-favorite-id]').forEach(button=>{if(button.dataset.favoriteId===id){button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',(selected?'取消收藏':'收藏')+p.name);}});
}

function vHome(){
 const s=DB.settings;
 return `<div class="hero" id="top"><div class="hero__in">
  <div class="bubble"><span class="eyebrow en">GOOD MEAT. GOOD MOOD.</span><h1><em>貳恭 ER GONG</em>今晚的快樂，<br>來點<span>有肉的。</span></h1><p>咬得到肉的濕式牛肉乾。<br>一包配劇、一包配酒，好好享受每一口。</p><div class="hero__cta"><button class="btn btn--primary" onclick="jumpSection('products')">挑選我的口味 ↘</button><button class="btn" onclick="jumpSection('how-to-order')">怎麼買？</button></div><div class="hero-caption">濕潤肉感 / 濃郁醬香 / 真空包裝</div></div>
  <div class="hero-art hero-art--reviews" aria-label="貳恭品牌風味介紹">
    <div class="review-heading"><span class="en">BIG FLAVOR.<br>GOOD MOOD.</span></div>
    <article class="hero-review hero-review--one"><span class="flavor-kicker">原味派 / ORIGINAL</span><h3>有肉感，<br>才過癮。</h3><p>濕潤肉感 × 濃郁醬香<br>給追劇時光，一點好滋味。</p></article>
    <article class="hero-review hero-review--two"><span class="flavor-kicker">辣味控 / SPICY</span><h3>來點辣，<br>更對味。</h3><p>一包配飲料，一包和朋友分享。</p></article>
    ${mascot()}<span class="review-spark" aria-hidden="true">✦</span>
  </div>
 </div></div>
 <div class="benefit-strip"><span>7‑11 冷凍取貨</span><span>貨到付款</span><span>滿 ${NT(s.freeOver)} 免運</span></div>
 <section class="blk shop-section" id="products"><div class="wrap"><div class="section-label en">01 / PICK YOUR FAVORITE</div><div class="sync-note">${sourceSync?`商品來源：7‑11 賣貨便 · 更新於 ${new Date(sourceSync.updatedAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}`:'商品資訊載入中'}<button onclick="refreshCatalog()" aria-label="重新整理商品">↻ 更新商品</button></div>${vShop().replace('<section class="blk"><div class="wrap">','<div class="shop-inner">').replace('</div></section>','</div>')}</div></section>
 <section class="brand-section" id="brand-story"><div class="wrap brand-layout"><div><span class="section-label en">02 / THE ER GONG WAY</span><h2>肉乾，也可以<br><span>很有肉感。</span></h2></div><div><p class="brand-lead">把日常的小餓，<br>變成值得期待的一口。</p><p>貳恭的濕式牛肉乾，帶著濃郁醬香與濕潤口感。無論是追劇、聚會，還是下班後的小酌時光，拆一包，就很對味。</p><div class="brand-tags"><span>真空包裝</span><span>濕式口感</span><span>冷凍配送</span></div></div></div></section>
 <section class="blk order-guide" id="how-to-order"><div class="wrap"><span class="section-label en">03 / JUST THREE STEPS</span><div class="blk__hd"><h2>想吃，就這麼簡單。</h2></div><div class="steps-grid"><article><b class="en">01</b><h3>挑口味、加購物車</h3><p>選好喜歡的商品與數量，隨時查看訂單金額。</p></article><article><b class="en">02</b><h3>填寫取貨資訊</h3><p>留下姓名、手機、IG 帳號與 7‑11 取貨門市。</p></article><article><b class="en">03</b><h3>到店取貨，再付款</h3><p>確認貨到付款取貨同意，送出訂單，等待店家確認。</p></article></div>
 <div class="myship-panel"><div><span class="en">SHOP YOUR WAY</span><h3>習慣用賣貨便？也可以。</h3><p>喜歡直接在這裡買，就加入購物車；也能透過店家的賣貨便賣場訂購。</p></div>${safeUrl(s.myshipUrl)?`<a class="btn" href="${esc(safeUrl(s.myshipUrl))}" target="_blank" rel="noopener">前往 7‑11 賣貨便 ↗</a>`:`<a class="btn" href="${esc(safeUrl(s.lineUrl))}" target="_blank" rel="noopener">詢問賣貨便連結 ↗</a>`}</div></div></section>
 <section class="blk faq-section" id="faq"><div class="wrap faq-layout"><div><span class="section-label en">04 / BEFORE YOU ORDER</span><h2>買之前，<br>先聊一下。</h2></div><div class="faq-list"><details open><summary>怎麼取貨、怎麼付款？</summary><p>目前使用 7‑11 冷凍取貨、貨到付款。請填寫收件人真實姓名、手機與取貨門市，收到通知後到店付款取貨。</p></details><details><summary>運費怎麼計算？</summary><p>商品金額滿 ${NT(s.freeOver)} 免運，未滿運費 ${NT(s.shipFee)}。購物車會自動計算。</p></details><details><summary>下單後多久出貨？</summary><p>接單後製作，出貨約 3–5 個工作日，實際時間以店家確認為準。</p></details><details><summary>商品有問題，怎麼聯絡？</summary><p>請保留包裝與商品照片，透過 LINE 或 Instagram 聯絡我們。</p></details></div></div></section>
 <section class="closing-banner"><div class="wrap"><span class="en">ONE MORE BITE?</span><h2>把好吃的，帶回日常。</h2><button class="btn btn--primary" onclick="jumpSection('products')">開始挑選 →</button></div></section>`;
}
let mqT=null;
function startMarquee(){
  if(document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const el=document.getElementById('mq'); if(!el) return;
  const list=DB.settings.marquee||[]; if(list.length<2) return;
  let i=0; clearInterval(mqT);
  mqT=setInterval(()=>{i=(i+1)%list.length;el.textContent=list[i];},4800);
}
async function refreshCatalog(){if(view!=='home')return;const old=DB;await store.load();if(!storageAvailable){DB=old;toast('無法更新商品，保留上次內容。');return;}render();toast('商品資訊已更新');}
function selectFilter(value){filter=value;render();document.querySelectorAll('[data-filter]').forEach(button=>{if(button.dataset.filter===value)button.focus({preventScroll:true});});}

function vShop(){
  const s=DB.settings;
  let list=live();
  if(filter==='收藏') list=list.filter(p=>favs.includes(p.id));
  else if(filter!=='全部') list=list.filter(p=>p.cat===filter);
  if(kw) list=list.filter(p=>(p.name+p.desc+p.detail).toLowerCase().includes(kw.toLowerCase()));
  const chip=(v,label)=>`<button class="chip" data-filter="${esc(v)}" aria-pressed="${filter===v}" onclick="selectFilter(${arg(v)})">${esc(label)}</button>`;
  return `<section class="blk"><div class="wrap">
    <div class="blk__hd"><h2>全部商品</h2><p>${list.length} 款${kw?`・關鍵字「${esc(kw)}」`:''}</p></div>
    <div class="filters">
      ${chip('全部','全部')}${[...new Set(live().map(p=>p.cat))].map(c=>chip(c,c)).join('')}${chip('收藏','♥ 我的收藏')}
      ${kw?`<button class="chip" onclick="kw='';render()">清除關鍵字 ✕</button>`:''}
    </div>
    ${gridOf(list)}
  </div></section>`;
}

function vProduct(){
  const p=DB.products.find(x=>x.id===cur);
  if(!p) return vShop();
  const sp=(p.specs||[])[curSpec], price=p.price+(sp?sp.d:0);
  const available=remaining(p), out=available<=0;
  curQty=Math.max(1,Math.min(curQty,available||1));
  const validPhotos=(p.photos||[]).map(safeUrl).filter(Boolean);
  const photos=validPhotos.length?validPhotos:[null];
  return `<section class="blk"><div class="wrap">
    <button class="btn btn--sm" style="margin-bottom:20px" onclick="returnToCatalog()">回商品列表</button>
    <div class="pd">
      <div>
        <div class="pd__main">${photos[curPhoto]?`<img src="${esc(photos[curPhoto])}" alt="${esc(p.name)}" width="600" height="600" decoding="async">`:artFor(p)}</div>
        ${photos.length>1?`<div class="pd__thumbs">${photos.map((ph,i)=>`<button data-photo="${i}" aria-label="查看第 ${i+1} 張商品照片" aria-pressed="${i===curPhoto}" onclick="selectPhoto(${i})">${ph?`<img src="${esc(ph)}" alt="" width="62" height="62" loading="lazy" decoding="async">`:''}</button>`).join('')}</div>`:''}
      </div>
      <div>
        <div style="display:flex;gap:6px;margin-bottom:8px">${p.isNew?'<span class="tag tag--new">新品</span>':''}${p.hot?'<span class="tag tag--hot">熱銷</span>':''}<span class="tag">${esc(p.cat)}</span></div>
        <h1>${esc(p.name)}</h1>
        <div class="price-big"><span id="product-price" aria-live="polite">${NT(price)}</span>${p.orig?`<s>${NT(p.orig)}</s>`:''}</div>
        <p class="intro-note">${esc(p.desc)}</p>
        ${p.specs&&p.specs.length?`<div class="lbl">規格</div><div class="spec-row">${p.specs.map((x,i)=>`<button data-spec="${i}" aria-pressed="${i===curSpec}" onclick="selectSpec(${i})">${esc(x.n)}${x.d?`（+${NT(x.d)}）`:''}</button>`).join('')}</div>`:''}
        <div class="lbl">數量</div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div class="qty"><button id="product-minus" onclick="setProductQuantity(-1)" aria-label="減少數量" ${curQty<=1?'disabled':''}>−</button><span id="product-quantity" aria-live="polite">${curQty}</span><button id="product-plus" onclick="setProductQuantity(1)" aria-label="增加數量" ${curQty>=available?'disabled':''}>＋</button></div>
          <span id="product-available" class="stock-note">${available>0?`${p.stock===null?'庫存由店家確認':`可再加入 ${available} 份`}`:p.stock>0?'已達可加入數量':'目前售完'}</span>
        </div>
        <div class="product-actions" style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
          <button id="product-add" class="btn btn--primary" ${out?'disabled':''} onclick="addCart(${arg(p.id)})">${out&&p.stock>0?'已達可加入數量':'加入購物車'}</button>
          <button class="btn" onclick="go('cart')">查看購物車 →</button>
          <button class="btn" data-favorite-id="${esc(p.id)}" aria-pressed="${favs.includes(p.id)}" aria-label="${favs.includes(p.id)?'取消收藏':'收藏'}${esc(p.name)}" onclick="toggleFav(event,${arg(p.id)})">♥ 收藏</button>
        </div>
        <details class="pd__meta"><summary>商品說明、成分與保存方式</summary><div>${esc(p.detail)}</div></details>
      </div>
    </div>
  </div></section>`;
}
function updateProductControls(){
  if(view!=='product')return;
  const p=DB.products.find(p=>p.id===cur);if(!p)return;
  const available=remaining(p),sp=(p.specs||[])[curSpec];
  curQty=Math.max(1,Math.min(curQty,available||1));
  document.getElementById('product-price').textContent=NT(p.price+(sp?sp.d:0));
  document.getElementById('product-quantity').textContent=curQty;
  document.getElementById('product-minus').disabled=curQty<=1;
  document.getElementById('product-plus').disabled=curQty>=available;
  document.getElementById('product-available').textContent=available>0?`${p.stock===null?'庫存由店家確認':`可再加入 ${available} 份`}`:p.stock>0?'已達可加入數量':'目前售完';
  const add=document.getElementById('product-add');add.disabled=available<=0;add.textContent=available>0?'加入購物車':p.stock>0?'已達可加入數量':'目前售完';
}
function setProductQuantity(delta){curQty+=delta;updateProductControls();}
function selectSpec(index){curSpec=index;document.querySelectorAll('[data-spec]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.spec)===index)));updateProductControls();}
function selectPhoto(index){
  const p=DB.products.find(p=>p.id===cur),photos=(p?.photos||[]).map(safeUrl).filter(Boolean);if(!photos[index])return;
  curPhoto=index;const image=document.querySelector('.pd__main img');if(image)image.src=photos[index];
  document.querySelectorAll('[data-photo]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.photo)===index)));
}
function addCart(id){
  const p=DB.products.find(x=>x.id===id);
  if(!p||!p.active) return;
  const qty=Math.floor(Number(curQty));
  if(!Number.isFinite(qty)||qty<1||qty>remaining(p)){toast('已達目前可加入的數量');return;}
  const sp=(p.specs||[])[curSpec];
  const key=id+'|'+(sp?sp.n:'');
  const ex=cart.find(i=>i.key===key);
  if(ex) ex.qty+=qty;
  else cart.push({key,id,spec:sp?sp.n:'',price:p.price+(sp?sp.d:0),qty});
  syncCart();saveShopping();updateCartBadge();updateProductControls();toast(`已加入購物車：${p.name}`);
}
function setQty(key,d){
  const i=cart.find(x=>x.key===key); if(!i)return;
  const p=DB.products.find(x=>x.id===i.id);
  if(d>0 && (!p||remaining(p)<d)){toast('已達目前可加入的數量');return;}
  i.qty+=d; if(i.qty<=0) cart=cart.filter(x=>x.key!==key);
  updateCartView();
}
function removeCart(key){cart=cart.filter(i=>i.key!==key);updateCartView();}
const subTotal=()=>cart.reduce((a,i)=>a+i.price*i.qty,0);
const shipOf=t=>t>=DB.settings.freeOver?0:(t>0?DB.settings.shipFee:0);

function vCart(){
  if(!cart.length) return `<section class="blk"><div class="wrap"><div class="empty panel">
    <h3>購物車還是空的</h3><p>挑幾包再回來吧。</p>
    <button class="btn btn--primary" onclick="go('shop')">去看商品</button></div></div></section>`;
  const st=subTotal(), sh=shipOf(st);
  return `<section class="blk"><div class="wrap">
    <div class="blk__hd"><h2>購物車</h2><p id="cart-count" aria-live="polite">${cart.reduce((a,i)=>a+i.qty,0)} 件</p></div>
    <div class="two">
      <div id="cart-lines" class="panel" style="padding:6px 20px">
        ${cart.map(i=>{const p=DB.products.find(x=>x.id===i.id);return `<div class="line" data-cart-key="${esc(i.key)}">
          <div class="line__im">${imgOf(p)}</div>
          <div><div class="line__nm">${esc(p.name)}</div>
            ${i.spec?`<div class="line__sp">${esc(i.spec)}</div>`:''}
            <div class="line__sp" data-unit-price>${NT(i.price)} × ${i.qty}</div>
            <div class="qty" style="margin-top:8px">
              <button onclick="setQty(${arg(i.key)},-1)" aria-label="減少${esc(p.name)}數量">−</button><span data-quantity aria-live="polite">${i.qty}</span><button data-increase onclick="setQty(${arg(i.key)},1)" aria-label="增加${esc(p.name)}數量" ${remaining(p)<=0?'disabled':''}>＋</button></div>
          </div>
          <div style="text-align:right"><b data-line-total>${NT(i.price*i.qty)}</b><br>
            <button class="btn btn--sm" style="margin-top:8px" onclick="removeCart(${arg(i.key)})">移除</button></div>
        </div>`}).join('')}
      </div>
      <div id="cart-summary" class="panel sum">${cartSummary()}</div>
    </div>
  </div></section>`;
}
function cartSummary(){
  const st=subTotal(),sh=shipOf(st);
  return `
        <div class="sum__r"><span>商品小計</span><b>${NT(st)}</b></div>
        <div class="sum__r"><span>運費</span><b>${sh?NT(sh):'免運'}</b></div>
        ${sh?`<div style="font-size:0.8125rem;color:var(--jerky)">再買 ${NT(DB.settings.freeOver-st)} 就免運</div>`:''}
        <div class="sum__r sum__r--tot"><span>應付金額</span><b>${NT(st+sh)}</b></div>
        <button class="btn btn--primary btn--full" style="margin-top:16px" onclick="go('checkout')">下單去</button>
        <button class="btn btn--full btn--sm" style="margin-top:10px" onclick="go('shop')">繼續逛</button>
      `;
}
function updateCartView(){
  syncCart();saveShopping();updateCartBadge();
  if(view!=='cart')return;
  if(!cart.length){render();document.getElementById('app').focus({preventScroll:true});return;}
  const focused=document.activeElement;
  document.querySelectorAll('[data-cart-key]').forEach(row=>{
    const item=cart.find(i=>i.key===row.dataset.cartKey);
    if(!item){row.remove();return;}
    const product=DB.products.find(p=>p.id===item.id);
    row.querySelector('[data-quantity]').textContent=item.qty;
    row.querySelector('[data-unit-price]').textContent=NT(item.price)+' × '+item.qty;
    row.querySelector('[data-line-total]').textContent=NT(item.price*item.qty);
    row.querySelector('[data-increase]').disabled=remaining(product)<=0;
  });
  document.getElementById('cart-count').textContent=cart.reduce((n,i)=>n+i.qty,0)+' 件';
  document.getElementById('cart-summary').innerHTML=cartSummary();
  if(focused&&!focused.isConnected)document.querySelector('#cart-lines button')?.focus({preventScroll:true});
}

function vCheckout(){
  if(!cart.length) return vCart();
  const st=subTotal(), sh=shipOf(st);
  return `<section class="blk"><div class="wrap">
    <div class="blk__hd"><h2>最後一步，把美味送到你身邊。</h2><p>7‑11 冷凍取貨・貨到付款</p></div>
    <div class="two">
      <div class="panel" style="padding:24px">
        <div class="google-buyer"><span class="section-label">01 / 驗證下單帳號</span><h3>使用 Google 帳號登入</h3><p>訂單將綁定你驗證過的 Gmail，方便店家核對購買資訊。不會讀取你的信件。</p><div id="google-login-status" role="status">正在確認登入服務…</div><div id="google-signin-button"></div></div>
        <div class="field"><label for="f-name">收件人姓名</label><input id="f-name" autocomplete="name" placeholder="例：王小明"><small>請務必使用真實姓名。</small></div>
        <div class="field"><label for="f-tel">手機號碼</label><input id="f-tel" inputmode="tel" autocomplete="tel" placeholder="09xxxxxxxx"><small>請務必使用真實電話，方便取貨與聯絡。</small></div>
        <div class="field"><label for="f-ig">Instagram 帳號</label><input id="f-ig" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="31" placeholder="例：@your_account" required><small>方便店家聯絡與確認訂單，請填寫可搜尋的帳號。</small></div>
        <div class="field"><span class="field-label">配送方式</span>
          <div class="payment-choice" aria-label="配送方式：超商冷凍取貨">
            <span class="payment-check" aria-hidden="true">✓</span>
            <span><b>超商冷凍取貨</b><small>目前統一使用超商取貨，請填寫指定門市。</small></span>
          </div>
        </div>
        <div class="field" id="wrap-store"><label for="f-store">取貨門市</label><input id="f-store" placeholder="例：7-ELEVEN 板橋門市 / 店號"></div>
        <div class="field"><span class="field-label">付款方式</span>
          <div class="payment-choice" aria-label="付款方式：超商貨到付款">
            <span class="payment-check" aria-hidden="true">✓</span>
            <span><b>超商貨到付款</b><small id="payment-note">到指定超商取貨時，於門市付款。</small></span>
          </div>
        </div>

        <div class="field">
          <label class="checkline"><input id="f-agree" type="checkbox">我確認以上收件資訊正確，並同意於收到通知後，至指定 7‑11 門市付款並取貨。</label>
        </div>
        <div id="ckErr" role="alert" aria-live="polite"></div>
        <button class="btn btn--primary btn--full" id="submit-order" ${googleBuyer&&googleBuyer.expiresAt>Date.now()?'':'disabled'} onclick="submitOrder()">${googleBuyer?'確認貨到付款訂單':'請先登入 Google 再下單'}</button>
        <p style="font-size:0.78125rem;color:#6b5b4d;margin-top:10px">送出後由店家確認庫存及出貨；取貨時付款，本網站不會要求輸入信用卡。</p>
      </div>
      <div class="panel sum">
        <h3 style="font-size:1.0625rem;margin-bottom:10px">訂單內容</h3>
        ${cart.map(i=>{const p=DB.products.find(x=>x.id===i.id);return `<div class="sum__r"><span>${esc(p.name)}${i.spec?`・${esc(i.spec)}`:''} ×${i.qty}</span><b>${NT(i.price*i.qty)}</b></div>`}).join('')}
        <div class="sum__r"><span>運費</span><b>${sh?NT(sh):'免運'}</b></div>
        <div class="sum__r"><span>配送方式</span><b>超商冷凍取貨</b></div>
        <div class="sum__r"><span>付款方式</span><b>超商貨到付款</b></div>
        <div class="sum__r sum__r--tot"><span>應付金額</span><b>${NT(st+sh)}</b></div>
      </div>
    </div>
  </div></section>`;
}
function toggleShip(){
  const note=document.getElementById('payment-note');if(note)note.textContent='到指定超商取貨時，於門市付款。';
}
let lastOrder=null;
async function submitOrder(){
  if(!cart.length) return;
  if(!googleBuyer||googleBuyer.expiresAt<=Date.now()){googleBuyer=null;prepareGoogleLogin();toast('請先登入 Google 帳號。');return;}
  const g=id=>document.getElementById(id).value.trim();
  const ship='超商冷凍取貨';
  const instagram=g('f-ig').replace(/^@/,'');
  const agree=document.getElementById('f-agree')?.checked;
  const igOk=/^[A-Za-z0-9._]{1,30}$/.test(instagram);
  const o={name:g('f-name'),tel:g('f-tel'),mail:googleBuyer.email,instagram,ship,pay:'超商貨到付款',
    addr:g('f-store'),note:'',agree};
  const miss=[];
  if(!o.name) miss.push('收件人姓名');
  if(!/^09\d{8}$/.test(o.tel)) miss.push('正確的手機號碼');
  if(!igOk) miss.push('正確的 IG 帳號');
  if(!o.addr) miss.push('取貨門市');
  if(!o.agree) miss.push('取貨同意');
  const box=document.getElementById('ckErr');
  if(miss.length){ box.innerHTML=`<div class="err">還缺：${miss.join('、')}</div>`; box.scrollIntoView({block:'center'}); return; }
  const submit=document.getElementById('submit-order');if(submit.disabled)return;submit.disabled=true;submit.textContent='正在送出…';
  try{
    const res=await api('/api/orders',{method:'POST',body:{customer:o,items:cart}});
    lastOrder=res.order;
    DB.products=res.products||DB.products;
    cart=[]; saveShopping(); go('done'); checkoutDraft={};
  }catch(e){
    submit.disabled=false;submit.textContent='重新送出訂單';
    box.innerHTML=`<div class="err">${esc(e.message||'訂單送出失敗，請稍後再試。')}</div>`;
    box.scrollIntoView({block:'center'});
  }
}
function orderText(o){
  return ['貳恭 ER GONG 訂單明細','訂單編號：'+o.no,'姓名：'+o.name,'電話：'+o.tel,o.mail?'Google 登入帳號：'+o.mail:'',o.instagram?'IG：@'+o.instagram:(o.mail?'Email：'+o.mail:''),
    '配送：'+o.ship+'／'+o.addr,'付款：'+(o.pay||'超商貨到付款'),'—',
    ...o.items.map(i=>`${i.name}${i.spec?'・'+i.spec:''} ×${i.qty}　${NT(i.price*i.qty)}`),
    '運費：'+(o.fee?NT(o.fee):'免運'),'應付金額：'+NT(o.total),
    o.note?'備註：'+o.note:'','請回覆確認庫存與出貨日期，謝謝。'].filter(Boolean).join('\n');
}
function vDone(){
  const o=lastOrder; if(!o) return vHome();
  const line=safeUrl(DB.settings.lineUrl);
  return `<section class="blk"><div class="wrap"><div class="panel done">
    <h2>${o.preview?'預覽訂單已產生':'訂單已送出，等待確認'}</h2>${o.preview?'<p class="note">這是預覽測試，沒有建立正式訂單，也沒有通知店家。</p>':''}
    <div class="ordno">${o.no}</div>
    <p style="margin:0">應付金額 <b style="font-size:1.375rem">${NT(o.total)}</b></p>
    <p class="done-payment">付款方式：<b>${esc(o.pay||'超商貨到付款')}</b></p>
    <div class="steps">
      <b>下一步</b>
      請複製訂單明細並傳到貳恭 LINE，收到我們回覆確認後，訂單才會正式成立。
      <b>付款方式</b>
      顧客到指定超商取貨時，於門市付款。
    </div>
    <div style="margin-top:22px;text-align:left">
      <div class="lbl">訂單明細</div>
      <div class="copybox" id="ordTx">${esc(orderText(o))}</div>
      <div style="display:flex;gap:10px;margin-top:10px">
        <button class="btn btn--primary btn--sm" onclick="sendLineOrder()">複製並開啟 LINE</button>
        <button class="btn btn--sm" onclick="copyOrder()">只複製明細</button>
        <button class="btn btn--sm" onclick="go('shop')">繼續逛</button>
      </div>
      ${line?`<p style="font-size:0.78125rem;color:#6b5b4d;margin-top:10px">若 LINE 沒有自動貼上，請手動貼上剛剛複製的訂單明細。</p>`:`<p style="font-size:0.78125rem;color:#6b5b4d;margin-top:10px">尚未設定 LINE 連結，請先複製訂單明細後私訊店家。</p>`}
    </div>
  </div></div></section>`;
}
async function copyOrder(){
  const t=document.getElementById('ordTx').textContent;
  try { if(!navigator.clipboard) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(t); toast('訂單明細已複製'); }
  catch(e){const range=document.createRange();range.selectNodeContents(document.getElementById('ordTx'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);toast('已選取明細，請手動複製');}
}
async function sendLineOrder(){
  await copyOrder();
  const line=safeUrl(DB.settings.lineUrl);
  if(line)window.open(line,'_blank','noopener');
}

function vAbout(){
  const s=DB.settings;
  return `<section class="blk"><div class="wrap doc">
    <h2>關於貳恭</h2><div class="diamond">◆ ◇ ◆</div>
    <div class="readable-copy">${esc(s.about)}</div>
    <div class="note" style="margin-top:26px">
      有問題最快是 LINE 私訊，或到 Instagram 找我們。
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
        <a class="btn btn--line btn--sm" href="${esc(safeUrl(s.lineUrl))}" target="_blank" rel="noopener">加 LINE 好友</a>
        <a class="btn btn--sm" href="${esc(safeUrl(s.igUrl))}" target="_blank" rel="noopener">看 Instagram</a>
      </div>
    </div>
  </div></section>`;
}
function vTerms(){
  const s=DB.settings;
  return `<section class="blk"><div class="wrap doc">
    <h2>購買須知</h2><p class="section-kicker">下單前請先看過</p><div class="diamond">◆ ◇ ◆</div>
    <h4>製作與出貨</h4>
    <ul>
      <li>全品項為接單後製作，一般 3–5 個工作日內出貨；遇連假或大量訂單會於 LINE 公告。</li>
      <li>目前統一使用超商冷凍取貨。</li>
    </ul>
    <h4>運費</h4>
    <ul><li>單筆滿 ${NT(s.freeOver)} 免運，未滿收 ${NT(s.shipFee)}。</li></ul>
    <h4>保存</h4>
    <ul>
      <li>不加防腐劑，冷藏 14 天內食用完畢，冷凍可放 3 個月。</li>
      <li>收到後請立即冷藏或冷凍，開封後請盡快吃完。</li>
    </ul>
    <h4>退換貨</h4>
    <ul>
      <li>退換貨需求請透過 LINE 聯繫，依商品實際保存條件及適用規定辦理。</li>
      <li>若收到商品有破損、變質或漏寄，請保留包裝與照片，儘速透過 LINE 聯繫我們協助處理。</li>
    </ul>
    <h4>付款</h4>
    <ul>
      <li>付款方式為超商貨到付款：顧客於指定超商取貨時付款。</li>
      <li>送出後請將訂單明細傳到貳恭 LINE，收到回覆確認後訂單才會成立。</li>
    </ul>
    <h4>發票</h4>
    <ul><li>需要統編請於訂單備註填寫公司名稱與統編。</li></ul>
  </div></section>`;
}
function vPrivacy(){
  return `<section class="blk"><div class="wrap doc">
    <h2>隱私權政策</h2><p style="color:var(--jerky);font-weight:700;margin-top:4px">訂單資料的使用方式</p><div class="diamond">◆ ◇ ◆</div>
    <h4>商品、設定與購物車</h4>
    <p>商品設定、購物車和收藏會保存在目前瀏覽器，用於瀏覽與下單。</p>
    <h4>取貨訂單資料</h4>
    <p>正式下單時，姓名、電話、IG 帳號、取貨門市、訂單明細，以及經 Google 驗證的 Gmail 與帳號識別碼，會提交至貳恭的訂單資料庫，用於核對身分、訂單聯絡與履約。訂單成功保存後，收件人姓名、電話、IG、取貨門市及訂單明細會經由 Resend 寄送通知給店家；通知不包含 Google 帳號識別碼或登入憑證。網站不會自動扣款。</p>
    <h4>外部連結與圖片</h4>
    <p>Google 登入由 Google 提供；本網站僅保留 Google 帳號識別碼與 email，不儲存 Google 姓名或頭像，也不取得 Gmail 密碼、信件或聯絡人。收件人姓名由你在結帳時另外填寫，僅用於配送。登入以 HttpOnly、Secure Cookie 維持，Google 憑證不寫入購物車、localStorage 或日誌。點選 LINE、Instagram 會前往各服務；字型由 Google Fonts 載入。若你設定外部商品照片網址，瀏覽器會向該圖片網站載入照片。</p>
    <h4>清除本機資料</h4>
    <p>你可以在瀏覽器設定中清除此網站的網站資料，還原本機的商品設定、購物車與收藏。</p>
  </div></section>`;
}

/* ---------- 搜尋 ---------- */
function openSearch(){
  modal(`<h3>搜尋商品</h3><form onsubmit="event.preventDefault();runSearch()">
    <div class="field"><label for="sk">口味或商品名稱</label><input id="sk" placeholder="例：黑胡椒、綜合組" value="${esc(kw)}"></div>
    <button type="submit" class="btn btn--primary btn--full">搜尋</button></form>`);
  setTimeout(()=>document.getElementById('sk')?.focus(),40);
}
function runSearch(){kw=document.getElementById('sk').value.trim();closeModal();filter='全部';go('shop');}

/* =========================================================
   後台
   ========================================================= */
function adminGate(){
  if(isAdmin){ go('admin'); return; }
  modal(`<h3>正式後台登入</h3><p class="note">登入後可修改商品、網站設定與訂單狀態，變更會同步到線上資料庫。</p><form onsubmit="event.preventDefault();tryLogin()">
    <div class="field"><label for="pw">後台密碼</label><input id="pw" type="password" autocomplete="current-password"><small>初始密碼 ergong，登入後請到「網站設定」更改。</small></div>
    <div id="pwErr"></div>
    <button type="submit" class="btn btn--primary btn--full">登入後台</button></form>`);
  setTimeout(()=>document.getElementById('pw')?.focus(),40);
}
async function tryLogin(){
  const password=document.getElementById('pw').value;
  const err=document.getElementById('pwErr');
  try{
    const data=await api('/api/admin/login',{method:'POST',body:{password}});
    adminToken=password;sessionStorage.setItem('ergong:admin',password);
    DB={products:data.products,settings:{...seed().settings,...data.settings},orders:data.orders||[]};
    isAdmin=true; closeModal(); go('admin');
  }catch(e){err.innerHTML=`<div class="err">${esc(e.message||'密碼不對，再試一次。')}</div>`;}
}
function vAdmin(){
  if(!isAdmin) return vHome();
  const nav=[['sum','總覽'],['prod','商品管理'],['ord','訂單管理'],['set','網站設定']];
  return `<section class="blk"><div class="wrap">
    <div class="blk__hd"><h2>正式後台</h2><p>商品、設定與訂單會同步到線上資料庫</p>
      <button class="btn btn--sm" onclick="logoutAdmin()">登出後台</button></div>
    <p class="note">商品修改後，前台會立即讀取最新資料；訂單送出後會出現在這裡。</p><div class="adm">
      <div class="adm__nav">${nav.map(([k,l])=>`<button aria-current="${admView===k}" onclick="admView='${k}';render()">${l}</button>`).join('')}</div>
      <div class="adm__bd" id="admBody"></div>
    </div>
  </div></section>`;
}
function logoutAdmin(){isAdmin=false;adminToken='';sessionStorage.removeItem('ergong:admin');store.load().then(()=>go('home'));}
function paintAdmin(){
  const el=document.getElementById('admBody'); if(!el) return;
  el.innerHTML=({sum:aSum,prod:aProd,ord:aOrd,set:aSet}[admView]||aSum)();
}
function aSum(){
  const o=DB.orders, rev=o.filter(x=>x.status==='已完成').reduce((a,x)=>a+x.total,0);
  const low=DB.products.filter(p=>p.stock!==null&&p.stock<=5&&p.active);
  return `<h3 style="font-size:1.25rem;margin-bottom:16px">總覽</h3>
  <div class="kpis">
    <div class="kpi"><b>${o.length}</b><span>正式訂單</span></div>
    <div class="kpi"><b>${o.filter(x=>x.status==='待確認').length}</b><span>待確認</span></div>
    <div class="kpi"><b>${NT(rev)}</b><span>完成金額</span></div>
    <div class="kpi"><b>${DB.products.filter(p=>p.active).length}</b><span>上架商品</span></div>
  </div>
  ${low.length?`<div class="note" style="margin-bottom:18px"><b>庫存快沒了：</b>${low.map(p=>`${esc(p.name)}（${p.stock}）`).join('、')}</div>`:''}
  <h4 style="font-size:1rem;margin-bottom:8px">最新訂單</h4>
  ${o.length?`<div class="tbl-wrap"><table><thead><tr><th>編號</th><th>收件人</th><th>金額</th><th>狀態</th></tr></thead>
  <tbody>${o.slice(0,6).map(x=>`<tr><td><b>${x.no}</b></td><td>${esc(x.name)}</td><td>${NT(x.total)}</td><td>${statTag(x.status)}</td></tr>`).join('')}</tbody></table></div>`
  :'<p style="color:#6b5b4d">還沒有訂單。客人送出訂單後會出現在這裡。</p>'}`;
}
const statTag=s=>`<span class="stat ${({'待確認':'s-wait','備貨中':'s-paid','已出貨':'s-ship','已完成':'s-done','已取消':'s-cancel'})[s]||'s-wait'}">${s}</span>`;

function aProd(){
  return `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
    <h3 style="font-size:1.25rem">商品管理</h3>
    <button class="btn btn--sm btn--primary" style="margin-left:auto" onclick="editProd(null)">新增商品</button>
  </div>
  <div class="tbl-wrap"><table>
    <thead><tr><th style="width:52px"></th><th>商品</th><th>分類</th><th>售價</th><th>庫存</th><th>狀態</th><th></th></tr></thead>
    <tbody>${DB.products.map(p=>`<tr>
      <td><div style="width:44px;height:44px;border:2px solid var(--ink);overflow:hidden">${imgOf(p)}</div></td>
      <td><b>${esc(p.name)}</b>${p.hot?' <span class="tag tag--hot">熱銷</span>':''}${p.isNew?' <span class="tag tag--new">新</span>':''}</td>
      <td>${esc(p.cat)}</td><td>${NT(p.price)}</td>
      <td>${p.stock===null?'不限':p.stock}</td>
      <td>${p.active?'<span class="stat s-paid">上架</span>':'<span class="stat s-done">下架</span>'}</td>
      <td><div class="row-act">
        <button class="btn btn--sm" onclick="editProd(${arg(p.id)})">編輯</button>
        <button class="btn btn--sm" onclick="copyProd(${arg(p.id)})">複製</button>
        <button class="btn btn--sm" onclick="toggleActive(${arg(p.id)})">${p.active?'下架':'上架'}</button>
        <button class="btn btn--sm btn--danger" title="刪除商品" aria-label="刪除商品 ${esc(p.name)}" onclick="delProd(${arg(p.id)})">刪除</button>
      </div></td></tr>`).join('')}</tbody>
  </table></div>`;
}
async function toggleActive(id){
  const p=DB.products.find(x=>x.id===id);if(!p)return;
  const previous=p.active;p.active=!p.active;
  if(await store.save()){render();savedToast(p.active?'已上架':'已下架');}
  else{p.active=previous;render();}
}
async function delProd(id){
  const p=DB.products.find(x=>x.id===id);
  modal(`<h3>刪除商品</h3><p>要刪掉「${esc(p.name)}」嗎？刪了就找不回來。</p>
    <div style="display:flex;gap:10px;margin-top:16px"><button class="btn" onclick="closeModal()">取消</button>
    <button class="btn btn--primary" onclick="doDel(${arg(id)})">確定刪除</button></div>`);
}
async function doDel(id){
  const previous=DB.products.slice();
  DB.products=DB.products.filter(x=>x.id!==id);
  if(await store.save()){closeModal();render();savedToast('商品已刪除');}
  else{DB.products=previous;render();}
}
function uniqueCopyName(name){
  const base=String(name||'未命名商品').replace(/（副本(?: \d+)?）$/,'');
  let next=`${base}（副本）`, n=2;
  const names=new Set(DB.products.map(p=>p.name));
  while(names.has(next)){next=`${base}（副本 ${n}）`;n+=1;}
  return next;
}
async function copyProd(id){
  const src=DB.products.find(x=>x.id===id);
  if(!src){toast('找不到要複製的商品');return;}
  const previous=DB.products.slice();
  const copy=JSON.parse(JSON.stringify(src));
  copy.id='p'+Date.now()+Math.floor(Math.random()*1000);
  copy.name=uniqueCopyName(src.name);
  copy.active=false;
  DB.products.unshift(copy);
  if(await store.save()){
    render();
    editProd(copy.id);
    savedToast('商品已複製，副本目前為下架狀態');
  }else{
    DB.products=previous;
    render();
  }
}

function editProd(id){
  const p=id?DB.products.find(x=>x.id===id):{name:'',cat:DB.settings.cats[0],price:'',orig:'',desc:'',detail:'',stock:'',hot:false,isNew:false,active:true,specs:[],photos:[]};
  admEdit=JSON.parse(JSON.stringify(p)); admEdit.id=id||null;
  paintForm();
}
function paintForm(){
  const p=admEdit;
  modal(`<h3>${p.id?'編輯商品':'新增商品'}</h3>
    <div class="field"><label for="e-nm">商品名稱</label><input id="e-nm" value="${esc(p.name)}"></div>
    <div class="field"><label for="e-cat">分類</label><select id="e-cat">${DB.settings.cats.map(c=>`<option ${c===p.cat?'selected':''}>${esc(c)}</option>`).join('')}</select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label for="e-pr">售價</label><input id="e-pr" inputmode="numeric" value="${p.price}"></div>
      <div class="field"><label for="e-or">原價（可留空）</label><input id="e-or" inputmode="numeric" value="${p.orig||''}"></div>
    </div>
    <div class="field"><label for="e-st">庫存（留空＝不限量）</label><input id="e-st" inputmode="numeric" value="${p.stock===null?'':p.stock}"></div>
    <div class="field"><label for="e-ds">一句話簡介</label><input id="e-ds" value="${esc(p.desc)}"></div>
    <div class="field"><label for="e-dt">詳細說明（可換行）</label><textarea id="e-dt">${esc(p.detail)}</textarea></div>
    <div class="field"><label>規格</label>
      ${(p.specs||[]).map((s,i)=>`<div style="display:flex;gap:8px;margin-bottom:8px">
        <input value="${esc(s.n)}" oninput="admEdit.specs[${i}].n=this.value" placeholder="規格名稱" style="flex:2">
        <input value="${s.d}" inputmode="numeric" oninput="admEdit.specs[${i}].d=Number(this.value)||0" placeholder="加價" style="flex:1">
        <button class="btn btn--sm" aria-label="移除此規格" onclick="grabForm();admEdit.specs.splice(${i},1);paintForm()">✕</button></div>`).join('')}
      <button class="btn btn--sm" onclick="grabForm();admEdit.specs.push({n:'',d:0});paintForm()">＋ 新增規格</button>
    </div>
    <div class="field"><label for="e-ph">商品照片網址（一行一張，留空用插圖）</label>
      <textarea id="e-ph" placeholder="https://...">${esc((p.photos||[]).join('\n'))}</textarea></div>
    <div class="radios" style="margin-bottom:16px">
      <label><input type="checkbox" id="e-hot" ${p.hot?'checked':''}>標為熱銷</label>
      <label><input type="checkbox" id="e-new" ${p.isNew?'checked':''}>標為新品</label>
      <label><input type="checkbox" id="e-ac" ${p.active?'checked':''}>上架顯示</label>
    </div>
    <div id="peErr"></div>
    <div style="display:flex;gap:10px"><button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn--primary" onclick="saveProd()">儲存商品</button></div>`);
}
function grabForm(){
  const g=id=>document.getElementById(id);
  if(!g('e-nm')) return;
  Object.assign(admEdit,{
    name:g('e-nm').value.trim(),cat:g('e-cat').value,
    price:Number(g('e-pr').value)||0,orig:Number(g('e-or').value)||null,
    stock:g('e-st').value.trim()===''?null:Number(g('e-st').value)||0,
    desc:g('e-ds').value.trim(),detail:g('e-dt').value,
    photos:g('e-ph').value.split('\n').map(s=>s.trim()).filter(Boolean),
    hot:g('e-hot').checked,isNew:g('e-new').checked,active:g('e-ac').checked
  });
}
async function saveProd(){
  grabForm();
  const badPrice=!Number.isSafeInteger(admEdit.price)||admEdit.price<=0;
  const badStock=admEdit.stock!==null&&(!Number.isSafeInteger(admEdit.stock)||admEdit.stock<0);
  const badSpecs=(admEdit.specs||[]).some(s=>!Number.isSafeInteger(s.d)||admEdit.price+s.d<=0);
  if(!admEdit.name||badPrice||badStock||badSpecs){document.getElementById('peErr').innerHTML='<div class="err">請填商品名稱、正整數售價，以及零或正整數庫存；規格調價後須大於零。</div>';return;}
  if(admEdit.photos.some(ph=>!safeUrl(ph))){document.getElementById('peErr').innerHTML='<div class="err">照片請使用有效的 http 或 https 網址。</div>';return;}
  admEdit.specs=(admEdit.specs||[]).filter(s=>s.n.trim());
  if(admEdit.id){
    const i=DB.products.findIndex(x=>x.id===admEdit.id);
    DB.products[i]={...DB.products[i],...admEdit};
  }else{
    admEdit.id='p'+Date.now();
    DB.products.unshift(admEdit);
  }
  const saved=await store.save();
  if(saved){closeModal(); render(); savedToast('商品已儲存');}
  else document.getElementById('peErr').innerHTML='<div class="err">儲存失敗，請確認後台密碼仍有效，或重新登入後再試。</div>';
}

function aOrd(){
  if(!DB.orders.length) return `<h3 style="font-size:1.25rem">訂單管理</h3>
    <p style="color:#6b5b4d">還沒有訂單。到前台走一次購物流程就會出現在這裡。</p>`;
  return `<h3 style="font-size:1.25rem;margin-bottom:16px">訂單管理</h3>
  <div class="tbl-wrap"><table>
    <thead><tr><th>編號</th><th>收件人</th><th>金額</th><th>狀態</th><th></th></tr></thead>
    <tbody>${DB.orders.map(o=>`<tr>
      <td><b>${o.no}</b><br><span style="font-size:0.75rem;color:#6b5b4d">${o.at.slice(0,10)}</span></td>
      <td>${esc(o.name)}<br><span style="font-size:0.75rem;color:#6b5b4d">${esc(o.tel)}</span></td>
      <td>${NT(o.total)}</td>
      <td><select onchange="setStatus('${o.no}',this.value)" style="border:2px solid var(--ink);background:var(--paper-lt);padding:5px;font-family:inherit">
        ${['待確認','備貨中','已出貨','已完成','已取消'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select></td>
      <td><button class="btn btn--sm" onclick="showOrder('${o.no}')">明細</button></td></tr>`).join('')}</tbody>
  </table></div>`;
}
async function setStatus(no,s){
  const o=DB.orders.find(x=>x.no===no);
  if(o)o.status=s;
  try{
    await api('/api/admin/orders/'+encodeURIComponent(no),{method:'PATCH',body:{password:adminToken,status:s}});
    toast('訂單狀態已更新');
  }catch(e){toast(e.message||'狀態更新失敗');}
}
function showOrder(no){
  const o=DB.orders.find(x=>x.no===no);
  modal(`<h3>${o.no}</h3>
    <div class="copybox" style="min-height:auto">${esc(orderText(o))}</div>
    <p style="font-size:0.875rem;margin-top:12px">狀態：${statTag(o.status)}　建立：${o.at.slice(0,16).replace('T',' ')}</p>
    <button class="btn btn--full" onclick="closeModal()">關閉</button>`);
}

function aSet(){
  const s=DB.settings;
  return `<h3 style="font-size:1.25rem;margin-bottom:16px">網站設定</h3>
  <div class="field"><label for="s-line">LINE 官方帳號加好友連結</label><input id="s-line" value="${esc(safeUrl(s.lineUrl))}">
    <small>在 LINE Official Account Manager →「加入好友網址」複製，格式像 https://line.me/R/ti/p/@你的ID</small></div>
  <div class="field"><label for="s-ig">Instagram 連結</label><input id="s-ig" value="${esc(safeUrl(s.igUrl))}"></div>
  <div class="field"><span class="field-label">付款方式</span><div class="payment-choice"><span class="payment-check" aria-hidden="true">✓</span><span><b>超商貨到付款</b><small>目前唯一提供的付款方式</small></span></div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="field"><label for="s-fee">運費</label><input id="s-fee" inputmode="numeric" value="${s.shipFee}"></div>
    <div class="field"><label for="s-free">免運門檻</label><input id="s-free" inputmode="numeric" value="${s.freeOver}"></div>
  </div>
  <div class="field"><label for="s-cats">商品分類（一行一個）</label><textarea id="s-cats">${esc(s.cats.join('\n'))}</textarea></div>
  <div class="field"><label for="s-mq">首頁跑馬燈（一行一則，會輪播）</label><textarea id="s-mq">${esc(s.marquee.join('\n'))}</textarea></div>
  <div class="field"><label for="s-about">關於貳恭文案</label><textarea id="s-about" style="min-height:150px">${esc(s.about)}</textarea></div>
  <div class="field"><label for="s-pw">更改後台密碼</label><input id="s-pw" type="password" autocomplete="new-password" value=""><small>留空代表不更改；建議上線後改成只有你知道的密碼。</small></div>
  <button class="btn btn--primary" onclick="saveSet()">儲存設定</button>`;
}
async function saveSet(){
  const g=id=>document.getElementById(id).value;
  const newPw=g('s-pw').trim();
  const urls=['s-line','s-ig'];
  if(urls.some(id=>g(id).trim()&&!safeUrl(g(id).trim()))){toast('連結請使用有效的 http 或 https 網址');return;}
  const fee=Number(g('s-fee')),free=Number(g('s-free'));
  if(!Number.isSafeInteger(fee)||fee<0||!Number.isSafeInteger(free)||free<0){toast('運費與免運門檻請填零或正整數');return;}
  if(!g('s-cats').split('\n').some(x=>x.trim())){toast('請保留至少一個商品分類');return;}
  Object.assign(DB.settings,{
    lineUrl:g('s-line').trim(),igUrl:g('s-ig').trim(),payUrl:'',payHint:'超商貨到付款',
    shipFee:Number(g('s-fee'))||0,freeOver:Number(g('s-free'))||0,
    cats:g('s-cats').split('\n').map(x=>x.trim()).filter(Boolean),
    marquee:g('s-mq').split('\n').map(x=>x.trim()).filter(Boolean),
    about:g('s-about'),adminPw:newPw
  });
  const saved=await store.save();
  if(saved&&newPw){adminToken=newPw;sessionStorage.setItem('ergong:admin',newPw);}
  if(saved){render(); savedToast('設定已儲存');}
  else toast('設定沒有儲存成功，請重新登入後再試。');
}

/* ---------- 小工具 ---------- */
function modal(html){
  const host=document.getElementById('modalHost');
  host.innerHTML=`<div class="modal"><button class="modal__x" onclick="closeModal()" aria-label="關閉">✕</button>${html}</div>`;
  const title=host.querySelector('h3');
  if(title){title.id='modal-title';host.setAttribute('aria-labelledby','modal-title');}
  else host.removeAttribute('aria-labelledby');
  closeMenu();
  if(!host.open)host.showModal();
  document.body.classList.add('modal-open');
  document.body.style.overflow='hidden';
}
function closeModal(){document.getElementById('modalHost').close();}
const modalHost=document.getElementById('modalHost');
modalHost.addEventListener('close',()=>{document.body.style.overflow='';document.body.classList.remove('modal-open');});
modalHost.addEventListener('click',e=>{if(e.target===modalHost)e.preventDefault();});
function toggleMenu(){const nav=document.getElementById('nav'),open=nav.classList.toggle('open');const button=document.querySelector('.menubtn');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'關閉選單':'開啟選單');}
let tT=null;
function toast(msg){
  clearTimeout(tT);
  const old=document.querySelector('.toast'); if(old) old.remove();
  const d=document.createElement('div'); d.className='toast'; d.textContent=msg;d.setAttribute('role','status');d.setAttribute('aria-live','polite');
  document.body.appendChild(d); tT=setTimeout(()=>d.remove(),2100);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(modalHost.open)closeModal();else if(document.body.classList.contains('flow-open'))go('home');else closeMenu();}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('header.bar'))closeMenu();},{passive:true});
document.addEventListener('visibilitychange',()=>{clearInterval(mqT);mqT=null;if(!document.hidden&&view==='home')startMarquee();});
let scrollFrame=0;
window.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{pageScroll.set(routeSerial,window.scrollY);scrollFrame=0;});},{passive:true});
window.addEventListener('popstate',event=>{
  rememberCheckout();pageScroll.set(routeSerial,window.scrollY);closeMenu();
  if(modalHost.open)closeModal();
  const state=event.state;
  if(!state?.ergong){readRoute();routeSerial=Date.now()+Math.random();history.replaceState(routeSnapshot(),'',routeURL());}
  else{
    routeSerial=state.route;view=pageViews.includes(state.view)?state.view:'home';cur=state.cur;filter=state.filter||'全部';kw=state.kw||'';curSpec=state.curSpec||0;curQty=state.curQty||1;curPhoto=state.curPhoto||0;
    if(view==='admin'&&!isAdmin)view='home';
    if(view==='done'&&!lastOrder)view='cart';
  }
  render({preserveScroll:false});
  const top=pageScroll.get(routeSerial)||0;
  window.scrollTo({top,behavior:'instant'});document.getElementById('app').focus({preventScroll:true});
});
function readRoute(){
  const [requested,product]=location.hash.slice(1).split('=');
  view=pageViews.includes(requested)?requested:'home';
  if(view==='product'){try{cur=decodeURIComponent(product||'');}catch(e){cur=null;}if(!DB.products.some(p=>p.id===cur&&p.active))view='shop';}
  if(view==='admin'&&!isAdmin)view='home';
  if(view==='done'&&!lastOrder)view='cart';
}

(async function init(){
  await store.load();
  try{const saved=JSON.parse(localStorage.getItem(SHOP_KEY)||'null');if(saved){cart=Array.isArray(saved.cart)?saved.cart:[];favs=Array.isArray(saved.favs)?saved.favs:[];}}catch(e){}
  readRoute();
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  routeSerial=Date.now()+Math.random();history.replaceState(routeSnapshot(),'',routeURL());
  render({preserveScroll:false});
})();

document.addEventListener('keydown',event=>{if(event.key!=='Tab'||modalHost.open)return;const sheet=document.querySelector('.flow-sheet');if(!sheet)return;const items=[...sheet.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]')].filter(el=>el.getClientRects().length);if(!items.length)return;const first=items[0],last=items[items.length-1];if(event.shiftKey&&(document.activeElement===first||!sheet.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!sheet.contains(document.activeElement))){event.preventDefault();first.focus();}});
setInterval(()=>{if(!document.hidden&&view==='home')refreshCatalog();},300000);

async function prepareGoogleLogin(){
 const status=document.getElementById('google-login-status'),button=document.getElementById('submit-order'),host=document.getElementById('google-signin-button');if(!status||!button||!host)return;
 button.disabled=true;button.textContent='請先登入 Google 再下單';host.replaceChildren();
 try{
  googleConfig=await api('/api/auth/config');googleBuyer=googleConfig.buyer;
  if(!googleConfig.enabled){status.textContent='Google 登入設定更新中，暫時無法登入下單。';return;}
  if(googleBuyer&&googleBuyer.expiresAt>Date.now()){status.textContent='已驗證：'+googleBuyer.email;button.disabled=false;button.textContent='確認貨到付款訂單';const logout=document.createElement('button');logout.className='btn';logout.textContent='登出 Google 帳號';logout.onclick=async()=>{await api('/api/auth/logout',{method:'POST',body:{}});googleBuyer=null;prepareGoogleLogin();};host.append(logout);return;}
  googleBuyer=null;status.textContent=new URLSearchParams(location.search).get('login')==='failed'?'Google 登入失敗，請重試。':'只要求 Google 帳號識別碼與 Email，不儲存 Google 姓名或頭像。';
  const link=document.createElement('a');link.href='/api/auth/start';link.className='btn';link.textContent='使用 Google 帳戶登入';host.append(link);
 }catch{status.textContent='Google 登入暫時無法使用，請稍後重試。';}
}
