import { Router } from 'express';
import authRouter from './auth.js';
import uploadRouter from './upload.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to SkinAura API',
    version: '1.0.0',
  });
});

// Auth routes (with encrypted request handling)
router.use('/auth', authRouter);

// Upload routes (for avatars and other files)
router.use('/upload', uploadRouter);

export default router;
