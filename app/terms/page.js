import { termsSections as sections } from '../../scripts/policies.mjs';
export const metadata={title:'購買須知｜貳恭 ER GONG'};
export default function PolicyPage(){return <main className="blk policy-page"><article className="wrap doc"><a href="/">回到貳恭首頁</a><h1>購買須知</h1>{sections.map(([title,text])=><section key={title}><h2>{title}</h2><p>{text}</p></section>)}<p><a href="https://line.me/R/ti/p/@634xhfoj" target="_blank" rel="noopener noreferrer">聯繫官方 LINE</a></p><p><a href="/privacy">隱私權政策</a></p></article></main>}
