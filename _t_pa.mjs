import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.from('orders').select('order_no,status,final_amount,created_at,paid_at,payment_method,payment_key,portone_payment_id').gte('created_at','2026-06-25').order('created_at',{ascending:false}).limit(8);
data.forEach(o=>console.log(o.order_no,'| final',o.final_amount,'| status',o.status,'| paid_at',o.paid_at,'| pm',o.payment_method,'| key',o.payment_key,'| portone',o.portone_payment_id));
