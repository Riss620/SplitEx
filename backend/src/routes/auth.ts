import { Router } from 'express';
import { register, login, logout, refresh, getProfile } from '../controllers/auth';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/profile', authenticate as any, getProfile as any);

export default router;
