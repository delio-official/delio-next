/* 기존 스토리지 이미지 일괄 축소 (같은 경로 덮어쓰기 → URL/DB 변경 없음).
   사용:
     node --env-file=.env.local shrink_images.mjs products          # 상품/농가 이미지 미리보기(dry-run)
     node --env-file=.env.local shrink_images.mjs products --apply  # 실제 적용
   대상 컬럼: products.thumbnail_url, products.image_urls, farms.thumbnail_url, farms.landing_images
*/
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const MAX = 1200, Q = 82;
const SIZE_THRESHOLD = 300 * 1024; // 300KB 초과만 처리

// public URL → { bucket, path }
function parse(url) {
  const m = url?.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  return m ? { bucket: m[1], path: decodeURIComponent(m[2]) } : null;
}

// 대상 URL 수집
const urls = new Set();
const { data: prods } = await admin.from('products').select('thumbnail_url, image_urls');
for (const p of prods || []) { if (p.thumbnail_url) urls.add(p.thumbnail_url); (p.image_urls || []).forEach(u => u && urls.add(u)); }
const { data: farms } = await admin.from('farms').select('thumbnail_url, landing_images');
for (const f of farms || []) { if (f.thumbnail_url) urls.add(f.thumbnail_url); (f.landing_images || []).forEach(u => u && urls.add(u)); }

console.log(`대상 이미지 ${urls.size}개 · 모드: ${APPLY ? '실제 적용' : 'DRY-RUN(미리보기)'}\n`);

let processed = 0, skipped = 0, failed = 0, savedBytes = 0;
for (const url of urls) {
  const loc = parse(url);
  if (!loc) { console.log('SKIP(파싱불가):', url); skipped++; continue; }
  try {
    const { data: dl, error: dlErr } = await admin.storage.from(loc.bucket).download(loc.path);
    if (dlErr || !dl) { console.log('SKIP(다운로드실패):', loc.path, dlErr?.message); skipped++; continue; }
    const buf = Buffer.from(await dl.arrayBuffer());
    const meta = await sharp(buf).metadata();
    const big = buf.length > SIZE_THRESHOLD || (meta.width || 0) > MAX + 100 || (meta.height || 0) > MAX + 100;
    if (!big) { skipped++; continue; }

    const pipeline = sharp(buf).rotate().resize(MAX, MAX, { fit: 'inside', withoutEnlargement: true });
    const fmt = (meta.format === 'png') ? 'png' : 'jpeg';
    const out = fmt === 'png'
      ? await pipeline.png({ quality: Q, compressionLevel: 9 }).toBuffer()
      : await pipeline.jpeg({ quality: Q }).toBuffer();
    const contentType = fmt === 'png' ? 'image/png' : 'image/jpeg';

    if (out.length >= buf.length) { skipped++; continue; } // 더 안 줄면 패스

    console.log(`${APPLY ? '적용' : '예정'}: ${loc.path}  ${Math.round(buf.length/1024)}KB → ${Math.round(out.length/1024)}KB (${meta.width}x${meta.height})`);
    savedBytes += (buf.length - out.length);
    if (APPLY) {
      const { error: upErr } = await admin.storage.from(loc.bucket).upload(loc.path, out, { upsert: true, contentType });
      if (upErr) { console.log('  업로드 실패:', upErr.message); failed++; continue; }
    }
    processed++;
  } catch (e) { console.log('SKIP(에러):', loc.path, e.message); failed++; }
}

console.log(`\n== 완료 ==`);
console.log(`처리 ${processed} · 건너뜀(이미 작음) ${skipped} · 실패 ${failed}`);
console.log(`절감 예상: ${(savedBytes/1024/1024).toFixed(1)}MB`);
if (!APPLY) console.log('\n※ DRY-RUN입니다. 실제 적용하려면 끝에 --apply 를 붙여 다시 실행하세요.');
