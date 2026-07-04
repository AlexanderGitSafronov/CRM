import { Router, Response } from 'express';
import { parse } from 'csv-parse/sync';
import prisma from '../services/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/notifications';
import { validateImage } from '../controllers/productController';

const router = Router();
router.use(authenticate, requireRole('ADMIN', 'MANAGER'));

// Импорт идёт по одной строке (2 последовательных запроса к Neon на строку).
// На Vercel функция ограничена ~30s, поэтому крупные файлы завершались таймаутом
// с тихим частичным импортом. Ограничиваем размер и просим разбить файл.
const MAX_IMPORT_ROWS = 1000;

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

// Try to find a column by candidate header names (case-insensitive, accent-insensitive)
function pick(row: Record<string, string>, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase() === cand.toLowerCase());
    if (found) return row[found]?.trim() || undefined;
  }
  return undefined;
}

function parseCsv(raw: string): Record<string, string>[] {
  // Auto-detect delimiter: ; or ,
  const firstLine = raw.split(/\r?\n/)[0] || '';
  const delimiter = firstLine.includes(';') ? ';' : ',';
  return parse(raw, {
    columns: true,
    delimiter,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];
}

// POST /api/import/customers
// Body: { csv: string } — text content of CSV file
router.post('/customers', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { csv } = req.body as { csv?: string };
  if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv field required' });

  let rows: Record<string, string>[];
  try {
    rows = parseCsv(csv);
  } catch (e) {
    return res.status(400).json({ error: 'Не вдалось розпарсити CSV: ' + (e as Error).message });
  }

  if (!rows.length) return res.status(400).json({ error: 'Порожній файл' });
  if (rows.length > MAX_IMPORT_ROWS) {
    return res.status(400).json({ error: `Забагато рядків (${rows.length}). Розбийте файл на частини по ${MAX_IMPORT_ROWS}.` });
  }

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name = pick(row, ['name', 'имя', 'ім\'я', 'имʼя', 'фио', 'піб', 'клієнт', 'клиент', 'customer']);
      const phone = pick(row, ['phone', 'телефон', 'тел', 'phone_number']);
      if (!name || !phone) {
        result.errors.push({ row: i + 2, reason: 'name та phone обовʼязкові' });
        continue;
      }
      const email = pick(row, ['email', 'емейл', 'пошта', 'mail']);
      const city = pick(row, ['city', 'місто', 'город']);
      const address = pick(row, ['address', 'адреса', 'адрес']);
      const notes = pick(row, ['notes', 'примітки', 'заметки', 'comment']);

      const exists = await prisma.customer.findUnique({
        where: { organizationId_phone: { organizationId: orgId, phone } },
      });
      if (exists) {
        result.skipped++;
        continue;
      }

      await prisma.customer.create({
        data: {
          organizationId: orgId,
          name: name.slice(0, 120),
          phone,
          email: email || null,
          city: city || null,
          address: address || null,
          notes: notes || null,
        },
      });
      result.imported++;
    } catch (e) {
      result.errors.push({ row: i + 2, reason: (e as Error).message });
    }
  }

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'CUSTOMERS_IMPORTED',
    details: `Imported ${result.imported}, skipped ${result.skipped}, errors ${result.errors.length}`,
    ip: req.ip,
  });

  return res.json(result);
});

// POST /api/import/products
router.post('/products', async (req: AuthRequest, res: Response) => {
  const orgId = req.user!.organizationId;
  const { csv } = req.body as { csv?: string };
  if (!csv) return res.status(400).json({ error: 'csv field required' });

  let rows: Record<string, string>[];
  try {
    rows = parseCsv(csv);
  } catch (e) {
    return res.status(400).json({ error: 'Не вдалось розпарсити CSV: ' + (e as Error).message });
  }

  if (!rows.length) return res.status(400).json({ error: 'Порожній файл' });
  if (rows.length > MAX_IMPORT_ROWS) {
    return res.status(400).json({ error: `Забагато рядків (${rows.length}). Розбийте файл на частини по ${MAX_IMPORT_ROWS}.` });
  }

  // Plan limit
  const [org, currentCount] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { maxProducts: true } }),
    prisma.product.count({ where: { organizationId: orgId } }),
  ]);
  const limit = org?.maxProducts ?? 50;
  const room = Math.max(0, limit - currentCount);

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    if (result.imported >= room) {
      result.errors.push({ row: i + 2, reason: `Перевищено ліміт тарифу (${limit})` });
      break;
    }
    const row = rows[i];
    try {
      const name = pick(row, ['name', 'назва', 'название', 'товар', 'product']);
      if (!name) {
        result.errors.push({ row: i + 2, reason: 'name обовʼязкове' });
        continue;
      }
      const sku = pick(row, ['sku', 'артикул', 'код']);
      const description = pick(row, ['description', 'опис', 'описание']);
      const purchase = parseFloat((pick(row, ['purchasePrice', 'закупка', 'себестоимость', 'cost']) || '0').replace(',', '.'));
      const sale = parseFloat((pick(row, ['salePrice', 'price', 'цена', 'ціна']) || '0').replace(',', '.'));
      const stock = parseInt((pick(row, ['stock', 'остаток', 'залишок', 'qty']) || '0'));
      const image = pick(row, ['image', 'photo', 'фото', 'картинка']);

      // Skip if SKU already exists for this org
      if (sku) {
        const exists = await prisma.product.findUnique({
          where: { organizationId_sku: { organizationId: orgId, sku } },
        });
        if (exists) { result.skipped++; continue; }
      }

      // Картинку прогоняем через тот же валидатор, что и API (js:/svg/oversize → отбрасываем).
      const imgCheck = validateImage(image);
      const safeImage = imgCheck.ok ? imgCheck.value ?? null : null;

      await prisma.product.create({
        data: {
          organizationId: orgId,
          name: name.slice(0, 200),
          sku: sku || null,
          description: description || null,
          purchasePrice: isNaN(purchase) ? 0 : purchase,
          salePrice: isNaN(sale) ? 0 : sale,
          stock: isNaN(stock) ? 0 : stock,
          image: safeImage,
        },
      });
      result.imported++;
    } catch (e) {
      result.errors.push({ row: i + 2, reason: (e as Error).message });
    }
  }

  await logActivity({
    organizationId: orgId,
    userId: req.user?.id,
    action: 'PRODUCTS_IMPORTED',
    details: `Imported ${result.imported}, skipped ${result.skipped}, errors ${result.errors.length}`,
    ip: req.ip,
  });

  return res.json(result);
});

export default router;
