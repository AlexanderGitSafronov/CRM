import prisma from './prisma';

// Назначение менеджера. На Vercel serverless in-memory round-robin бесполезен
// (процесс живёт кратко, счётчик всё время 0 → все заказы падали на managers[0]).
// Делаем stateless «least-loaded»: отдаём новый заказ наименее загруженному
// за последние 30 дней менеджеру. Сохраняется между инстансами, честно балансирует.
export async function getNextManagerId(organizationId: string): Promise<string | null> {
  const managers = await prisma.user.findMany({
    where: { organizationId, active: true, role: { in: ['MANAGER', 'ADMIN'] } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!managers.length) return null;
  if (managers.length === 1) return managers[0].id;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const counts = await prisma.order.groupBy({
    by: ['managerId'],
    where: { organizationId, managerId: { in: managers.map((m) => m.id) }, createdAt: { gte: since } },
    _count: { id: true },
  });
  const countByManager = new Map(counts.map((c) => [c.managerId, c._count.id]));

  let best = managers[0].id;
  let bestCount = countByManager.get(best) ?? 0;
  for (const m of managers) {
    const c = countByManager.get(m.id) ?? 0;
    if (c < bestCount) {
      best = m.id;
      bestCount = c;
    }
  }
  return best;
}
