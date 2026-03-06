import prisma from './prisma';

// In-memory round-robin index
let rrIndex = 0;

/**
 * Returns the next active MANAGER user ID in round-robin order.
 * Returns null if no managers are available.
 */
export async function getNextManagerId(): Promise<string | null> {
  const managers = await prisma.user.findMany({
    where: { active: true, role: { in: ['MANAGER', 'ADMIN'] } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!managers.length) return null;

  const idx = rrIndex % managers.length;
  rrIndex = (rrIndex + 1) % managers.length;

  return managers[idx].id;
}
