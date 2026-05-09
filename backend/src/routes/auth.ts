import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  register,
  getMe,
  changePassword,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Strict rate limit on signup-related endpoints
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1h
  max: 5, // 5 registrations per IP per hour
  message: { error: 'Забагато спроб. Спробуйте за годину.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Забагато запитів. Спробуйте пізніше.' },
});

router.post('/register', signupLimiter, register);
router.post('/login', login);
router.post('/forgot', resetLimiter, requestPasswordReset);
router.post('/reset', resetPassword);
router.post('/verify', verifyEmail);
router.get('/me', authenticate, getMe);
router.put('/password', authenticate, changePassword);

export default router;
