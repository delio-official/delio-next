import { createClient } from '@/lib/supabase';

export interface PublicCoupon {
  id: string;
  name: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  valid_days: number | null;
}

/** 공개(is_public) + 활성 + 기간 내 쿠폰 중, 해당 회원이 아직 보유하지 않은 것 = 다운가능 쿠폰 */
export async function getDownloadableCoupons(userId: string): Promise<PublicCoupon[]> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { data: pub } = await supabase
    .from('coupons')
    .select('id, name, discount_type, discount_value, min_order_amount, max_discount_amount, starts_at, expires_at, valid_days')
    .eq('is_public', true)
    .eq('is_active', true);
  if (!pub || pub.length === 0) return [];
  const { data: held } = await supabase
    .from('user_coupons')
    .select('coupon_id')
    .eq('user_id', userId);
  const heldSet = new Set((held || []).map((h: { coupon_id: string }) => h.coupon_id));
  return (pub as PublicCoupon[]).filter(
    (c) =>
      !heldSet.has(c.id) &&
      (!c.starts_at || c.starts_at <= now) &&
      (!c.expires_at || c.expires_at > now),
  );
}

/** 미보유 공개 쿠폰 전체를 회원 본인 계정으로 발급. 받은 개수 반환 (RLS: 본인 insert 허용) */
export async function claimAllPublic(userId: string): Promise<number> {
  const list = await getDownloadableCoupons(userId);
  if (list.length === 0) return 0;
  const supabase = createClient();
  const rows = list.map((c) => ({
    user_id: userId, coupon_id: c.id,
    // 유효기간(발급일+N일)이 설정돼 있으면 그 만료일, 아니면 절대 만료일
    expires_at: c.valid_days != null
      ? new Date(Date.now() + c.valid_days * 86400000).toISOString()
      : c.expires_at,
  }));
  const { error } = await supabase.from('user_coupons').insert(rows);
  if (error) { console.error('[claimAllPublic]', error.message); return 0; }
  return list.length;
}
