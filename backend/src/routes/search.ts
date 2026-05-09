import { Router } from 'express';
import { search, lookupByPhone } from '../controllers/searchController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', search);
router.get('/customers/lookup', lookupByPhone);

export default router;
