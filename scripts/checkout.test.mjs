import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=await readFile(new URL('../public/storefront.js',import.meta.url),'utf8');
const checkout=source.slice(source.indexOf('function vCheckout(){'),source.indexOf('function toggleShip(){'));
const submit=source.slice(source.indexOf('async function submitOrder(){'),source.indexOf('function orderText('));
const myship='https://myship.7-11.com.tw/general/detail/GM2505137999911';
function context(){
 const fields={'f-name':{value:'測試不送單'},'f-tel':{value:'0900000000'},'f-ig':{value:'ergong_qa'},'f-store':{value:'測試門市'},'f-agree':{checked:true},ckErr:{innerHTML:'',scrollIntoView(){}}};
 const ctx=vm.createContext({cart:[{id:'p1',price:220,qty:1}],DB:{products:[{id:'p1',name:'測試商品'}],settings:{myshipUrl:myship,freeOver:1999,shipFee:250}},subTotal:()=>220,shipOf:()=>250,NT:n=>'NT$'+n,safeUrl:s=>s,esc:s=>String(s),document:{getElementById:id=>fields[id]},crypto:webcrypto,go:view=>ctx.nextView=view,lastOrder:null,nextView:null,fetch:()=>{throw Error('Draft must never send a request');}});
 vm.runInContext(checkout+'\n'+submit,ctx);return {ctx,fields};
}
test('checkout links to existing Myship store without attaching personal data or cart',()=>{
 const {ctx}=context();const html=vm.runInContext('vCheckout()',ctx);
 assert.ok(html.includes('href="'+myship+'"'));assert.ok(html.includes('target="_blank" rel="noopener noreferrer"'));assert.ok(html.includes('請在賣場重新選擇商品'));
 assert.ok(!html.includes('/api/auth/'));assert.ok(!html.includes('google-signin-button'));assert.ok(html.includes('產生 LINE 下單明細'));
});
test('valid guest form creates only a local LINE draft without a Google identity',async()=>{
 const {ctx}=context();await vm.runInContext('submitOrder()',ctx);
 assert.equal(ctx.nextView,'done');assert.equal(ctx.lastOrder.draft,true);assert.equal(ctx.lastOrder.mail,'');assert.equal(ctx.lastOrder.total,470);assert.equal(ctx.lastOrder.name,'測試不送單');assert.ok(!('identity' in ctx.lastOrder));
});
test('guest draft still requires valid contact information and pickup agreement',async()=>{
 const {ctx,fields}=context();fields['f-tel'].value='invalid';fields['f-agree'].checked=false;await vm.runInContext('submitOrder()',ctx);
 assert.equal(ctx.lastOrder,null);assert.equal(ctx.nextView,null);assert.ok(fields.ckErr.innerHTML.includes('正確的手機號碼'));assert.ok(fields.ckErr.innerHTML.includes('取貨同意'));
});
