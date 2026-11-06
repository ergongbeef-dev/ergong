export function authConfig(request,env){
 const clientId=String(env.GOOGLE_CLIENT_ID||'');
 if(!clientId)return Response.json({enabled:false,clientId:null});
 const nonce=crypto.randomUUID();const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
 return Response.json({enabled:true,clientId,nonce},{headers:{'cache-control':'no-store','set-cookie':'ergong_google_nonce='+nonce+'; Path=/api/; HttpOnly; SameSite=Strict; Max-Age=3600'+secure}});
}
let googleKeys=null,googleKeysExpires=0;
export async function verifyGoogleBuyer(request,env,token){
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
