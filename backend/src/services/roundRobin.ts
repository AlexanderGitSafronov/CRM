import prisma from './prisma';

// Per-org round-robin index (in-memory; resets on restart — acceptable)
const rrByOrg = new Map<string, number>();

export async function getNextManagerId(organizationId: string): Promise<string | null> {
  const managers = await prisma.user.findMany({
    where: { organizationId, active: true, role: { in: ['MANAGER', 'ADMIN'] } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!managers.length) return null;

  const idx = (rrByOrg.get(organizationId) ?? 0) % managers.length;
  rrByOrg.set(organizationId, (idx + 1) % managers.length);

  return managers[idx].id;
}
