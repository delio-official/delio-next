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
    .select('id, category, content, is_private, password, answer, answered_at, created_at, user_id, author_name')
    .eq('product_id', productId)
    .order('created_at', { ascending: true })
    .limit(100);

  /* 관리자 작성 문의 표시(수정 버튼용) — 관리자에게만 내려준다. 고객에게 어떤 문의가 관리자 글인지 알려주지 않도록
     작성자 user_id 도 본인·관리자에게만 내려준다(예전엔 모두에게 내려가서 같은 계정이 쓴 글을 묶어볼 수 있었다) */
  let adminIds = new Set<string>();
  if (isAdmin) {
    const uids = [...new Set(((data || []) as { user_id: string | null }[]).map(q => q.user_id).filter((v): v is string => !!v))];
    if (uids.length) {
      const { data: ads } = await admin.from('profiles').select('id').in('id', uids).eq('is_admin', true);
      adminIds = new Set(((ads || []) as { id: string }[]).map(a => a.id));
    }
  }

  const inquiries = ((data || []) as {
    id: string; category: string; content: string; is_private: boolean;
    password: string | null; answer: string | null; answered_at: string | null;
    created_at: string; user_id: string | null; author_name: string | null;
  }[]).map(q => {
    const owner = !!user && q.user_id === user.id;
    const canView = !q.is_private || owner || isAdmin;
    return {
      id: q.id,
      user_id: owner || isAdmin ? q.user_id : null,
      category: q.category,
      content: canView ? q.content : '',   // 남의 비밀글 내용 마스킹
      is_private: q.is_private,
      has_password: !!q.password,           // 비번 유무만(비번 값은 미전송)
      answer: canView ? q.answer : null,   // 남의 비밀글은 답변도 가림(답변완료 표시는 answered_at 으로)
      answered_at: q.answered_at,
      created_at: q.created_at,
      author_name: q.author_name,          // 관리자가 작성 시 지정한 표시 이름(없으면 null)
      ...(isAdmin ? { by_admin: !!q.user_id && adminIds.has(q.user_id) } : {}),
    };
  });

  return NextResponse.json({ inquiries });
}
