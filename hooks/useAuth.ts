'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // 세션 먼저 확인 (없으면 네트워크 호출/토큰 갱신 시도 안 함)
    supabase.auth.getSession().then(({ data: { session } }) => {
      // 로그인 유지 해제 시: 브라우저를 새로 연 경우(세션스토리지 없음) 자동 로그아웃
      if (session && localStorage.getItem('delio_session_only') === '1'
          && sessionStorage.getItem('delio_session_active') !== '1') {
        supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        return;
      }
      if (session) sessionStorage.setItem('delio_session_active', '1');
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setUser(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* 차단(블랙리스트) 회원은 이미 로그인 중이어도 즉시 로그아웃.
     로그인 시점 차단만으로는 기존 세션이 만료될 때까지 계속 이용 가능하므로 여기서도 검사한다. */
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: prof } = await supabase
        .from('profiles').select('is_blocked').eq('id', user.id).maybeSingle();
      if (!alive || !prof?.is_blocked) return;
      await supabase.auth.signOut();
      setUser(null);
      window.location.href = '/login?error=blocked';
    })();
    return () => { alive = false; };
  }, [user]);

  return { user, loading, loggedIn: !!user };
}
