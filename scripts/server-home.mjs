import {esc,renderHome} from '../public/home-content.mjs';
export function catalogHTML(products){
 if(!products.length)return `<div class="shop-inner"><h2>全部商品</h2><div role="status"><p>正在更新商品，請稍候。</p><div class="grid skeleton-grid" aria-hidden="true">${Array.from({length:4},()=>'<div class="skeleton-card"><div></div><span></span><span></span></div>').join('')}</div></div></div>`;
 return `<div class="shop-inner"><div class="blk__hd"><h2>全部商品</h2><p>${products.length} 款</p></div><div class="grid">${products.map(p=>`<article class="card"><a class="card__img" href="/products/${esc(p.id)}"><img src="${esc(p.photos[0])}" alt="${esc(p.name)}" width="300" height="300" loading="lazy" decoding="async"></a><div class="card__bd"><h3 class="card__nm">${esc(p.name)}</h3><p class="card__ds">${esc(p.desc)}</p><div class="card__pr">NT$${p.price.toLocaleString('en-US')}${p.orig?`<s>NT$${p.orig.toLocaleString('en-US')}</s>`:''}</div><a class="btn btn--sm card__go" href="/products/${esc(p.id)}">查看商品</a></div></article>`).join('')}</div></div>`;
}
export function serverHome(data){return renderHome({settings:data.settings,catalogHtml:catalogHTML(data.products)});}
