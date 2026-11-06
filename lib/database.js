import {createClient} from '@libsql/client';
import {readFile} from 'node:fs/promises';
let cachedClient,ready;
export function configuredDatabase(){return Boolean(process.env.TURSO_DATABASE_URL&&process.env.TURSO_AUTH_TOKEN)}
export async function database(){
 if(!configuredDatabase())throw new Error('訂單資料庫尚未設定，暫時無法下單。');
 cachedClient??=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
 if(!ready)ready=(async()=>{const schema=await readFile(new URL('../drizzle/0000_formal_storefront.sql',import.meta.url),'utf8');const statements=schema.split(';').map(s=>s.trim()).filter(s=>s&&!s.startsWith('PRAGMA'));await cachedClient.batch(statements,'write');})();
 try{await ready;}catch(error){ready=null;throw error;}
 function statement(sql,args=[]){return {sql,args,bind(...values){return statement(sql,values)},async first(){return (await cachedClient.execute({sql,args})).rows[0]||null},async all(){return {results:(await cachedClient.execute({sql,args})).rows}},async run(){return cachedClient.execute({sql,args})}}}
 return {prepare:sql=>statement(sql),batch:statements=>cachedClient.batch(statements.map(({sql,args})=>({sql,args})),'write')};
}
