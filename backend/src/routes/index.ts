import { Router } from 'express';
import authRoutes from './auth';
import orderRoutes from './orders';
import customerRoutes from './customers';
import productRoutes from './products';
import userRoutes from './users';
import analyticsRoutes from './analytics';
import webhookRoutes from './webhook';
import notificationRoutes from './notifications';
import exportRoutes from './export';
import integrationRoutes from './integrations';
import eventsRoutes from './events';
import novaPoshtaRoutes from './nova-poshta';
import callbackRoutes from './callbacks';
import telegramRoutes from './telegram';

const router = Router();

router.use('/auth', authRoutes);
router.use('/events', eventsRoutes);
router.use('/orders', orderRoutes);
router.use('/customers', customerRoutes);
router.use('/products', productRoutes);
router.use('/users', userRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/webhook', webhookRoutes);
router.use('/notifications', notificationRoutes);
router.use('/export', exportRoutes);
router.use('/integrations', integrationRoutes);
router.use('/nova-poshta', novaPoshtaRoutes);
router.use('/callbacks', callbackRoutes);
router.use('/telegram', telegramRoutes);

export default router;
