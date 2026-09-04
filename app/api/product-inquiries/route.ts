import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 상품 Q&A 목록 조회 (서버 sanitize).
   - 남의 비밀글은 content를 비워서 반환(마스킹) → 브라우저로 내용이 전송되지 않음
   - password는 절대 클라이언트로 내보내지 않음(비번 유무만 has_password로 전달)
   - 본인/관리자는 비밀글도 내용 열람 가능 */
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get('productId');
  if (!productId) return NextResponse.json({ inquiries: [] });

  const sb = await createServerSupabaseClient();
  const { data: { user } } = await sb.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data } = await sb.rpc('is_current_user_admin');
    isAdmin = !!data;
  }

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from('product_inquiries')
    .select('id, category, content, is_private, password, answer, answered_at, created_at, user_id')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })
    .limit(100);

  const inquiries = ((data || []) as {
    id: string; category: string; content: string; is_private: boolean;
    password: string | null; answer: string | null; answered_at: string | null;
    created_at: string; user_id: string | null;
  }[]).map(q => {
    const owner = !!user && q.user_id === user.id;
    const canView = !q.is_private || owner || isAdmin;
    return {
      id: q.id,
      user_id: q.user_id,
      category: q.category,
      content: canView ? q.content : '',   // 남의 비밀글 내용 마스킹
      is_private: q.is_private,
      has_password: !!q.password,           // 비번 유무만(비번 값은 미전송)
      answer: q.answer,
      answered_at: q.answered_at,
      created_at: q.created_at,
    };
  });

  return NextResponse.json({ inquiries });
}
