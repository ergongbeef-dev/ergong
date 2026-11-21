import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const root=new URL('../',import.meta.url),assetDir=new URL('public/assets/products/',root);
await mkdir(assetDir,{recursive:true});
const response=await fetch('https://myship.7-11.com.tw/general/detail/GM2505137999911',{signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error('Catalog unavailable');
const html=await response.text();
const decode=s=>s.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#39;/g,"'");
const images=new Set();
for(const match of html.matchAll(/data-product="([^"]+)"/g)){
 const item=JSON.parse(decode(match[1]));
 for(const spec of item.Spec||[]){const image=String(spec.Cgds_CgimImagePath||item.GoodsFirstImg||'');if(/^[\w.-]+$/.test(image))images.add(image);}
}
if(!images.size)throw Error('No images found');
const manifest={};
for(const image of images){
 const r=await fetch('https://myship.7-11.com.tw/i/cgdm/GM2505137999911/'+image,{signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Image download failed: '+image);
 const name=image.replace(/\.[^.]+$/,'.webp');
 await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize({width:800,withoutEnlargement:true}).webp({quality:82}).toFile(new URL(name,assetDir).pathname);
 manifest[image]='/assets/products/'+name;
}
await writeFile(new URL('manifest.json',assetDir),JSON.stringify(manifest,null,2)+'\n');
const {parseMyship}=await import('./myship-source.mjs');
await writeFile(new URL('scripts/catalog-snapshot.json',root),JSON.stringify({updatedAt:new Date().toISOString(),products:parseMyship(html)},null,2)+'\n');
await sharp(new URL('public/assets/ergong-ip-chibi-v1.png',root).pathname).resize({width:480}).webp({quality:85}).toFile(new URL('public/assets/ergong-ip-chibi.webp',root).pathname);
await sharp(new URL('public/assets/ergong-jerky-real.jpg',root).pathname).resize({width:800}).webp({quality:82}).toFile(new URL('public/assets/ergong-jerky-real.webp',root).pathname);
console.log('Saved '+images.size+' local WebP product images and catalog snapshot.');
