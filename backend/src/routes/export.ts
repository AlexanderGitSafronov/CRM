import { Router } from 'express';
import { exportOrders, getActivityLogs } from '../controllers/exportController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/orders', exportOrders);
router.get('/logs', requireRole('ADMIN'), getActivityLogs);

export default router;
