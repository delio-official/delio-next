import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const nos = ['ORD-20260801-f1e118','ORD-20260801-113ba6','ORD-20260726-e2cbc0','ORD-20260724-4bb774','ORD-20260724-eae9f1','ORD-20260723-e3477f','ORD-20260611-339d2d','ORD-20260802-ddeab1'];

const { data: orders } = await sb.from('orders')
  .select('id, order_no, status, final_amount, partial_refund_amount, refund_restored')
  .in('order_no', nos);

for (const o of orders) {
  const { data: rr } = await sb.from('refund_requests')
    .select('type, status, refund_amount, reason, created_at').eq('order_id', o.id).order('created_at');
  console.log(`\n■ ${o.order_no} | status=${o.status} | 결제 ${o.final_amount} | partial_refund=${o.partial_refund_amount} | restored=${o.refund_restored}`);
  if (!rr || !rr.length) console.log('   환불요청 기록: 없음');
  else rr.forEach(r => console.log(`   [환불요청] type=${r.type} status=${r.status} 금액=${r.refund_amount} 사유=${r.reason} (${r.created_at?.slice(0,10)})`));
}
process.exit(0);
