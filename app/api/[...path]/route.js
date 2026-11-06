import commerce from '../../../lib/commerce';
import {database,configuredDatabase} from '../../../lib/database';
import {fetchMyship,MYSHIP_URL} from '../../../scripts/myship-source.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const defaults={lineUrl:'https://line.me/R/ti/p/@634xhfoj',myshipUrl:MYSHIP_URL,igUrl:'https://www.instagram.com/ergong_beef.ig/',freeOver:Number(process.env.FREE_SHIPPING_OVER||1999),shipFee:Number(process.env.SHIP_FEE||250),cats:['單包口味','組合優惠'],marquee:[],about:'貳恭 ER GONG 濕式牛肉乾。'};
async function handle(request){
 const path=new URL(request.url).pathname;
 try{
  if(path==='/api/store'&&request.method==='GET'){
   const source=await fetchMyship();return Response.json({settings:defaults,products:source.products,sync:{source:'myship',updatedAt:source.updatedAt,refreshSeconds:300}},{headers:{'cache-control':'no-store'}});
  }
  const env={GOOGLE_CLIENT_ID:process.env.GOOGLE_CLIENT_ID};
  if(path.startsWith('/api/auth/'))return commerce.fetch(request,env,{});
  if(!configuredDatabase())return Response.json({error:'訂單資料庫尚未設定，暫時無法下單。'},{status:503});
  env.DB=await database();
  // Populate settings with current shipping values on a new database only.
  await env.DB.prepare('INSERT OR IGNORE INTO settings (key,value,updated_at) VALUES (?,?,?)').bind('shop',JSON.stringify(defaults),new Date().toISOString()).run();
  if(process.env.ADMIN_PASSWORD)await env.DB.prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('admin_pw',process.env.ADMIN_PASSWORD,new Date().toISOString()).run();
  return commerce.fetch(request,env,{});
 }catch{ return Response.json({error:'服務暫時無法使用，請稍後再試。'},{status:503}); }
}
export {handle as GET,handle as POST,handle as PUT,handle as PATCH};
