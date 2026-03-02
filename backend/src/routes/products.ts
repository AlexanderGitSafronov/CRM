import { Router } from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
} from '../controllers/productController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', requireRole('ADMIN', 'MANAGER'), createProduct);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), updateProduct);
router.patch('/:id/stock', requireRole('ADMIN', 'MANAGER'), updateStock);
router.delete('/:id', requireRole('ADMIN'), deleteProduct);

export default router;
