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
router.get('/summary', getSummary);
router.get('/orders-by-day', getOrdersByDay);
router.get('/revenue-by-manager', getRevenueByManager);
router.get('/conversion-by-manager', getConversionByManager);
router.get('/revenue-by-source', getRevenueBySource);
router.get('/revenue-by-product', getRevenueByProduct);
router.get('/redemption-rate', getRedemptionRate);
router.get('/cancel-reasons', getCancelReasons);
router.get('/customer-ltv', getCustomerLtv);
router.get('/kpi', getKpi);
router.get('/customers-by-city', getCustomersByCity);
router.get('/cc-stats', getCcStats);
router.get('/expenses', getExpenses);
router.post('/expenses', requireRole('ADMIN', 'MANAGER'), createExpense);
router.delete('/expenses/:id', requireRole('ADMIN'), deleteExpense);
router.get('/cc-payroll', requireRole('ADMIN'), getCcPayroll);
router.post('/cc-payroll', requireRole('ADMIN'), createCcPayment);
router.delete('/cc-payroll/:id', requireRole('ADMIN'), deleteCcPayment);

export default router;
