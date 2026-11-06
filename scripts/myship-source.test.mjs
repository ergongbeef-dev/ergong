import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {parseMyship,decodeEntities} from './myship-source.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/myship-product.json',import.meta.url),'utf8'));
const html='<div data-product="'+JSON.stringify(fixture).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></div>';

test('actual storefront variants have unique IDs and absolute prices',()=>{const p=parseMyship(html);assert.equal(p.length,9);assert.equal(new Set(p.map(p=>p.id)).size,p.length);assert.equal(p[0].price,220);assert.deepEqual(p[0].specs,[]);assert.equal(p[2].price,400);assert.equal(p[2].orig,440);assert.ok(p.every(p=>p.photos[0].startsWith('https://myship.7-11.com.tw/')));});
test('unexpected page fails closed',()=>assert.throws(()=>parseMyship('<html>login</html>')));
test('entity decoding supports emoji',()=>assert.equal(decodeEntities('&#129385; &quot;&amp;'), '🥩 "&'));

test('orders without configured Google login fail before database access',async()=>{
 const {default:worker}=await import('../lib/commerce.js');
 const response=await worker.fetch(new Request('https://test.local/api/orders',{method:'POST',headers:{origin:'https://test.local'},body:JSON.stringify({customer:{mail:'forged@gmail.com'}})}),{},{});
 assert.equal(response.status,503);
});
