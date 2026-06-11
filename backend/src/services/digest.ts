import prisma from './prisma';
import { sendTelegramMessage } from './telegram';
import { sendMail } from './email';
import logger from '../utils/logger';

/**
 * Еженедельный дайджест владельцу: «честные деньги» за последние 7 дней
 * против предыдущих 7 дней. Реализованная выручка считается ТОЛЬКО по
 * DELIVERED-заказам и датируется по deliveredAt (реальный выкуп COD), а не
 * по createdAt. Возвраты — по returnedAt. Всё org-scoped и ограничено окном.
 *
 * Дайджест ДОРМАНТ: запускается только когда внешний планировщик дёргает
 * /api/cron/digest. В 'all' он намеренно НЕ входит (слался бы на каждый тик).
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LOW_STOCK_FALLBACK = 5;

interface OrgWindowStats {
  revenue: number;
  cogs: number;
  delivered: number;
  returned: number;
  topProduct: { name: string; revenue: number } | null;
}

interface ManagerRevenue {
  name: string;
  revenue: number;
}

// Дельта в процентах текущего значения относительно предыдущего.
// null, если прошлая неделя была нулевой (рост «из нуля» не информативен).
function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function fmtDelta(delta: number | null): string {
  if (delta === null) return '';
  const sign = delta > 0 ? '+' : '';
  return ` (${sign}${delta}%)`;
}

function fmtMoney(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return `${v.toLocaleString('uk-UA')} ₴`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Реализованные деньги по DELIVERED за окно [from, to] (датировано deliveredAt)
// + возвраты по returnedAt за то же окно. COGS считается из purchasePrice
// позиций. Возвращает агрегаты + топ-товар по выручке.
async function computeWindow(orgId: string, from: Date, to: Date): Promise<OrgWindowStats> {
  const [deliveredItems, delivered, returnedCount] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: {
          organizationId: orgId,
          status: 'DELIVERED',
          deliveredAt: { gte: from, lte: to },
        },
      },
      select: {
        name: true,
        quantity: true,
        price: true,
        productId: true,
        product: { select: { purchasePrice: true } },
      },
    }),
    // Кол-во доставленных (выкупленных) заказов за окно.
    prisma.order.count({
      where: {
        organizationId: orgId,
        status: 'DELIVERED',
        deliveredAt: { gte: from, lte: to },
      },
    }),
    prisma.order.count({
      where: {
        organizationId: orgId,
        status: 'RETURNED',
        returnedAt: { gte: from, lte: to },
      },
    }),
  ]);

  let revenue = 0;
  let cogs = 0;
  const byProduct: Record<string, { name: string; revenue: number }> = {};

  for (const item of deliveredItems) {
    const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
    const price = Number.isFinite(item.price) ? item.price : 0;
    const purchase = Number.isFinite(item.product?.purchasePrice ?? NaN) ? (item.product!.purchasePrice) : 0;
    const lineRevenue = price * qty;
    revenue += lineRevenue;
    cogs += purchase * qty;

    const key = item.productId || item.name;
    if (!byProduct[key]) byProduct[key] = { name: item.name, revenue: 0 };
    byProduct[key].revenue += lineRevenue;
  }

  const topProduct = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue)[0] || null;

  return { revenue, cogs, delivered, returned: returnedCount, topProduct };
}

// Лучший/худший менеджер по реализованной выручке (DELIVERED по deliveredAt)
// за окно. Возвращает только тех, у кого была хоть какая-то выручка.
async function computeManagerRevenue(orgId: string, from: Date, to: Date): Promise<ManagerRevenue[]> {
  const managers = await prisma.user.findMany({
    where: { organizationId: orgId, role: { in: ['ADMIN', 'MANAGER'] }, active: true },
    select: { id: true, name: true },
  });

  const rows = await Promise.all(
    managers.map(async (m) => {
      const agg = await prisma.order.aggregate({
        where: {
          organizationId: orgId,
          managerId: m.id,
          status: 'DELIVERED',
          deliveredAt: { gte: from, lte: to },
        },
        _sum: { total: true },
      });
      const revenue = agg._sum.total || 0;
      return { name: m.name, revenue: Number.isFinite(revenue) ? revenue : 0 };
    })
  );

  return rows.filter((r) => r.revenue > 0).sort((a, b) => b.revenue - a.revenue);
}

// Доля выкупа: delivered / (delivered + returned) по терминальным датам окна.
function redemption(delivered: number, returned: number): number | null {
  const resolved = delivered + returned;
  if (resolved <= 0) return null;
  return Math.round((delivered / resolved) * 100 * 10) / 10;
}

// Собирает компактное украинское сообщение (10-ish строк) с дельтами.
function buildMessage(
  orgName: string,
  cur: OrgWindowStats,
  prev: OrgWindowStats,
  managers: ManagerRevenue[],
  overdueCallbacks: number,
  lowStock: number
): { telegram: string; emailHtml: string; emailText: string; subject: string } {
  const curProfit = cur.revenue - cur.cogs;
  const prevProfit = prev.revenue - prev.cogs;
  const curRedemption = redemption(cur.delivered, cur.returned);
  const prevRedemption = redemption(prev.delivered, prev.returned);

  const best = managers[0] || null;
  const worst = managers.length > 1 ? managers[managers.length - 1] : null;

  const redemptionDelta =
    curRedemption !== null && prevRedemption !== null
      ? Math.round((curRedemption - prevRedemption) * 10) / 10
      : null;
  const redemptionDeltaStr =
    redemptionDelta === null ? '' : ` (${redemptionDelta > 0 ? '+' : ''}${redemptionDelta} п.п.)`;

  const lines: string[] = [];
  lines.push(`📊 Тижневий звіт — ${orgName}`);
  lines.push('');
  lines.push(`Виручка: ${fmtMoney(cur.revenue)}${fmtDelta(pctDelta(cur.revenue, prev.revenue))}`);
  lines.push(`Прибуток: ${fmtMoney(curProfit)}${fmtDelta(pctDelta(curProfit, prevProfit))}`);
  lines.push(`Доставлено (викуп): ${cur.delivered}${fmtDelta(pctDelta(cur.delivered, prev.delivered))}`);
  lines.push(
    `Викуп: ${curRedemption === null ? '—' : `${curRedemption}%`}${redemptionDeltaStr}`
  );
  lines.push(`Повернень: ${cur.returned}${fmtDelta(pctDelta(cur.returned, prev.returned))}`);
  lines.push(`Топ-товар: ${cur.topProduct ? `${cur.topProduct.name} (${fmtMoney(cur.topProduct.revenue)})` : '—'}`);
  if (best) lines.push(`Найкращий менеджер: ${best.name} (${fmtMoney(best.revenue)})`);
  if (worst && worst.name !== best?.name) lines.push(`Найслабший менеджер: ${worst.name} (${fmtMoney(worst.revenue)})`);
  lines.push(`Прострочені передзвони: ${overdueCallbacks}`);
  lines.push(`Товари на межі: ${lowStock}`);

  const text = lines.join('\n');

  // Telegram (HTML parse_mode): экранируем и заголовок жирним.
  const tgLines = lines.map((l, i) => (i === 0 ? `<b>${escapeHtml(l)}</b>` : escapeHtml(l)));
  const telegram = tgLines.join('\n');

  // Email HTML — простой список строк.
  const htmlBody = lines
    .map((l, i) => {
      if (i === 0) return `<h1 style="font-size:20px;color:#111827;margin:0 0 8px;">${escapeHtml(l)}</h1>`;
      if (l === '') return '';
      return `<p style="color:#374151;line-height:1.6;margin:4px 0;">${escapeHtml(l)}</p>`;
    })
    .join('');

  return {
    telegram,
    emailText: text,
    emailHtml: htmlBody,
    subject: `Тижневий звіт CRM — ${orgName}`,
  };
}

/**
 * Запускает еженедельный дайджест для всех активных организаций.
 * Каждая отправка — fire-and-forget с try/catch (одна упавшая не валит остальные).
 */
export async function runWeeklyDigest(): Promise<{ orgsProcessed: number; sent: number }> {
  const result = { orgsProcessed: 0, sent: 0 };

  const now = new Date();
  const curFrom = new Date(now.getTime() - WEEK_MS);
  const curTo = now;
  const prevFrom = new Date(now.getTime() - 2 * WEEK_MS);
  const prevTo = curFrom;

  let orgs: Array<{ id: string; name: string }> = [];
  try {
    orgs = await prisma.organization.findMany({
      where: { active: true },
      select: { id: true, name: true },
    });
  } catch (err) {
    logger.error('Weekly digest: failed to load organizations:', err);
    return result;
  }

  for (const org of orgs) {
    result.orgsProcessed += 1;
    try {
      const [cur, prev, managers, overdueCallbacks, lowStock] = await Promise.all([
        computeWindow(org.id, curFrom, curTo),
        computeWindow(org.id, prevFrom, prevTo),
        computeManagerRevenue(org.id, curFrom, curTo),
        prisma.callback.count({
          where: { organizationId: org.id, done: false, scheduledAt: { lte: now } },
        }),
        prisma.product.count({
          where: {
            organizationId: org.id,
            active: true,
            OR: [
              { stock: { lte: prisma.product.fields.lowStockThreshold } },
              { stock: { lt: LOW_STOCK_FALLBACK } },
            ],
          },
        }),
      ]);

      const msg = buildMessage(org.name, cur, prev, managers, overdueCallbacks, lowStock);

      let delivered = false;

      // Telegram (если настроен и активен).
      try {
        const tg = await prisma.integration.findUnique({
          where: { organizationId_type: { organizationId: org.id, type: 'TELEGRAM' } },
        });
        if (tg?.active) {
          const cfg = JSON.parse(tg.config) as { botToken?: string; chatId?: string };
          if (cfg.botToken && cfg.chatId) {
            const ok = await sendTelegramMessage({
              botToken: cfg.botToken,
              chatId: cfg.chatId,
              message: msg.telegram,
            });
            if (ok) delivered = true;
          }
        }
      } catch (tgErr) {
        logger.error(`Weekly digest telegram error (org ${org.id}):`, tgErr);
      }

      // Email всем активным ADMIN'ам организации.
      try {
        const admins = await prisma.user.findMany({
          where: { organizationId: org.id, role: 'ADMIN', active: true },
          select: { email: true },
        });
        for (const admin of admins) {
          if (!admin.email) continue;
          try {
            const ok = await sendMail({
              to: admin.email,
              subject: msg.subject,
              html: msg.emailHtml,
              text: msg.emailText,
            });
            if (ok) delivered = true;
          } catch (mailErr) {
            logger.error(`Weekly digest email error (org ${org.id}, ${admin.email}):`, mailErr);
          }
        }
      } catch (adminErr) {
        logger.error(`Weekly digest admin lookup error (org ${org.id}):`, adminErr);
      }

      if (delivered) result.sent += 1;
    } catch (orgErr) {
      logger.error(`Weekly digest failed for org ${org.id}:`, orgErr);
    }
  }

  logger.info(`Weekly digest: orgsProcessed=${result.orgsProcessed} sent=${result.sent}`);
  return result;
}
