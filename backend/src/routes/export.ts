import { Router } from 'express';
import { exportOrders, exportFinances, getActivityLogs } from '../controllers/exportController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/orders', exportOrders);
router.get('/finances', exportFinances);
router.get('/logs', requireRole('ADMIN'), getActivityLogs);

export default router;
