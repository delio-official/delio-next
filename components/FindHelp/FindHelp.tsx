'use client';

import { useState } from 'react';

/* 아이디/비밀번호 찾기 공용 안내 아코디언 (접기/펼치기) */
export default function FindHelp({ title }: { title: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background:'#F6F7F6', borderRadius:8, marginTop:20, overflow:'hidden' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'14px 16px', background:'none', border:'none', cursor:'pointer',
          fontFamily:'inherit', fontSize:13, fontWeight:700, color:'#1A1A1A' }}>
        <span>{title} 안내</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ padding:'0 16px 16px', fontSize:12, color:'#888', lineHeight:1.7 }}>
          <div>· 카카오 · 네이버 등 SNS 간편로그인으로 가입하신 경우, SNS 로그인을 이용해주세요.</div>
          <div style={{ marginTop:6 }}>· 해당 SNS 계정의 아이디 · 비밀번호를 잊으신 경우, 카카오 · 네이버 등 해당 서비스에서 찾아주세요.</div>
          <div style={{ marginTop:6 }}>· 아이디 · 비밀번호 확인이 안 될 경우, 고객센터(070-8064-3601)로 문의해 주세요.</div>
        </div>
      )}
    </div>
  );
}
