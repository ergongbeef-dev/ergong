'use client';
import Script from 'next/script';
// React owns the page shell; the existing storefront controller owns only #app
// and its dialog. Keeping those DOM boundaries avoids two renderers per subtree.
const go=(view)=>window.go?.(view);
const jump=(id)=>window.jumpSection?.(id);
export default function Storefront(){return <>
<a className="skip-link" href="#app">跳至主要內容</a>
<div className="preview-notice">線上接單開放 · 超商冷凍取貨・貨到付款</div>
<header className="bar"><div className="wrap bar__in">
<button className="logo" onClick={()=>go('home')} aria-label="貳恭首頁"><span className="logo__mark">貳</span><span className="logo__tx"><b>貳恭 <span className="logo__product">濕式牛肉乾</span></b><span className="en">ER GONG</span></span></button>
<nav className="main" id="nav" aria-label="主要導覽"><button data-v="home" onClick={()=>go('home')}>首頁</button><button data-v="shop" onClick={()=>go('shop')}>全部商品</button><button data-v="about" onClick={()=>jump('brand-story')}>關於貳恭</button><button data-v="terms" onClick={()=>jump('faq')}>購買須知</button></nav>
<div className="bar__act"><button className="iconbtn menubtn" onClick={()=>window.toggleMenu?.()} aria-label="開啟選單" aria-controls="nav" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><button className="iconbtn" onClick={()=>window.openSearch?.()} aria-label="搜尋商品"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button><button className="iconbtn" id="cartButton" onClick={()=>go('cart')} aria-label="購物車，目前 0 件"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h2l3 12h10l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span className="badge hidden" id="cartBadge">0</span></button></div>
</div></header>
<main id="app" tabIndex={-1}/><noscript><div className="wrap"><p className="note">請開啟 JavaScript 以瀏覽商品與使用購物車。</p></div></noscript>
<footer className="ft"><div className="wrap ft__in"><div className="ft__lk"><a href="#" onClick={e=>{e.preventDefault();go('terms')}}>購買須知</a><a href="#" onClick={e=>{e.preventDefault();go('privacy')}}>隱私權政策</a><a id="ftIg" href="https://www.instagram.com/ergong_beef.ig/" target="_blank" rel="noopener noreferrer">Instagram</a><a id="ftLine" href="https://line.me/R/ti/p/@634xhfoj" target="_blank" rel="noopener noreferrer">LINE 官方帳號</a></div><div className="ft__cp">貳恭 ER GONG ・ 濕式牛肉乾</div></div></footer>
<div className="fab"><a className="l" id="fabLine" href="https://line.me/R/ti/p/@634xhfoj" target="_blank" rel="noopener noreferrer">加 LINE 好友</a></div><dialog id="modalHost" aria-label="操作視窗"/>
<Script src="/storefront.js" strategy="afterInteractive"/>
</>}
