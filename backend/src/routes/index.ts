import { Router } from 'express';
import authRouter from './auth.js';
import imageRouter from './image.js';
import professionalRouter from './professional.js';
import clientRouter from './client.js';
import routineRouter from './routine.js';
import treatmentPlanRouter from './treatmentPlan.js';
import productRouter from './product.js';
import aiRouter from './ai.js';
import adminRouter from './admin.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to SkinAura API',
    version: '1.0.0',
  });
});

// Auth routes (with encrypted request handling)
router.use('/auth', authRouter);

// Image routes (generic encrypted image upload/serve)
router.use('/images', imageRouter);

// Professional routes (clients, notifications, etc.)
router.use('/professional', professionalRouter);

// Client routes (routines, gamification, completions)
router.use('/client', clientRouter);

// Routine routes (templates, steps, assignments for professionals)
router.use('/routines', routineRouter);

// Treatment plan routes (plans, milestones, products, routines, appointments)
router.use('/treatment-plans', treatmentPlanRouter);

// Product routes (product library management)
router.use('/products', productRouter);

// AI routes (product recognition, etc.)
router.use('/ai', aiRouter);

// Admin routes (overview, statistics)
router.use('/admin', adminRouter);

export default router;
