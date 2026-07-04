/**
 * Безопасный разбор page/limit из query. parseInt('abc') === NaN, а
 * Math.max/Math.min с NaN дают NaN → Prisma падает с валидационной ошибкой (500).
 * Здесь NaN/нечисло/непозитив заменяются дефолтами, limit ограничен maxLimit.
 */
export function parsePagination(
  page: unknown,
  limit: unknown,
  opts: { defLimit?: number; maxLimit?: number } = {},
): { page: number; limit: number; skip: number } {
  const defLimit = opts.defLimit ?? 20;
  const maxLimit = opts.maxLimit ?? 100;

  const toPosInt = (v: unknown, def: number): number => {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
  };

  const p = toPosInt(page, 1);
  const l = Math.min(maxLimit, toPosInt(limit, defLimit));
  return { page: p, limit: l, skip: (p - 1) * l };
}
