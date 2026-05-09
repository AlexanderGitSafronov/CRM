import { Router } from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  ccUpdateOrder,
  deleteOrder,
  bulkUpdateStatus,
  bulkAssignManager,
  bulkDelete,
  getOrderHistory,
} from '../controllers/orderController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getOrders);
router.post('/', requireRole('ADMIN', 'MANAGER'), createOrder);
router.post('/bulk-status', requireRole('ADMIN', 'MANAGER'), bulkUpdateStatus);
router.post('/bulk-assign', requireRole('ADMIN', 'MANAGER'), bulkAssignManager);
router.post('/bulk-delete', requireRole('ADMIN'), bulkDelete);
router.get('/:id', getOrder);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), updateOrder);
router.patch('/:id', requireRole('ADMIN', 'MANAGER', 'CALL_CENTER'), ccUpdateOrder);
router.delete('/:id', requireRole('ADMIN'), deleteOrder);
router.get('/:id/history', getOrderHistory);

export default router;
