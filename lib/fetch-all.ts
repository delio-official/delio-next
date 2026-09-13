/* PostgREST(Supabase)는 한 번에 최대 1,000행만 돌려준다 — .limit(5000) 처럼 늘려도 1,000행에서 잘린다.
   전체가 필요한 집계·목록은 이 함수로 1,000행씩 끝까지 받는다.
   makeQuery 는 매 페이지마다 새 쿼리를 만들어 .range(from, to) 를 붙여 반환해야 하고,
   페이지가 겹치거나 빠지지 않도록 정렬(.order)이 정해져 있어야 한다(보통 id). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T = any>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  opts: { pageSize?: number; max?: number } = {},
): Promise<{ data: T[]; error: { message: string } | null }> {
  const pageSize = opts.pageSize ?? 1000;
  const max = opts.max ?? 200000;
  const out: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) return { data: out, error };
    const rows = (data as T[] | null) || [];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return { data: out, error: null };
}
