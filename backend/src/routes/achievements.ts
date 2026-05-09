import { Router, Response } from 'express';
import prisma from '../services/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ACHIEVEMENT_DEFS, checkAchievements } from '../services/achievements';

const router = Router();
router.use(authenticate);

// GET /api/achievements — full list (unlocked + locked) for current org
router.get('/', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;

  // Trigger a check first so list is up-to-date
  await checkAchievements(orgId);

  const unlocked = await prisma.achievement.findMany({
    where: { organizationId: orgId },
    orderBy: { achievedAt: 'desc' },
  });
  const unlockedSet = new Map(unlocked.map((a) => [a.code, a]));

  const all = ACHIEVEMENT_DEFS.map((def) => {
    const u = unlockedSet.get(def.code);
    return {
      code: def.code,
      title: def.title,
      description: def.description,
      icon: def.icon,
      unlocked: !!u,
      achievedAt: u?.achievedAt ?? null,
    };
  });

  return res.json({
    achievements: all,
    unlockedCount: unlocked.length,
    totalCount: ACHIEVEMENT_DEFS.length,
  });
});

export default router;
