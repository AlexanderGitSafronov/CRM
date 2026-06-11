import { Router } from 'express';
import {
  getSummary,
  getOrdersByDay,
  getRevenueByManager,
  getConversionByManager,
  getRevenueBySource,
  getRevenueByProduct,
  getRedemptionRate,
  getCancelReasons,
  getCustomerLtv,
  getKpi,
  getCustomersByCity,
  getCcStats,
  getExpenses,
  createExpense,
  deleteExpense,
  getCcPayroll,
  createCcPayment,
  deleteCcPayment,
} from '../controllers/analyticsController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/summary', requireRole('ADMIN', 'MANAGER'), getSummary);
router.get('/orders-by-day', requireRole('ADMIN', 'MANAGER'), getOrdersByDay);
router.get('/revenue-by-manager', requireRole('ADMIN', 'MANAGER'), getRevenueByManager);
router.get('/conversion-by-manager', requireRole('ADMIN', 'MANAGER'), getConversionByManager);
router.get('/revenue-by-source', requireRole('ADMIN', 'MANAGER'), getRevenueBySource);
router.get('/revenue-by-product', requireRole('ADMIN', 'MANAGER'), getRevenueByProduct);
router.get('/redemption-rate', requireRole('ADMIN', 'MANAGER'), getRedemptionRate);
router.get('/cancel-reasons', requireRole('ADMIN', 'MANAGER'), getCancelReasons);
router.get('/customer-ltv', requireRole('ADMIN', 'MANAGER'), getCustomerLtv);
router.get('/kpi', requireRole('ADMIN', 'MANAGER'), getKpi);
router.get('/customers-by-city', requireRole('ADMIN', 'MANAGER'), getCustomersByCity);
// cc-stats — селф-скоуп статистика колл-центра, доступна всем авторизованным ролям
router.get('/cc-stats', getCcStats);
router.get('/expenses', requireRole('ADMIN', 'MANAGER'), getExpenses);
router.post('/expenses', requireRole('ADMIN', 'MANAGER'), createExpense);
router.delete('/expenses/:id', requireRole('ADMIN'), deleteExpense);
router.get('/cc-payroll', requireRole('ADMIN'), getCcPayroll);
router.post('/cc-payroll', requireRole('ADMIN'), createCcPayment);
router.delete('/cc-payroll/:id', requireRole('ADMIN'), deleteCcPayment);

export default router;
