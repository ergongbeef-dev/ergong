import test from 'node:test';import assert from 'node:assert/strict';import {verifyGoogleBuyer,authConfig} from './google-identity.mjs';
test('Google token signature, audience, nonce, expiry, email and account binding',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);Object.assign(jwk,{kid:'test-key',alg:'RS256'});
 const original=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(url,'https://www.googleapis.com/oauth2/v3/certs');return Response.json({keys:[jwk]});};
 const env={GOOGLE_CLIENT_ID:'test-client.apps.googleusercontent.com'};const now=Math.floor(Date.now()/1000);const base={iss:'https://accounts.google.com',aud:env.GOOGLE_CLIENT_ID,sub:'stable-google-sub',email:'buyer@gmail.com',email_verified:true,nonce:'test-nonce',iat:now,exp:now+300};
 const request=nonce=>new Request('https://shop.test/api/orders',{headers:{origin:'https://shop.test',cookie:'ergong_google_nonce='+nonce}});
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const token=async claims=>{const input=encode({alg:'RS256',kid:'test-key'})+'.'+encode(claims);return input+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input))).toString('base64url');};
 const rejected=async (claims,nonce='test-nonce')=>{await assert.rejects(()=>verifyGoogleBuyer(request(nonce),env,claims),error=>error instanceof Response&&error.status===401);};
 try{const signed=await token(base);const buyer=await verifyGoogleBuyer(request('test-nonce'),env,signed);assert.equal(buyer.googleSub,base.sub);assert.equal(buyer.email,base.email);
 await rejected(signed,'wrong');await rejected(await token({...base,aud:'attacker'}));await rejected(await token({...base,exp:now-1}));await rejected(await token({...base,email_verified:false}));await rejected(await token({...base,email:'person@example.com'}));
 const parts=signed.split('.');parts[1]=encode({...base,email:'forged@gmail.com'});await rejected(parts.join('.'));
 }finally{globalThis.fetch=original;}
});
test('unconfigured auth exposes no login and accepts no orders',async()=>{const req=new Request('https://shop.test/api/auth/config');assert.equal((await authConfig(req,{}).json()).enabled,false);await assert.rejects(()=>verifyGoogleBuyer(req,{},'anything'),e=>e.status===503);});
