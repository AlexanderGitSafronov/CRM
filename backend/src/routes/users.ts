import { Router } from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/userController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));
router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
