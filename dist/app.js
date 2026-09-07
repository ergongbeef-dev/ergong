'use strict';
const products = [
  { id: 'garden', name: '小花園・花朵髮夾組', english: 'THE LITTLE GARDEN', category: 'flower', image: 'garden.webp', price: 420, variant: '粉 × 紫・一組 2 入', tag: '森花精選', description: '像剛從花園摘下的小花，一朵溫柔粉、一朵淡淡紫。把細碎花瓣留在通透的樹脂裡，兩朵一起戴，或各自點綴今天的髮型。', material: '樹脂、乾燥花、金屬髮夾', size: '花朵約 3 cm（示意規格）', alt: '粉色與紫色花朵樹脂髮夾組' },
  { id: 'heart', name: '花藏心事・愛心髮夾', english: 'A POCKET OF LOVE', category: 'heart', image: 'heart.webp', price: 380, variant: '柔粉色・一組 2 入', tag: '甜甜新作', description: '把一點點心意，藏進透明的粉色愛心。細小花朵自然散落，陽光下透出柔和光澤，是日常穿搭裡剛剛好的甜。', material: '樹脂、乾燥花、金屬髮夾', size: '愛心約 2.8 cm（示意規格）', alt: '含粉色小花的透明愛心髮夾' },
  { id: 'lavender', name: '紫色花信・乾燥花髮夾', english: 'LETTERS IN LAVENDER', category: 'pressed', image: 'lavender.webp', price: 320, variant: '淡紫色・單入', tag: '日常百搭', description: '淡紫小花與白色碎花，像一封寫給日常的短信。俐落的長形輪廓保留花材的輕盈，隨手別起髮絲，就有一點清新。', material: '樹脂、乾燥花、金屬髮夾', size: '長度約 5.5 cm（示意規格）', alt: '透明長形樹脂髮夾中的紫色乾燥花' }
];
const state = { category: 'all', favoritesOnly: false, favorites: new Set(), bag: new Map(), detailId: null, quantity: 1 };
const $ = (selector) => document.querySelector(selector);
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const money = (amount) => `NT$ ${amount.toLocaleString('en-US')}`;
let toastTimeout;
function notify(message) {
  clearTimeout(toastTimeout);
  const toast = $('#toast');
  toast.innerHTML = `${icon('check')}<span>${message}</span>`;
  toast.classList.add('visible');
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2600);
}
function renderProducts() {
  const visible = products.filter(p => (state.category === 'all' || p.category === state.category) && (!state.favoritesOnly || state.favorites.has(p.id)));
  $('#product-grid').innerHTML = visible.map(p => `<article class="product-card">
    <div class="product-image-wrap"><button class="product-open" data-product="${p.id}" aria-label="查看${p.name}"><img src="assets/${p.image}" width="1024" height="1024" alt="${p.alt}" loading="lazy"><span class="quick-view-label">看看這件小喜歡</span></button><span class="product-tag">${p.tag}</span><button class="product-favorite icon-button" data-favorite="${p.id}" aria-label="${state.favorites.has(p.id) ? '取消收藏' : '收藏'}${p.name}" aria-pressed="${state.favorites.has(p.id)}">${icon('heart')}</button></div>
    <div class="product-info"><p class="product-subtitle">${p.english}</p><h3><button class="product-title-button" data-product="${p.id}">${p.name}</button></h3><div class="product-bottom"><span class="product-price">${money(p.price)}</span><span class="product-variant">${p.variant}</span></div><button class="product-arrow" data-product="${p.id}" aria-label="查看${p.name}詳情">${icon('arrow')}</button></div>
  </article>`).join('');
  $('#empty-state').hidden = visible.length > 0;
  $('#product-grid').hidden = visible.length === 0;
  $('#result-count').textContent = state.favoritesOnly ? `${visible.length} 件收藏作品` : `${visible.length} 件小小喜歡`;
  $('#collection-title').textContent = state.favoritesOnly ? '收藏你的每一個喜歡' : '今天，想戴哪一朵？';
  $('.favorites-toggle').setAttribute('aria-pressed', String(state.favoritesOnly));
  $('.favorites-toggle').setAttribute('aria-label', state.favoritesOnly ? '顯示所有作品' : `查看收藏作品，目前 ${state.favorites.size} 件`);
  $('.favorite-count').textContent = `${state.favorites.size} 件收藏`;
}
function showDialog(id) {
  const dialog = document.getElementById(id);
  dialog.showModal();
  document.body.classList.add('dialog-open');
}
function closeDialog(id) { document.getElementById(id).close(); }
function showProduct(id) {
  const p = products.find(item => item.id === id);
  if (!p) return;
  state.detailId = id;
  state.quantity = 1;
  $('#product-detail').innerHTML = `<div class="product-detail-layout"><div class="detail-photo"><img src="assets/${p.image}" width="1024" height="1024" alt="${p.alt}"></div><div class="detail-info"><p class="eyebrow">${p.english}</p><h2 id="product-title">${p.name}</h2><p class="detail-price">${money(p.price)}</p><p class="detail-description">${p.description}</p><div class="detail-specs"><span><strong>款式</strong>${p.variant}</span><span><strong>材質</strong>${p.material}</span><span><strong>尺寸</strong>${p.size}</span></div><div class="detail-controls"><div class="quantity" role="group" aria-label="商品數量"><button id="detail-minus" data-detail-quantity="-1" aria-label="減少數量" disabled>${icon('minus')}</button><output id="detail-quantity" aria-live="polite">1</output><button id="detail-plus" data-detail-quantity="1" aria-label="增加數量">${icon('plus')}</button></div><button class="button button-primary detail-add" id="add-to-bag">${icon('bag')}加入購物袋</button></div><p class="detail-note">每朵花的色澤與姿態各有不同。<br>圖片與規格為設計示意，尚未開放購買。</p></div></div>`;
  showDialog('product-dialog');
}
function changeDetailQuantity(delta) {
  state.quantity = Math.max(1, Math.min(10, state.quantity + delta));
  $('#detail-quantity').textContent = state.quantity;
  $('#detail-minus').disabled = state.quantity === 1;
  $('#detail-plus').disabled = state.quantity === 10;
}
function renderBag() {
  const count = [...state.bag.values()].reduce((a, b) => a + b, 0);
  $('.bag-count').textContent = count;
  $('.bag-toggle').setAttribute('aria-label', `開啟購物袋，目前 ${count} 件`);
  $('#bag-title-count').textContent = `(${count})`;
  if (count === 0) {
    $('#bag-items').innerHTML = `<div class="bag-empty">${icon('bag')}<h3>購物袋裡，還有一點空位</h3><p>去找一件讓你心動的小小飾品吧。</p><button class="button button-primary" data-browse>去逛逛作品 ${icon('arrow')}</button></div>`;
    $('#bag-summary').innerHTML = '';
    return;
  }
  let total = 0;
  $('#bag-items').innerHTML = [...state.bag].map(([id, qty]) => {
    const p = products.find(item => item.id === id);
    total += p.price * qty;
    return `<div class="bag-item"><div class="bag-item-photo"><img src="assets/${p.image}" width="90" height="110" alt="${p.alt}"></div><div><h3>${p.name}</h3><p class="bag-item-price">${money(p.price)} × ${qty}</p><div class="bag-item-controls"><div class="quantity" role="group" aria-label="${p.name}數量"><button data-bag-quantity="${id}" data-delta="-1" aria-label="減少${p.name}數量" ${qty === 1 ? 'disabled' : ''}>${icon('minus')}</button><output aria-live="polite">${qty}</output><button data-bag-quantity="${id}" data-delta="1" aria-label="增加${p.name}數量" ${qty === 10 ? 'disabled' : ''}>${icon('plus')}</button></div><button class="bag-remove" data-remove="${id}" aria-label="從購物袋移除${p.name}">移除</button></div></div></div>`;
  }).join('');
  $('#bag-summary').innerHTML = `<div class="bag-totals"><span>商品小計</span><strong>${money(total)}</strong></div><button class="button button-outline bag-continue" data-browse>繼續挑選 ${icon('arrow')}</button>`;
}
function browse() {
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  state.favoritesOnly = false;
  state.category = 'all';
  updateCategories();
  renderProducts();
  $('#collection').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
function updateCategories() {
  document.querySelectorAll('[data-category]').forEach(button => {
    const active = button.dataset.category === state.category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;
  if (target.dataset.product) showProduct(target.dataset.product);
  if (target.dataset.favorite) {
    const id = target.dataset.favorite;
    const add = !state.favorites.has(id);
    add ? state.favorites.add(id) : state.favorites.delete(id);
    renderProducts();
    const next = document.querySelector(`[data-favorite="${id}"]`);
    (next || $('.favorites-toggle')).focus({ preventScroll: true });
    notify(add ? '已收藏這件小喜歡' : '已取消收藏');
  }
  if (target.dataset.category) {
    state.category = target.dataset.category;
    updateCategories();
    renderProducts();
  }
  if (target.dataset.close) closeDialog(target.dataset.close);
  if (target.dataset.detailQuantity) changeDetailQuantity(Number(target.dataset.detailQuantity));
  if (target.id === 'add-to-bag') {
    const current = state.bag.get(state.detailId) || 0;
    if (current + state.quantity > 10) { notify('每款最多可放入 10 件'); return; }
    state.bag.set(state.detailId, current + state.quantity);
    renderBag();
    closeDialog('product-dialog');
    notify(`已將 ${state.quantity} 件小喜歡放入購物袋`);
  }
  if (target.dataset.bagQuantity) {
    const id = target.dataset.bagQuantity;
    const delta = Number(target.dataset.delta);
    state.bag.set(id, Math.max(1, Math.min(10, state.bag.get(id) + delta)));
    renderBag();
    const next = document.querySelector(`[data-bag-quantity="${id}"][data-delta="${delta}"]`);
    if (next && !next.disabled) next.focus({ preventScroll: true });
    else document.querySelector(`[data-bag-quantity="${id}"]:not(:disabled)`)?.focus({ preventScroll: true });
  }
  if (target.dataset.remove) {
    state.bag.delete(target.dataset.remove);
    renderBag();
    ($('#bag-items button') || document.querySelector('[data-close="bag-dialog"]')).focus({ preventScroll: true });
    notify('已從購物袋移除');
  }
  if (target.hasAttribute('data-browse') || target.id === 'show-all') browse();
});
$('.favorites-toggle').addEventListener('click', () => {
  state.favoritesOnly = !state.favoritesOnly;
  state.category = 'all';
  updateCategories();
  renderProducts();
  $('#collection').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
});
$('.bag-toggle').addEventListener('click', () => { renderBag(); showDialog('bag-dialog'); });
$('.menu-toggle').addEventListener('click', () => {
  const open = $('.menu-toggle').getAttribute('aria-expanded') !== 'true';
  $('.menu-toggle').setAttribute('aria-expanded', String(open));
  $('.menu-toggle').setAttribute('aria-label', open ? '關閉選單' : '開啟選單');
  $('.main-nav').classList.toggle('is-open', open);
});
document.querySelectorAll('.main-nav a').forEach(link => link.addEventListener('click', () => {
  $('.main-nav').classList.remove('is-open');
  $('.menu-toggle').setAttribute('aria-expanded', 'false');
  $('.menu-toggle').setAttribute('aria-label', '開啟選單');
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('.main-nav').classList.contains('is-open')) {
    $('.main-nav').classList.remove('is-open');
    $('.menu-toggle').setAttribute('aria-expanded', 'false');
    $('.menu-toggle').setAttribute('aria-label', '開啟選單');
    $('.menu-toggle').focus();
  }
});
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) document.body.classList.remove('dialog-open'); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
});
$('#year').textContent = new Date().getFullYear();
renderProducts();
renderBag();
