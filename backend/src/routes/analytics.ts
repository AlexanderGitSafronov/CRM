import { Router } from 'express';
import {
  getSummary,
  getOrdersByDay,
  getRevenueByManager,
  getRevenueByProduct,
  getExpenses,
  createExpense,
  deleteExpense,
} from '../controllers/analyticsController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/summary', getSummary);
router.get('/orders-by-day', getOrdersByDay);
router.get('/revenue-by-manager', getRevenueByManager);
router.get('/revenue-by-product', getRevenueByProduct);
router.get('/expenses', getExpenses);
router.post('/expenses', requireRole('ADMIN', 'MANAGER'), createExpense);
router.delete('/expenses/:id', requireRole('ADMIN'), deleteExpense);

export default router;
