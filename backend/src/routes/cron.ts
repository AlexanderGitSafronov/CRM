import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { runTrackingCycle } from '../workers/npTracker';
import { runSlaCheck } from '../workers/slaTracker';
import { runCallbackCheck } from '../workers/callbackReminder';
import { runLowStockCheck } from '../workers/lowStockWatcher';
import logger from '../utils/logger';

/**
 * На Vercel (serverless) node-cron не работает — процесс живёт только на время
 * запроса. Этот роутер позволяет внешнему планировщику (Vercel Cron,
 * cron-job.org, GitHub Actions) дёргать тики воркеров по HTTP.
 *
 * Auth: заголовок `Authorization: Bearer <CRON_SECRET>`.
 */

const router = Router();

const checkCronAuth = (req: Request, res: Response): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'CRON_SECRET not configured' });
    return false;
  }

  const authHeader = req.headers.authorization;
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
};

const JOBS: Record<string, () => Promise<unknown>> = {
  np: runTrackingCycle,
  sla: runSlaCheck,
  callbacks: runCallbackCheck,
  lowstock: runLowStockCheck,
};

const runJob = async (req: Request, res: Response) => {
  if (!checkCronAuth(req, res)) return;

  const { job } = req.params;
  try {
    if (job === 'all') {
      const results: Record<string, unknown> = {};
      for (const [name, fn] of Object.entries(JOBS)) {
        results[name] = await fn();
      }
      return res.json({ job: 'all', results });
    }

    const fn = JOBS[job];
    if (!fn) {
      return res.status(404).json({ error: 'Unknown job. Use: np | sla | callbacks | lowstock | all' });
    }
    const stats = await fn();
    return res.json({ job, stats });
  } catch (err) {
    logger.error(`Cron job "${job}" failed:`, err);
    return res.status(500).json({ error: 'Job failed' });
  }
};

router.get('/:job', runJob);
router.post('/:job', runJob);

export default router;
