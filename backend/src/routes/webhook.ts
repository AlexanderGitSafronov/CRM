import { Router } from 'express';
import {
  receiveOrder,
  getWebhookTokens,
  createWebhookToken,
  deleteWebhookToken,
} from '../controllers/webhookController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Public endpoint for receiving orders
router.post('/order', receiveOrder);

// Protected: manage webhook tokens
router.get('/tokens', authenticate, requireRole('ADMIN'), getWebhookTokens);
router.post('/tokens', authenticate, requireRole('ADMIN'), createWebhookToken);
router.delete('/tokens/:id', authenticate, requireRole('ADMIN'), deleteWebhookToken);

export default router;
