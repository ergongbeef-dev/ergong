import test from 'node:test';
import assert from 'node:assert/strict';
import {googleAuth,sessionBuyer,requireSessionBuyer} from './google-session.mjs';
import {createHmac,createHash} from 'node:crypto';
const env={GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',AUTH_SESSION_SECRET:'a'.repeat(48),GOOGLE_REDIRECT_URI:'https://shop.test/api/auth/callback'};
const request=(path,options={})=>new Request('https://shop.test'+path,options);
const signed=value=>{const data=Buffer.from(JSON.stringify(value)).toString('base64url');return data+'.'+createHmac('sha256',env.AUTH_SESSION_SECRET).update(data).digest('base64url')};
test('OAuth requests exactly openid email and binds state nonce PKCE to secure transaction',async()=>{
 const res=await googleAuth(request('/api/auth/start'),env),url=new URL(res.headers.get('location'));
 assert.equal(url.searchParams.get('scope'),'openid email');assert.equal(url.searchParams.get('include_granted_scopes'),'false');assert.equal(url.searchParams.get('access_type'),'online');assert.equal(url.searchParams.get('redirect_uri'),env.GOOGLE_REDIRECT_URI);assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 const cookie=res.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);const tx=JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[0],'base64url'));assert.equal(tx.state,url.searchParams.get('state'));assert.equal(tx.nonce,url.searchParams.get('nonce'));assert.equal(createHash('sha256').update(tx.verifier).digest('base64url'),url.searchParams.get('code_challenge'));
});
test('session rejects forgery and expiry; order identity uses sub rather than email',()=>{
 const identity={sub:'unique-google-id',email:'buyer@gmail.com',exp:Date.now()+60000};const req=request('/api/orders',{headers:{origin:'https://shop.test',cookie:'__Host-ergong_session='+signed(identity)}});
 assert.deepEqual(requireSessionBuyer(req,env),{provider:'google',googleSub:identity.sub,email:identity.email,expiresAt:identity.exp});
 assert.equal(sessionBuyer(request('/',{headers:{cookie:'__Host-ergong_session='+signed({...identity,exp:0})}}),env),null);
 assert.equal(sessionBuyer(request('/',{headers:{cookie:'__Host-ergong_session='+signed(identity)+'x'}}),env),null);
 assert.throws(()=>requireSessionBuyer(request('/api/orders',{headers:{origin:'https://evil.test',cookie:req.headers.get('cookie')}}),env),e=>e.status===403);
});
test('callback rejects missing or wrong state before exchanging any token',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('must not fetch')};try{const res=await googleAuth(request('/api/auth/callback?state=wrong&code=code'),env);assert.equal(res.status,303);assert.match(res.headers.get('location'),/login=failed/);assert.match(res.headers.get('set-cookie'),/Max-Age=0/);}finally{globalThis.fetch=original;}
});
test('callback establishes allowlisted session and never persists provider profile or tokens',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);Object.assign(jwk,{kid:'session-test',alg:'RS256'});
 const tx={state:'state',nonce:'nonce',verifier:'verifier',exp:Date.now()+60000};const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const now=Math.floor(Date.now()/1000);
 const input=encode({alg:'RS256',kid:'session-test'})+'.'+encode({iss:'https://accounts.google.com',aud:env.GOOGLE_CLIENT_ID,sub:'google-sub',email:'buyer@gmail.com',email_verified:true,iat:now,exp:now+300,nonce:tx.nonce,name:'Not stored',picture:'https://example.com/avatar'});
 const token=input+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input))).toString('base64url');const calls=[];const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{calls.push(url);if(url==='https://oauth2.googleapis.com/token'){assert.equal(options.body.get('code_verifier'),tx.verifier);return Response.json({id_token:token,access_token:'discarded',refresh_token:'discarded'});}assert.equal(url,'https://www.googleapis.com/oauth2/v3/certs');return Response.json({keys:[jwk]});};
 try{const res=await googleAuth(request('/api/auth/callback?state=state&code=code',{headers:{cookie:'__Host-ergong_oauth='+signed(tx)}}),env);assert.equal(res.headers.get('location'),'https://shop.test/#checkout');const sc=res.headers.getSetCookie().find(x=>x.startsWith('__Host-ergong_session='));assert.ok(sc);const value=sc.split('=')[1].split(';')[0];const persisted=JSON.parse(Buffer.from(value.split('.')[0],'base64url'));assert.deepEqual(Object.keys(persisted).sort(),['email','exp','sub']);assert.equal(persisted.sub,'google-sub');assert.equal(calls.length,2);}finally{globalThis.fetch=original;}
});
