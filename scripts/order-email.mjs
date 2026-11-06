// Server only. Recipient is fixed; browser input cannot choose the destination.
export const ORDER_EMAIL_TO='ergongbeef@gmail.com';
export function emailConfigured(env){return Boolean(env.RESEND_API_KEY&&env.ORDER_EMAIL_FROM);}
export function orderEmailText(order){
 return ['貳恭 ER GONG 新訂單','訂單編號：'+order.no,'建立時間：'+order.at,'收件人：'+order.name,'電話：'+order.tel,'IG：@'+order.instagram,'取貨門市：'+order.addr,'付款方式：超商貨到付款','',...order.items.map(item=>`${item.name}${item.spec?' / '+item.spec:''} × ${item.qty} — NT$${item.price*item.qty}`),'','商品小計：NT$'+order.sub,'運費：NT$'+order.fee,'應付金額：NT$'+order.total,order.note?'備註：'+order.note:'','請確認庫存後安排出貨；此通知不代表款項已支付。'].filter(Boolean).join('\n');
}
export function queueOrderEmail(database,order){return database.prepare('INSERT INTO order_notifications (order_no,status,updated_at) VALUES (?,?,?)').bind(order.no,'pending',order.at);}
export async function sendOrderEmail(database,order,env){
 // Queue is inserted in the same transaction as the order. Failure never loses the order.
 const row=await database.prepare('SELECT status FROM order_notifications WHERE order_no = ?').bind(order.no).first();
 if(!row)return {status:'not_queued'};
 if(row.status==='sent')return {status:'sent'};
 if(!emailConfigured(env))return {status:'pending'};
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json','idempotency-key':'ergong-order-'+order.no},body:JSON.stringify({from:env.ORDER_EMAIL_FROM,to:[ORDER_EMAIL_TO],subject:'貳恭新訂單 '+order.no,text:orderEmailText(order)}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error();
  const result=await response.json();if(typeof result.id!=='string'||!result.id)throw Error();
  await database.prepare('UPDATE order_notifications SET status = ?, provider_id = ?, updated_at = ? WHERE order_no = ?').bind('sent',result.id,new Date().toISOString(),order.no).run();
  return {status:'sent'};
 }catch{
  // No tokens, customer data, or provider error payloads in logs. Pending can be retried by admin.
  return {status:'pending'};
 }
}
