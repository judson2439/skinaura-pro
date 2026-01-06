import { Router } from 'express';
import authRouter from './auth.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to SkinAura API',
    version: '1.0.0',
  });
});

// Auth routes (with encrypted request handling)
router.use('/auth', authRouter);

export default router;

