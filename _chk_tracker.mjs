import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const get = k => (env.match(new RegExp('^'+k+'=(.*)','m'))||[])[1]?.trim();
const id = get('TRACKER_CLIENT_ID'), secret = get('TRACKER_CLIENT_SECRET');
console.log('CLIENT_ID:', id ? id.slice(0,8)+'…('+id.length+'자)' : '❌없음');
console.log('CLIENT_SECRET:', secret ? '설정됨('+secret.length+'자)' : '❌없음');
if (!id || !secret) { console.log('\n→ .env.local에 자격증명이 없습니다. 어디에 넣으셨나요?'); process.exit(0); }
console.log('\n=== 토큰 발급 시도 ===');
const res = await fetch('https://auth.tracker.delivery/oauth2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
});
const j = await res.json().catch(()=>({}));
if (res.ok && j.access_token) {
  console.log('✅ 인증 성공! 토큰 발급됨 (만료까지', Math.round((j.expires_in||0)/86400), '일)');
} else {
  console.log('❌ 인증 실패 (HTTP', res.status, ')');
  console.log('   응답:', JSON.stringify(j));
}
