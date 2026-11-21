import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import snapshot from './catalog-snapshot.json' with {type:'json'};
import {serverHome} from './server-home.mjs';
import {settings} from './store-settings.mjs';
import {productSchema,jsonLD} from './seo.mjs';
import {parseMyship} from './myship-source.mjs';

test('initial HTML contains main content and crawlable products without API or browser JS',()=>{
 const html=serverHome({products:snapshot.products,settings});
 for(const text of ['今晚的快樂','brand-story','how-to-order','id="faq"','全部商品','/products/myship-','@ergong_beef.ig'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('好肉，值得等一下'));assert.match(html,/BIG FLAVOR\. <br>GOOD MOOD\./);
});
test('missing catalog shows skeletons within products while preserving brand and FAQ',()=>{
 const html=serverHome({products:[],settings});
 assert.match(html,/skeleton-grid/);assert.match(html,/今晚的快樂/);assert.match(html,/id="faq"/);
});
test('catalog HTML and structured data escape untrusted product text',()=>{
 const p={...snapshot.products[0],name:'</script><script>alert(1)</script>'};
 assert.ok(!serverHome({products:[p],settings}).includes(p.name));
 const json=jsonLD(productSchema(p));assert.ok(!json.includes('<'));assert.equal(JSON.parse(json).name,p.name);
});
test('Product offers match visible price, currency, availability and canonical URLs',()=>{
 for(const p of snapshot.products){const data=productSchema(p);assert.equal(data.offers.price,p.price);assert.equal(data.offers.priceCurrency,'TWD');assert.ok(data.offers.url.endsWith('/products/'+p.id));assert.ok(!('aggregateRating' in data));}
 assert.equal(productSchema({...snapshot.products[0],stock:0}).offers.availability,'https://schema.org/OutOfStock');
});
test('all snapshotted product images exist on this site',async()=>{
 for(const p of snapshot.products){assert.match(p.photos[0],/^\/assets\/products\/.+\.webp$/);await access(new URL('../public'+p.photos[0],import.meta.url));}
});
test('changed source image falls back locally instead of using an external URL',()=>{
 const item={Spec:[{Cgds_Spec:'新商品',Cgds_Id:'new',Cgds_SPrice:220,Cgds_Price:220,Inventory:3,Cgds_CgimImagePath:'new-source.jpg'}]};
 const html='<div data-product="'+JSON.stringify(item).replaceAll('"','&quot;')+'"></div>';
 assert.equal(parseMyship(html)[0].photos[0],'/assets/ergong-jerky-real.webp');
});
