import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { runTrackingCycle } from '../workers/npTracker';
import { runSlaCheck } from '../workers/slaTracker';
import { runCallbackCheck } from '../workers/callbackReminder';
import { runLowStockCheck } from '../workers/lowStockWatcher';
import prisma from '../services/prisma';
import { getTurboSmsBalance } from '../services/turbosms';
import { sendTelegramMessage } from '../services/telegram';
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

// Порог низкого баланса TurboSMS — при падении ниже шлём ОДИН алерт в Telegram.
const TURBOSMS_LOW_BALANCE_THRESHOLD = Number(process.env.TURBOSMS_LOW_BALANCE_THRESHOLD) || 50;

// Для каждой организации с активной интеграцией TurboSMS запрашиваем баланс
// и, если он ниже порога, шлём одно предупреждение в командный чат Telegram.
async function runSmsBalanceCheck(): Promise<{ checked: number; lowBalance: number }> {
  const result = { checked: 0, lowBalance: 0 };

  const integrations = await prisma.integration.findMany({
    where: { type: 'TURBOSMS', active: true },
    select: { organizationId: true, config: true },
  });

  for (const integration of integrations) {
    let token: string | undefined;
    try {
      const cfg = JSON.parse(integration.config) as { token?: string };
      token = cfg.token;
    } catch {
      continue; // битый JSON — пропускаем
    }
    if (!token) continue;

    result.checked += 1;
    const balance = await getTurboSmsBalance(token);
    if (balance === null || balance >= TURBOSMS_LOW_BALANCE_THRESHOLD) continue;

    result.lowBalance += 1;

    // Один алерт в командный чат, если у org настроен Telegram.
    try {
      const tg = await prisma.integration.findUnique({
        where: { organizationId_type: { organizationId: integration.organizationId, type: 'TELEGRAM' } },
      });
      if (tg?.active) {
        const cfg = JSON.parse(tg.config) as { botToken?: string; chatId?: string };
        if (cfg.botToken && cfg.chatId) {
          await sendTelegramMessage({
            botToken: cfg.botToken,
            chatId: cfg.chatId,
            message: `⚠️ Баланс TurboSMS низький: ${balance}`,
          });
        }
      }
    } catch (tgErr) {
      logger.error('SMS balance telegram alert error:', tgErr);
    }
  }

  logger.info(`SMS balance: checked=${result.checked} lowBalance=${result.lowBalance}`);
  return result;
}

const JOBS: Record<string, () => Promise<unknown>> = {
  np: runTrackingCycle,
  sla: runSlaCheck,
  callbacks: runCallbackCheck,
  lowstock: runLowStockCheck,
  // 'smsbalance' намеренно НЕ входит в JOBS/'all': шлёт алерты в Telegram,
  // на частом тике 'all' это спамило бы команду. Дёргается отдельно
  // (например раз в сутки своим расписанием). См. обработку job в runJob.
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

    if (job === 'smsbalance') {
      const stats = await runSmsBalanceCheck();
      return res.json({ job: 'smsbalance', ...stats });
    }

    const fn = JOBS[job];
    if (!fn) {
      return res.status(404).json({ error: 'Unknown job. Use: np | sla | callbacks | lowstock | smsbalance | all' });
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
