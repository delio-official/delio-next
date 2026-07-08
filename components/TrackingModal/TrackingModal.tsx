'use client';

import { useState, useEffect } from 'react';

interface TrackingEvent {
  time: string;
  status: { code: string; name: string };
  description: string;
  location?: { name: string } | null;
}

interface TrackingData {
  lastEvent?: TrackingEvent;
  events?: TrackingEvent[];
}

interface Props {
  carrierId:      string;
  trackingNumber: string;
  courierName?:   string;
  onClose:        () => void;
}

const STATUS_COLOR: Record<string, string> = {
  'DELIVERED':   '#2D7A4D',
  'IN_TRANSIT':  '#2563EB',
  'OUT_FOR_DELIVERY': '#F59E0B',
  'PICKED_UP':   '#7C3AED',
  'INFORMATION_RECEIVED': '#64748B',
  'ATTEMPT_FAIL': '#EF4444',
};

const CARRIER_LABEL: Record<string, string> = {
  'kr.cjlogistics': 'CJ대한통운',
  'kr.lotte':       '롯데택배',
  'kr.hanjin':      '한진택배',
  'kr.epost':       '우체국택배',
  'kr.logen':       '로젠택배',
  'kr.lotteglogis': '롯데글로벌로지스',
  'kr.coupang':     '쿠팡로켓배송',
  'kr.cupost':      'CU편의점택배',
};

function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${mo}.${dd} ${hh}:${mm}`;
  } catch { return iso; }
}

export default function TrackingModal({ carrierId, trackingNumber, courierName, onClose }: Props) {
  const [data,    setData]    = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/tracking?carrierId=${encodeURIComponent(carrierId)}&trackingNumber=${encodeURIComponent(trackingNumber)}`
        );
        const json = await res.json();
        if (!res.ok || json.error) {
          setError(json.error || '조회 실패');
        } else {
          setData(json);
        }
      } catch {
        setError('네트워크 오류가 발생했습니다.');
      }
      setLoading(false);
    }
    load();
  }, [carrierId, trackingNumber]);

  const events = data?.events ? [...data.events].reverse() : [];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F0F0F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>배송추적</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              {courierName || CARRIER_LABEL[carrierId] || carrierId} · {trackingNumber}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
              color: '#94A3B8', lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        {/* 본문 */}
        <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
              조회 중...
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: 14, color: '#EF4444', marginBottom: 8 }}>{error}</div>
              {error.includes('API_KEY') && (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>
                  .env.local에 TRACKER_API_KEY를 설정해주세요.<br />
                  <a href="https://tracker.delivery" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#2563EB' }}>tracker.delivery</a>에서 무료 발급 가능합니다.
                </div>
              )}
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
              아직 배송 정보가 없습니다.
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <div style={{ position: 'relative' }}>
              {/* 세로 라인 */}
              <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8,
                width: 2, background: '#E2E8F0', borderRadius: 1 }} />

              {events.map((ev, i) => {
                const isLatest = i === 0;
                const color = STATUS_COLOR[ev.status.code] || '#64748B';
                return (
                  <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 20,
                    position: 'relative' }}>
                    {/* 도트 */}
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      background: isLatest ? color : '#CBD5E1',
                      border: `3px solid ${isLatest ? color : '#CBD5E1'}`,
                      zIndex: 1,
                      boxShadow: isLatest ? `0 0 0 4px ${color}22` : 'none',
                    }} />

                    {/* 내용 */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px',
                          borderRadius: 99, background: isLatest ? `${color}18` : '#F1F5F9',
                          color: isLatest ? color : '#64748B',
                        }}>
                          {ev.status.name}
                        </span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{fmtTime(ev.time)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: isLatest ? '#1A1A1A' : '#64748B',
                        fontWeight: isLatest ? 600 : 400 }}>
                        {ev.description}
                      </div>
                      {ev.location?.name && (
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                          📍 {ev.location.name}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
