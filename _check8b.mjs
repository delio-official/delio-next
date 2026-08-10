import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const nos = ['ORD-20260611-339d2d','ORD-20260723-e3477f','ORD-20260724-eae9f1','ORD-20260801-f1e118','ORD-20260726-e2cbc0'];
const { data } = await sb.from('orders')
  .select('order_no, status, final_amount, coupon_discount, point_used, used_coupon_id, refund_restored')
  .in('order_no', nos);
for (const o of data) {
  console.log(`${o.order_no} | 쿠폰할인 ${o.coupon_discount||0} | 포인트사용 ${o.point_used||0} | 쿠폰ID ${o.used_coupon_id||'없음'} | restored=${o.refund_restored}`);
}
process.exit(0);
