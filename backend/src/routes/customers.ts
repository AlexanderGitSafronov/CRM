import { Router } from 'express';
import { getCustomers, getCustomer, updateCustomer, deleteCustomer, toggleBlacklist } from '../controllers/customerController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getCustomers);
router.get('/:id', getCustomer);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), updateCustomer);
router.patch('/:id/blacklist', requireRole('ADMIN', 'MANAGER'), toggleBlacklist);
router.delete('/:id', requireRole('ADMIN'), deleteCustomer);

export default router;
