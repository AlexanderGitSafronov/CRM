import { Router } from 'express';
import {
  getNotifications,
  markRead,
  markReadByEntity,
  markAllRead,
  deleteNotification,
} from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.put('/read-by-entity/:entityId', markReadByEntity);
router.put('/:id/read', markRead);
router.delete('/:id', deleteNotification);

export default router;
