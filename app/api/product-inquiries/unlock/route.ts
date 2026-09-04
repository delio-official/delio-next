import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-admin';

/* 비밀글 잠금해제 — 비밀번호를 서버에서 대조. 맞을 때만 내용 반환(비번은 클라이언트로 안 나감) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = body?.id as string | undefined;
  const password = (body?.password ?? '').toString();
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from('product_inquiries')
    .select('content, is_private, password')
    .eq('id', id)
    .maybeSingle();

  if (!data || !data.is_private) return NextResponse.json({ ok: false });
  if (data.password && password === String(data.password)) {
    return NextResponse.json({ ok: true, content: data.content });
  }
  return NextResponse.json({ ok: false });
}
