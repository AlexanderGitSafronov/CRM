import { Router } from 'express';
import { login, getMe, changePassword } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.put('/password', authenticate, changePassword);

export default router;
