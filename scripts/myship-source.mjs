export const MYSHIP_URL='https://myship.7-11.com.tw/general/detail/GM2505137999911';
export function decodeEntities(value){return String(value).replace(/&(?:quot|amp|lt|gt|apos|#39|#x[0-9a-f]+|#\d+);/gi,entity=>{const named={'&quot;':'"','&amp;':'&','&lt;':'<','&gt;':'>','&apos;':"'",'&#39;':"'"};if(named[entity])return named[entity];const raw=entity.slice(2,-1);const n=raw[0].toLowerCase()==='x'?parseInt(raw.slice(1),16):parseInt(raw,10);return Number.isFinite(n)&&n<=0x10ffff?String.fromCodePoint(n):entity;});}
function plainText(value){return decodeEntities(String(value).replace(/<br\s*\/?\s*>|<\/p>/gi,'\n').replace(/<[^>]*>/g,'')).replace(/&nbsp;/g,' ').replace(/\n{3,}/g,'\n\n').trim();}
export function parseMyship(html){
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
export async function fetchMyship({force=false}={}){
 if(!force&&myshipCache&&Date.now()-myshipCache.time<300000)return myshipCache;
 const response=await fetch(MYSHIP_URL,{signal:AbortSignal.timeout(12000),headers:{accept:'text/html'}});
 if(!response.ok)throw Error('賣貨便暫時無法讀取');
 const products=parseMyship(await response.text());
 myshipCache={products,time:Date.now(),updatedAt:new Date().toISOString()};return myshipCache;
}
