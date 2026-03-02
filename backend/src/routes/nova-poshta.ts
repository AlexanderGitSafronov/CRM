import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
router.use(authenticate);

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/';

async function npPost(calledMethod: string, modelName: string, methodProperties: object) {
  const apiKey = process.env.NP_API_KEY || '';
  const response = await fetch(NP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
  });
  return response.json() as Promise<{ success: boolean; data: unknown[] }>;
}

// GET /api/nova-poshta/cities?q=Київ
router.get('/cities', async (req: Request, res: Response) => {
  const { q } = req.query as Record<string, string>;
  if (!q || q.trim().length < 2) {
    return res.json({ data: [] });
  }

  try {
    const result = await npPost('searchSettlements', 'Address', {
      CityName: q.trim(),
      Limit: 7,
      Page: 1,
    });

    if (!result.success) {
      return res.json({ data: [] });
    }

    type NpAddress = { Present: string; DeliveryCity: string; SettlementRef: string };
    type NpSearchResult = { Addresses: NpAddress[] };
    const addresses = (result.data?.[0] as NpSearchResult)?.Addresses ?? [];

    const cities = addresses.map((a) => ({
      ref: a.DeliveryCity,       // CityRef for getWarehouses
      settlementRef: a.SettlementRef,
      label: a.Present,
    }));

    return res.json({ data: cities });
  } catch (error) {
    logger.error('Nova Poshta city search error:', error);
    return res.json({ data: [] });
  }
});

// GET /api/nova-poshta/warehouses?cityRef=...&q=12
router.get('/warehouses', async (req: Request, res: Response) => {
  const { cityRef, q } = req.query as Record<string, string>;
  if (!cityRef) {
    return res.json({ data: [] });
  }

  try {
    const result = await npPost('getWarehouses', 'AddressGeneral', {
      CityRef: cityRef,
      Limit: 150,
      Page: 1,
      ...(q?.trim() ? { FindByString: q.trim() } : {}),
    });

    if (!result.success) {
      return res.json({ data: [] });
    }

    type NpWarehouse = {
      Ref: string;
      Description: string;
      ShortAddress: string;
      TypeOfWarehouse: string;
      Number: string;
    };

    const warehouses = (result.data as NpWarehouse[]).map((w) => ({
      ref: w.Ref,
      label: w.Description,
      shortAddress: w.ShortAddress,
      number: w.Number,
      // TypeOfWarehouse: distinguish branch vs postomat
      isPostomat: w.TypeOfWarehouse === '841339c7-591a-42e2-8233-7a0a00f0ed6f',
    }));

    return res.json({ data: warehouses });
  } catch (error) {
    logger.error('Nova Poshta warehouse search error:', error);
    return res.json({ data: [] });
  }
});

export default router;
