import {createHmac,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {verifyGoogleBuyer} from './google-identity.mjs';
export const SCOPES='openid email';
const CALLBACK='https://ergong.vercel.app/api/auth/callback';
const SESSION='__Host-ergong_session',TRANSACTION='__Host-ergong_oauth';
const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const cookies=req=>Object.fromEntries((req.headers.get('cookie')||'').split(';').map(s=>s.trim().split('=')));
const ready=env=>Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.AUTH_SESSION_SECRET?.length>=32);
function sign(value,secret){const data=Buffer.from(JSON.stringify(value)).toString('base64url');return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');}
function read(value,secret){try{const [data,mac,...rest]=(value||'').split('.');if(rest.length||!data||!mac)return null;const actual=Buffer.from(mac,'base64url'),expected=createHmac('sha256',secret).update(data).digest();if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const result=JSON.parse(Buffer.from(data,'base64url'));return result.exp>Date.now()?result:null;}catch{return null;}}
function headers(){return {'cache-control':'no-store','referrer-policy':'no-referrer'};}
export function sessionBuyer(request,env){
 if(!ready(env))return null;
 const session=read(cookies(request)[SESSION],env.AUTH_SESSION_SECRET);
 if(!session||typeof session.sub!=='string'||!session.sub||typeof session.email!=='string')return null;
 return {provider:'google',googleSub:session.sub,email:session.email,expiresAt:session.exp};
}
export function requireSessionBuyer(request,env){
 if(!ready(env))throw new Response('Google 登入尚未設定。',{status:503});
 if(request.headers.get('origin')!==new URL(env.GOOGLE_REDIRECT_URI||CALLBACK).origin)throw new Response('不允許的訂單來源。',{status:403});
 const buyer=sessionBuyer(request,env);if(!buyer)throw new Response('請先使用 Google 帳號登入。',{status:401});return buyer;
}
export async function googleAuth(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/api/auth/config')return Response.json({enabled:ready(env),scopes:SCOPES.split(' '),buyer:sessionBuyer(request,env)},{headers:headers()});
 if(!ready(env))return Response.json({error:'Google 登入設定尚未完成。'},{status:503,headers:headers()});
 const callback=env.GOOGLE_REDIRECT_URI||CALLBACK;
 if(path==='/api/auth/logout'&&request.method==='POST'){
  if(request.headers.get('origin')!==new URL(callback).origin)return new Response(null,{status:403});
  return Response.json({ok:true},{headers:{...headers(),'set-cookie':cookie(SESSION,'',0)}});
 }
 if(path==='/api/auth/start'&&request.method==='GET'){
  const transaction={state:randomBytes(32).toString('base64url'),nonce:randomBytes(32).toString('base64url'),verifier:randomBytes(32).toString('base64url'),exp:Date.now()+600000};
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:callback,response_type:'code',scope:SCOPES,state:transaction.state,nonce:transaction.nonce,code_challenge:createHash('sha256').update(transaction.verifier).digest('base64url'),code_challenge_method:'S256',include_granted_scopes:'false',access_type:'online',prompt:'select_account'}).toString();
  return new Response(null,{status:302,headers:{...headers(),location:url.href,'set-cookie':cookie(TRANSACTION,sign(transaction,env.AUTH_SESSION_SECRET),600)}});
 }
 if(path==='/api/auth/callback'&&request.method==='GET'){
  const responseHeaders=new Headers(headers());responseHeaders.append('set-cookie',cookie(TRANSACTION,'',0));
  try{
   const url=new URL(request.url),transaction=read(cookies(request)[TRANSACTION],env.AUTH_SESSION_SECRET);
   if(!transaction||url.searchParams.get('state')!==transaction.state||url.searchParams.has('error')||!url.searchParams.get('code'))throw Error();
   const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:url.searchParams.get('code'),client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:callback,grant_type:'authorization_code',code_verifier:transaction.verifier}),signal:AbortSignal.timeout(10000)});
   if(!tokenResponse.ok)throw Error();
   const tokens=await tokenResponse.json();
   // Do not call userinfo or retain access/refresh tokens or raw ID tokens.
   const validationRequest=new Request(callback,{headers:{origin:new URL(callback).origin,cookie:'ergong_google_nonce='+transaction.nonce}});
   const buyer=await verifyGoogleBuyer(validationRequest,env,tokens.id_token);
   const exp=Math.min(buyer.expiresAt,Date.now()+3600000);
   // Explicit allowlist: only identity data persisted is sub + email; exp is session metadata.
   responseHeaders.append('set-cookie',cookie(SESSION,sign({sub:buyer.googleSub,email:buyer.email,exp},env.AUTH_SESSION_SECRET),Math.max(0,Math.floor((exp-Date.now())/1000))));
   responseHeaders.set('location',new URL('/#checkout',callback).href);
   return new Response(null,{status:303,headers:responseHeaders});
  }catch{
   // Never log callback URLs, tokens, claims, or provider error payloads.
   responseHeaders.set('location',new URL('/?login=failed#checkout',callback).href);
   return new Response(null,{status:303,headers:responseHeaders});
  }
 }
 return Response.json({error:'找不到登入服務。'},{status:404,headers:headers()});
}
