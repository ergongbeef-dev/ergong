import {getCatalog} from '../scripts/catalog.mjs';
const origin='https://ergong.vercel.app';
export const revalidate=300;
export default async function sitemap(){const {products}=await getCatalog();return [{url:origin,changeFrequency:'daily',priority:1},...['terms','privacy'].map(path=>({url:origin+'/'+path,changeFrequency:'monthly',priority:.3})),...products.map(p=>({url:origin+'/products/'+p.id,changeFrequency:'daily',priority:.8}))];}
