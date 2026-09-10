import type { SupabaseClient } from '@supabase/supabase-js';
import { createHmac, randomBytes } from 'crypto';

/* 예약 문자 취소 (관리자).
   sms_logs 에는 솔라피 그룹 ID가 없으므로, 이력의 접수시각(created_at) 전후 5분에 만들어진
   솔라피 그룹 중 '예약중(SCHEDULED)' + 예약시각이 같은 그룹을 찾아 예약을 취소한다.
   admin = service-role Supabase client. */
function solapiAuth() {
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString('hex');
  const signature = createHmac('sha256', process.env.SOLAPI_API_SECRET || '').update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

interface SolapiGroup {
  groupId?: string; _id?: string; status?: string; scheduledDate?: string | null;
  dateCreated?: string; count?: { total?: number };
}

export async function cancelScheduledSms(
  admin: SupabaseClient,
  logId: string,
): Promise<{ ok: boolean; error?: string; groupId?: string }> {
  if (!process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET) return { ok: false, error: 'SMS 서비스 미설정' };

  const { data: log } = await admin.from('sms_logs')
    .select('id, status, scheduled_at, target_count, created_at').eq('id', logId).maybeSingle();
  if (!log) return { ok: false, error: '발송 이력을 찾을 수 없습니다.' };
  if (log.status !== 'reserved' || !log.scheduled_at) return { ok: false, error: '예약 발송 건이 아닙니다.' };
  const schedMs = new Date(log.scheduled_at).getTime();
  if (schedMs <= Date.now()) return { ok: false, error: '예약 시각이 이미 지나 발송된 건입니다.' };

  /* 이력 접수시각 ±5분 안에 생성된 솔라피 그룹 조회 (알림톡 등 다른 그룹이 많아 페이지 넘김) */
  const created = new Date(log.created_at).getTime();
  const startDate = new Date(created - 5 * 60000).toISOString();
  const endDate = new Date(created + 5 * 60000).toISOString();
  const groups: SolapiGroup[] = [];
  let startKey: string | null = null;
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ limit: '100', startDate, endDate });
    if (startKey) qs.set('startKey', startKey);
    const r = await fetch(`https://api.solapi.com/messages/v4/groups?${qs}`, { headers: { Authorization: solapiAuth() } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: `솔라피 조회 실패: ${j?.errorMessage || r.status}` };
    groups.push(...(Object.values(j?.groupList || {}) as SolapiGroup[]));
    startKey = j?.nextKey || null;
    if (!startKey) break;
  }

  let cands = groups.filter(g => g.status === 'SCHEDULED' && g.scheduledDate
    && Math.abs(new Date(g.scheduledDate).getTime() - schedMs) < 60000);
  if (cands.length > 1) cands = cands.filter(g => (g.count?.total ?? -1) === log.target_count);
  if (cands.length === 0) {
    return { ok: false, error: '솔라피에서 예약중인 발송을 찾지 못했습니다. 이미 발송됐거나 솔라피 사이트에서 취소됐을 수 있습니다.' };
  }
  if (cands.length > 1) {
    return { ok: false, error: '같은 시각에 예약된 발송이 여러 건이라 자동으로 구분할 수 없습니다. 솔라피 사이트에서 직접 취소해 주세요.' };
  }

  const groupId = cands[0].groupId || cands[0]._id || '';
  const r = await fetch(`https://api.solapi.com/messages/v4/groups/${groupId}/schedule`, {
    method: 'DELETE', headers: { Authorization: solapiAuth() },
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    return { ok: false, error: `예약 취소 실패: ${j?.errorMessage || r.status}` };
  }

  await admin.from('sms_logs').update({ status: 'cancelled', cost: 0 }).eq('id', logId);
  return { ok: true, groupId };
}
