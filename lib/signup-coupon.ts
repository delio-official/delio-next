import { createClient } from '@/lib/supabase';

/** 신규가입 자동지급(signup_grant) 정액 쿠폰들의 할인액 합계.
   가입 완료화면(이메일·소셜)에서 "실제 주는 쿠폰 총액"을 표시하는 데 사용.
   관리자가 쿠폰을 추가/변경해도 이 합계가 자동으로 따라간다.
   (percent 쿠폰은 원화 합산이 불가하므로 fixed만 합산) */
export async function getSignupCouponTotal(): Promise<number> {
  const { data } = await createClient()
    .from('coupons')
    .select('discount_type, discount_value')
    .eq('signup_grant', true)
    .eq('is_active', true);
  const rows = (data ?? []) as { discount_type: string; discount_value: number }[];
  return rows
    .filter(c => c.discount_type === 'fixed')
    .reduce((sum, c) => sum + (Number(c.discount_value) || 0), 0);
}
