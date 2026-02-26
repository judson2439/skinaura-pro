/**
 * Admin routes for platform administration and overview statistics.
 * Uses PostgreSQL for data storage.
 */

import { Router, Request, Response } from 'express';
import { query, queryOne } from '../config/database.js';
import { verifyToken } from '../lib/auth.js';
import { 
  logAuditFromRequest, 
  queryAuditLogs, 
  getAuditStats,
  AuditLogQueryParams,
} from '../lib/auditLogger.js';
import {
  checkAccountLockStatus,
  adminUnlockAccount,
  getLoginAttemptHistory,
  getFailedAttemptCount,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
  ATTEMPT_WINDOW_MINUTES,
} from '../lib/accountLockout.js';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface UserStats {
  total: number;
  professionals: number;
  clients: number;
  admins: number;
  newThisMonth: number;
  newThisWeek: number;
}

interface ProductStats {
  total: number;
  active: number;
  inactive: number;
  global: number;
  byCategory: { category: string; count: number }[];
}

interface PhotoStats {
  total: number;
  before: number;
  after: number;
  progress: number;
  withComments: number;
  withAnnotations: number;
  thisMonth: number;
}

interface RoutineStats {
  total: number;
  active: number;
  inactive: number;
  thisMonth: number;
}

interface GamificationStats {
  totalPoints: number;
  totalBadges: number;
  totalRoutinesCompleted: number;
  avgStreak: number;
  maxStreak: number;
  activeUsers: number;
  topLevels: { level: number; count: number }[];
}

interface OverviewData {
  userStats: UserStats;
  productStats: ProductStats;
  photoStats: PhotoStats;
  routineStats: RoutineStats;
  gamificationStats: GamificationStats;
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Auth middleware to verify JWT token and check admin role
 * CRITICAL: This middleware now verifies the user is actually an admin
 */
const authMiddleware = async (
  req: Request,
  res: Response,
  next: () => void
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authorization token required',
      } as ApiResponse);
      return;
    }

    const token = authHeader.split(' ')[1];
    const result = verifyToken(token);

    if (!result.valid || !result.payload) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      } as ApiResponse);
      return;
    }

    const userId = result.payload.sub as string;
    const userEmail = result.payload.email as string;

    // CRITICAL: Verify user has admin role by checking the database
    const userProfile = await queryOne<{ role: string }>(
      `SELECT role FROM user_profiles WHERE id = $1`,
      [userId]
    );

    if (!userProfile || userProfile.role !== 'admin') {
      // Log unauthorized admin access attempt
      await logAuditFromRequest(req, 'PERMISSION_DENIED', 'system', undefined, {
        attempted_route: req.path,
        user_role: userProfile?.role || 'unknown',
        reason: 'non_admin_accessing_admin_routes',
      }, 'denied');

      console.warn(`⚠️ SECURITY: Non-admin user ${userEmail} (role: ${userProfile?.role || 'unknown'}) attempted to access admin route: ${req.path}`);

      res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.',
      } as ApiResponse);
      return;
    }

    // Attach user info to request
    (req as any).userId = userId;
    (req as any).userEmail = userEmail;
    (req as any).userRole = 'admin';

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
    } as ApiResponse);
  }
};

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================================================
// ADMIN OVERVIEW ENDPOINT
// ============================================================================

/**
 * GET /admin/overview
 * Get comprehensive overview statistics for the admin dashboard
 */
router.get('/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId;

    console.log(`📊 Fetching admin overview for user: ${userId}`);

    // Get current date info for filtering
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfWeek = new Date(now.getTime() - (now.getDay() * 24 * 60 * 60 * 1000)).toISOString();

    // Fetch all data in parallel
    const [
      usersResult,
      productsResult,
      productCategoriesResult,
      photosResult,
      photoCommentsCountResult,
      photoAnnotationsCountResult,
      photosThisMonthResult,
      routinesResult,
      routinesThisMonthResult,
      gamificationResult,
      badgesCountResult,
    ] = await Promise.all([
      // User profiles with role counts
      query<{ role: string; created_at: string }>(
        `SELECT role, created_at FROM user_profiles`
      ),

      // Products
      query<{ is_active: boolean; is_global: boolean; category: string }>(
        `SELECT is_active, is_global, category FROM products`
      ),

      // Product categories (grouped)
      query<{ category: string; count: string }>(
        `SELECT COALESCE(category, 'Uncategorized') as category, COUNT(*) as count 
         FROM products 
         GROUP BY category 
         ORDER BY count DESC 
         LIMIT 6`
      ),

      // Progress photos
      query<{ photo_type: string }>(
        `SELECT photo_type FROM progress_photos`
      ),

      // Photo comments count
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT photo_id) as count FROM photo_comments`
      ),

      // Photo annotations count
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT photo_id) as count FROM photo_annotations`
      ),

      // Photos this month
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM progress_photos WHERE created_at >= $1`,
        [startOfMonth]
      ),

      // Routine templates
      query<{ is_active: boolean }>(
        `SELECT is_active FROM routine_templates`
      ),

      // Routines this month
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM routine_templates WHERE created_at >= $1`,
        [startOfMonth]
      ),

      // Gamification data
      query<{
        user_id: string;
        points: number;
        current_streak: number;
        longest_streak: number;
        total_routines_completed: number;
        level: string;
      }>(
        `SELECT user_id, points, current_streak, longest_streak, total_routines_completed, level 
         FROM user_gamification`
      ),

      // Badges count
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM user_badges`
      ),
    ]);

    // Calculate user stats
    const professionals = usersResult.filter(u => u.role === 'professional').length;
    const clients = usersResult.filter(u => u.role === 'client').length;
    const admins = usersResult.filter(u => u.role === 'admin').length;
    const newThisMonth = usersResult.filter(u => u.created_at && u.created_at >= startOfMonth).length;
    const newThisWeek = usersResult.filter(u => u.created_at && u.created_at >= startOfWeek).length;

    const userStats: UserStats = {
      total: usersResult.length,
      professionals,
      clients,
      admins,
      newThisMonth,
      newThisWeek,
    };

    // Calculate product stats
    const activeProducts = productsResult.filter(p => p.is_active !== false).length;
    const inactiveProducts = productsResult.filter(p => p.is_active === false).length;
    const globalProducts = productsResult.filter(p => p.is_global === true).length;
    const byCategory = productCategoriesResult.map(c => ({
      category: c.category,
      count: parseInt(c.count, 10),
    }));

    const productStats: ProductStats = {
      total: productsResult.length,
      active: activeProducts,
      inactive: inactiveProducts,
      global: globalProducts,
      byCategory,
    };

    // Calculate photo stats
    const beforePhotos = photosResult.filter(p => p.photo_type === 'before').length;
    const afterPhotos = photosResult.filter(p => p.photo_type === 'after').length;
    const progressPhotos = photosResult.filter(p => p.photo_type === 'progress').length;

    const photoStats: PhotoStats = {
      total: photosResult.length,
      before: beforePhotos,
      after: afterPhotos,
      progress: progressPhotos,
      withComments: parseInt(photoCommentsCountResult[0]?.count || '0', 10),
      withAnnotations: parseInt(photoAnnotationsCountResult[0]?.count || '0', 10),
      thisMonth: parseInt(photosThisMonthResult[0]?.count || '0', 10),
    };

    // Calculate routine stats
    const activeRoutines = routinesResult.filter(r => r.is_active !== false).length;
    const inactiveRoutines = routinesResult.filter(r => r.is_active === false).length;

    const routineStats: RoutineStats = {
      total: routinesResult.length,
      active: activeRoutines,
      inactive: inactiveRoutines,
      thisMonth: parseInt(routinesThisMonthResult[0]?.count || '0', 10),
    };

    // Calculate gamification stats
    const totalPoints = gamificationResult.reduce((sum, g) => sum + (g.points || 0), 0);
    const totalRoutinesCompleted = gamificationResult.reduce((sum, g) => sum + (g.total_routines_completed || 0), 0);
    const avgStreak = gamificationResult.length > 0
      ? Math.round(gamificationResult.reduce((sum, g) => sum + (g.current_streak || 0), 0) / gamificationResult.length)
      : 0;
    const maxStreak = gamificationResult.length > 0
      ? Math.max(...gamificationResult.map(g => g.longest_streak || 0))
      : 0;
    const activeUsers = gamificationResult.filter(g => (g.current_streak || 0) > 0).length;

    // Group by level
    const levelMap: { [key: string]: number } = {};
    gamificationResult.forEach(g => {
      const level = g.level || '1';
      levelMap[level] = (levelMap[level] || 0) + 1;
    });
    const topLevels = Object.entries(levelMap)
      .map(([level, count]) => ({ level: parseInt(level, 10) || 1, count }))
      .sort((a, b) => b.level - a.level)
      .slice(0, 5);

    const gamificationStats: GamificationStats = {
      totalPoints,
      totalBadges: parseInt(badgesCountResult[0]?.count || '0', 10),
      totalRoutinesCompleted,
      avgStreak,
      maxStreak,
      activeUsers,
      topLevels,
    };

    const overviewData: OverviewData = {
      userStats,
      productStats,
      photoStats,
      routineStats,
      gamificationStats,
    };

    console.log(`✅ Admin overview fetched successfully`);

    res.status(200).json({
      success: true,
      data: overviewData,
    } as ApiResponse<OverviewData>);

  } catch (error) {
    console.error('❌ Error fetching admin overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overview data',
    } as ApiResponse);
  }
});

// ============================================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================================

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
  skin_type: string | null;
  concerns: string[] | null;
  business_name: string | null;
  license_number: string | null;
  ncea_certified_profile_number: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * GET /admin/users
 * Get all users with pagination support
 */
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`👥 Fetching all users for admin`);

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_profiles`
    );
    const totalUsers = parseInt(countResult[0]?.count || '0', 10);

    // Get all users
    const users = await query<UserProfile>(
      `SELECT id, email, full_name, phone, avatar_url, role, skin_type, concerns, 
              business_name, license_number, ncea_certified_profile_number, created_at, updated_at
       FROM user_profiles
       ORDER BY created_at DESC`
    );

    console.log(`✅ Found ${users.length} users`);

    res.status(200).json({
      success: true,
      data: {
        users,
        total: totalUsers,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    } as ApiResponse);
  }
});

/**
 * PUT /admin/users/:userId
 * Update a user's profile
 */
router.put('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { full_name, phone, role, skin_type, business_name, license_number, ncea_certified_profile_number } = req.body;

    console.log(`✏️ Updating user: ${userId}`);

    const updatedUser = await query<UserProfile>(
      `UPDATE user_profiles SET
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        role = COALESCE($3, role),
        skin_type = COALESCE($4, skin_type),
        business_name = COALESCE($5, business_name),
        license_number = COALESCE($6, license_number),
        ncea_certified_profile_number = COALESCE($7, ncea_certified_profile_number),
        updated_at = NOW()
       WHERE id = $8
       RETURNING id, email, full_name, phone, avatar_url, role, skin_type, concerns, 
                 business_name, license_number, ncea_certified_profile_number, created_at, updated_at`,
      [full_name, phone, role, skin_type, business_name, license_number, ncea_certified_profile_number, userId]
    );

    if (updatedUser.length === 0) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ User updated: ${userId}`);

    res.status(200).json({
      success: true,
      data: { user: updatedUser[0] },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
    } as ApiResponse);
  }
});

/**
 * DELETE /admin/users/:userId
 * Delete a single user
 */
router.delete('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    console.log(`🗑️ Deleting user: ${userId}`);

    const result = await query(
      `DELETE FROM user_profiles WHERE id = $1 RETURNING id`,
      [userId]
    );

    if (result.length === 0) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ User deleted: ${userId}`);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
    } as ApiResponse);
  }
});

/**
 * POST /admin/users/bulk-delete
 * Delete multiple users at once
 */
router.post('/users/bulk-delete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'User IDs array is required',
      } as ApiResponse);
      return;
    }

    console.log(`🗑️ Bulk deleting ${userIds.length} users`);

    const result = await query(
      `DELETE FROM user_profiles WHERE id = ANY($1) RETURNING id`,
      [userIds]
    );

    console.log(`✅ Deleted ${result.length} users`);

    res.status(200).json({
      success: true,
      message: `${result.length} user(s) deleted successfully`,
      data: { deletedCount: result.length },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error bulk deleting users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete users',
    } as ApiResponse);
  }
});

// ============================================================================
// PRODUCT MANAGEMENT ENDPOINTS
// ============================================================================

interface ProductData {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
  purchase_url: string | null;
  is_active: boolean;
  is_global: boolean;
  professional_id: string | null;
  professional_name: string | null;
  professional_email: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * GET /admin/products
 * Get all products with professional info
 */
router.get('/products', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`📦 Fetching all products for admin`);

    // Get all products with professional info via join
    const products = await query<ProductData>(
      `SELECT 
        p.id, p.name, p.brand, p.category, p.description, p.price, 
        p.image_url, p.purchase_url, p.is_active, p.is_global, 
        p.professional_id, p.created_at, p.updated_at,
        up.full_name as professional_name,
        up.email as professional_email
       FROM products p
       LEFT JOIN user_profiles up ON p.professional_id = up.id
       ORDER BY p.created_at DESC`
    );

    console.log(`✅ Found ${products.length} products`);

    res.status(200).json({
      success: true,
      data: {
        products,
        total: products.length,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
    } as ApiResponse);
  }
});

/**
 * PUT /admin/products/:productId
 * Update a product
 */
router.put('/products/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { name, brand, category, description, price, is_active, is_global } = req.body;

    console.log(`✏️ Updating product: ${productId}`);

    const updatedProduct = await query<ProductData>(
      `UPDATE products SET
        name = COALESCE($1, name),
        brand = COALESCE($2, brand),
        category = COALESCE($3, category),
        description = COALESCE($4, description),
        price = COALESCE($5, price),
        is_active = COALESCE($6, is_active),
        is_global = COALESCE($7, is_global),
        updated_at = NOW()
       WHERE id = $8
       RETURNING id, name, brand, category, description, price, image_url, 
                 purchase_url, is_active, is_global, professional_id, created_at, updated_at`,
      [name, brand, category, description, price, is_active, is_global, productId]
    );

    if (updatedProduct.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Product updated: ${productId}`);

    res.status(200).json({
      success: true,
      data: { product: updatedProduct[0] },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
    } as ApiResponse);
  }
});

/**
 * DELETE /admin/products/:productId
 * Delete a single product
 */
router.delete('/products/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;

    console.log(`🗑️ Deleting product: ${productId}`);

    const result = await query(
      `DELETE FROM products WHERE id = $1 RETURNING id`,
      [productId]
    );

    if (result.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Product deleted: ${productId}`);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
    } as ApiResponse);
  }
});

/**
 * POST /admin/products/bulk-delete
 * Delete multiple products at once
 */
router.post('/products/bulk-delete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Product IDs array is required',
      } as ApiResponse);
      return;
    }

    console.log(`🗑️ Bulk deleting ${productIds.length} products`);

    const result = await query(
      `DELETE FROM products WHERE id = ANY($1) RETURNING id`,
      [productIds]
    );

    console.log(`✅ Deleted ${result.length} products`);

    res.status(200).json({
      success: true,
      message: `${result.length} product(s) deleted successfully`,
      data: { deletedCount: result.length },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error bulk deleting products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete products',
    } as ApiResponse);
  }
});

// ============================================================================
// ROUTINE MANAGEMENT ENDPOINTS
// ============================================================================

interface RoutineData {
  id: string;
  name: string;
  description: string | null;
  schedule_type: string;
  is_active: boolean;
  professional_id: string | null;
  professional_name: string | null;
  professional_email: string | null;
  steps_count: number;
  assignments_count: number;
  created_at: string;
  updated_at: string | null;
}

/**
 * GET /admin/routines
 * Get all routines with professional info, steps count, and assignments count
 */
router.get('/routines', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`📋 Fetching all routines for admin`);

    // Get all routines with professional info and counts via subqueries
    const routines = await query<RoutineData>(
      `SELECT 
        rt.id, rt.name, rt.description, rt.schedule_type, rt.is_active,
        rt.professional_id, rt.created_at, rt.updated_at,
        up.full_name as professional_name,
        up.email as professional_email,
        COALESCE(
          (SELECT COUNT(*) FROM routine_steps rs WHERE rs.routine_id = rt.id),
          0
        )::int as steps_count,
        COALESCE(
          (SELECT COUNT(*) FROM client_routine_assignments cra WHERE cra.routine_id = rt.id),
          0
        )::int as assignments_count
       FROM routine_templates rt
       LEFT JOIN user_profiles up ON rt.professional_id = up.id
       ORDER BY rt.created_at DESC`
    );

    console.log(`✅ Found ${routines.length} routines`);

    res.status(200).json({
      success: true,
      data: {
        routines,
        total: routines.length,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching routines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch routines',
    } as ApiResponse);
  }
});

/**
 * PUT /admin/routines/:routineId
 * Update a routine
 */
router.put('/routines/:routineId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { routineId } = req.params;
    const { name, description, schedule_type, is_active } = req.body;

    console.log(`✏️ Updating routine: ${routineId}`);

    const updatedRoutine = await query<RoutineData>(
      `UPDATE routine_templates SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        schedule_type = COALESCE($3, schedule_type),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, description, schedule_type, is_active, professional_id, created_at, updated_at`,
      [name, description, schedule_type, is_active, routineId]
    );

    if (updatedRoutine.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Routine not found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Routine updated: ${routineId}`);

    res.status(200).json({
      success: true,
      data: { routine: updatedRoutine[0] },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error updating routine:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update routine',
    } as ApiResponse);
  }
});

/**
 * DELETE /admin/routines/:routineId
 * Delete a single routine with all associated data
 */
router.delete('/routines/:routineId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { routineId } = req.params;

    console.log(`🗑️ Deleting routine: ${routineId}`);

    // Get all step IDs for this routine
    const steps = await query<{ id: string }>(
      `SELECT id FROM routine_steps WHERE routine_id = $1`,
      [routineId]
    );

    // Delete linked products for all steps
    if (steps.length > 0) {
      const stepIds = steps.map(s => s.id);
      await query(
        `DELETE FROM routine_step_products WHERE routine_step_id = ANY($1)`,
        [stepIds]
      );
      console.log(`  ✅ Deleted step products for ${stepIds.length} steps`);
    }

    // Delete all steps
    await query(
      `DELETE FROM routine_steps WHERE routine_id = $1`,
      [routineId]
    );
    console.log(`  ✅ Deleted routine steps`);

    // Delete all client assignments
    await query(
      `DELETE FROM client_routine_assignments WHERE routine_id = $1`,
      [routineId]
    );
    console.log(`  ✅ Deleted client assignments`);

    // Finally, delete the routine template
    const result = await query(
      `DELETE FROM routine_templates WHERE id = $1 RETURNING id`,
      [routineId]
    );

    if (result.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Routine not found',
      } as ApiResponse);
      return;
    }

    console.log(`✅ Routine deleted: ${routineId}`);

    res.status(200).json({
      success: true,
      message: 'Routine deleted successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error deleting routine:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete routine',
    } as ApiResponse);
  }
});

/**
 * POST /admin/routines/bulk-delete
 * Delete multiple routines at once with all associated data
 */
router.post('/routines/bulk-delete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { routineIds } = req.body;

    if (!routineIds || !Array.isArray(routineIds) || routineIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Routine IDs array is required',
      } as ApiResponse);
      return;
    }

    console.log(`🗑️ Bulk deleting ${routineIds.length} routines`);

    // Get all step IDs for these routines
    const steps = await query<{ id: string }>(
      `SELECT id FROM routine_steps WHERE routine_id = ANY($1)`,
      [routineIds]
    );

    // Delete linked products for all steps
    if (steps.length > 0) {
      const stepIds = steps.map(s => s.id);
      await query(
        `DELETE FROM routine_step_products WHERE routine_step_id = ANY($1)`,
        [stepIds]
      );
      console.log(`  ✅ Deleted step products for ${stepIds.length} steps`);
    }

    // Delete all steps for these routines
    await query(
      `DELETE FROM routine_steps WHERE routine_id = ANY($1)`,
      [routineIds]
    );
    console.log(`  ✅ Deleted routine steps`);

    // Delete all client assignments for these routines
    await query(
      `DELETE FROM client_routine_assignments WHERE routine_id = ANY($1)`,
      [routineIds]
    );
    console.log(`  ✅ Deleted client assignments`);

    // Finally, delete the routine templates
    const result = await query(
      `DELETE FROM routine_templates WHERE id = ANY($1) RETURNING id`,
      [routineIds]
    );

    console.log(`✅ Deleted ${result.length} routines`);

    res.status(200).json({
      success: true,
      message: `${result.length} routine(s) deleted successfully`,
      data: { deletedCount: result.length },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error bulk deleting routines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete routines',
    } as ApiResponse);
  }
});

// ============================================================================
// TEMPLATE ROUTINE ENDPOINTS (template_routine_templates + template_routine_steps)
// ============================================================================

interface TemplateRoutineTemplateRow {
  id: string;
  name: string;
  description: string | null;
  schedule_type: string;
  schedule_days: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateRoutineStepRow {
  id: string;
  routine_id: string;
  step_order: number;
  step_name: string;
  description: string | null;
  duration_seconds: number | null;
  product_category: string | null;
  product_recommendation: string | null;
  tips: string | null;
  is_optional: boolean;
  created_at: string;
}

/**
 * GET /admin/template-routines
 * List all template routines with step count
 */
router.get('/template-routines', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await query<TemplateRoutineTemplateRow & { steps_count: number }>(
      `SELECT t.id, t.name, t.description, t.schedule_type, t.schedule_days,
              t.is_active, t.created_at, t.updated_at,
              COALESCE(
                (SELECT COUNT(*)::int FROM template_routine_steps s WHERE s.routine_id = t.id),
                0
              ) as steps_count
       FROM template_routine_templates t
       ORDER BY t.created_at DESC`
    );
    res.status(200).json({
      success: true,
      data: { templates: rows },
    } as ApiResponse);
  } catch (error) {
    console.error('Error fetching template routines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template routines',
    } as ApiResponse);
  }
});

/**
 * GET /admin/template-routines/:id
 * Get one template routine with its steps
 */
router.get('/template-routines/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const template = await queryOne<TemplateRoutineTemplateRow>(
      `SELECT id, name, description, schedule_type, schedule_days, is_active, created_at, updated_at
       FROM template_routine_templates WHERE id = $1`,
      [id]
    );
    if (!template) {
      res.status(404).json({ success: false, error: 'Template routine not found' } as ApiResponse);
      return;
    }
    const steps = await query<TemplateRoutineStepRow>(
      `SELECT id, routine_id, step_order, step_name, description, duration_seconds,
              product_category, product_recommendation, tips, is_optional, created_at
       FROM template_routine_steps WHERE routine_id = $1 ORDER BY step_order ASC`,
      [id]
    );
    res.status(200).json({
      success: true,
      data: { template, steps },
    } as ApiResponse);
  } catch (error) {
    console.error('Error fetching template routine:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template routine',
    } as ApiResponse);
  }
});

/**
 * POST /admin/template-routines
 * Create a template routine and optionally its steps
 */
router.post('/template-routines', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, schedule_type, schedule_days, is_active, steps } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'name is required' } as ApiResponse);
      return;
    }
    if (!schedule_type || typeof schedule_type !== 'string') {
      res.status(400).json({ success: false, error: 'schedule_type is required' } as ApiResponse);
      return;
    }
    const scheduleDaysArray = Array.isArray(schedule_days) ? schedule_days : (schedule_days ? [schedule_days] : null);
    const active = is_active !== false;

    const template = await queryOne<TemplateRoutineTemplateRow>(
      `INSERT INTO template_routine_templates (id, name, description, schedule_type, schedule_days, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, name, description, schedule_type, schedule_days, is_active, created_at, updated_at`,
      [name.trim(), description?.trim() || null, schedule_type, scheduleDaysArray, active]
    );
    if (!template) {
      res.status(500).json({ success: false, error: 'Failed to create template' } as ApiResponse);
      return;
    }

    const routineId = template.id;
    const stepsToInsert = Array.isArray(steps) ? steps : [];
    for (let i = 0; i < stepsToInsert.length; i++) {
      const step = stepsToInsert[i];
      const stepOrder = typeof step.step_order === 'number' ? step.step_order : i + 1;
      await query(
        `INSERT INTO template_routine_steps (id, routine_id, step_order, step_name, description, duration_seconds, product_category, product_recommendation, tips, is_optional, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          routineId,
          stepOrder,
          (step.step_name && String(step.step_name).trim()) || 'Step ' + (i + 1),
          step.description ? String(step.description).trim() : null,
          step.duration_seconds != null ? Number(step.duration_seconds) : null,
          step.product_category ? String(step.product_category).trim() : null,
          step.product_recommendation ? String(step.product_recommendation).trim() : null,
          step.tips ? String(step.tips).trim() : null,
          step.is_optional === true,
        ]
      );
    }

    const stepsList = await query<TemplateRoutineStepRow>(
      `SELECT id, routine_id, step_order, step_name, description, duration_seconds,
              product_category, product_recommendation, tips, is_optional, created_at
       FROM template_routine_steps WHERE routine_id = $1 ORDER BY step_order ASC`,
      [routineId]
    );
    res.status(201).json({
      success: true,
      data: { template, steps: stepsList },
    } as ApiResponse);
  } catch (error) {
    console.error('Error creating template routine:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template routine',
    } as ApiResponse);
  }
});

/**
 * PUT /admin/template-routines/:id
 * Update a template routine and its steps
 */
router.put('/template-routines/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, schedule_type, schedule_days, is_active, steps } = req.body;

    const existing = await queryOne<TemplateRoutineTemplateRow>(
      `SELECT id FROM template_routine_templates WHERE id = $1`,
      [id]
    );
    if (!existing) {
      res.status(404).json({ success: false, error: 'Template routine not found' } as ApiResponse);
      return;
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'name is required' } as ApiResponse);
      return;
    }
    if (!schedule_type || typeof schedule_type !== 'string') {
      res.status(400).json({ success: false, error: 'schedule_type is required' } as ApiResponse);
      return;
    }
    const scheduleDaysArray = Array.isArray(schedule_days) ? schedule_days : (schedule_days ? [schedule_days] : null);
    const active = is_active !== false;

    await query(
      `UPDATE template_routine_templates SET
        name = $1, description = $2, schedule_type = $3, schedule_days = $4, is_active = $5, updated_at = NOW()
       WHERE id = $6`,
      [name.trim(), description?.trim() || null, schedule_type, scheduleDaysArray, active, id]
    );

    await query(`DELETE FROM template_routine_steps WHERE routine_id = $1`, [id]);

    const stepsToInsert = Array.isArray(steps) ? steps : [];
    for (let i = 0; i < stepsToInsert.length; i++) {
      const step = stepsToInsert[i];
      const stepOrder = typeof step.step_order === 'number' ? step.step_order : i + 1;
      await query(
        `INSERT INTO template_routine_steps (id, routine_id, step_order, step_name, description, duration_seconds, product_category, product_recommendation, tips, is_optional, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          id,
          stepOrder,
          (step.step_name && String(step.step_name).trim()) || 'Step ' + (i + 1),
          step.description ? String(step.description).trim() : null,
          step.duration_seconds != null ? Number(step.duration_seconds) : null,
          step.product_category ? String(step.product_category).trim() : null,
          step.product_recommendation ? String(step.product_recommendation).trim() : null,
          step.tips ? String(step.tips).trim() : null,
          step.is_optional === true,
        ]
      );
    }

    const template = await queryOne<TemplateRoutineTemplateRow>(
      `SELECT id, name, description, schedule_type, schedule_days, is_active, created_at, updated_at
       FROM template_routine_templates WHERE id = $1`,
      [id]
    );
    const stepsList = await query<TemplateRoutineStepRow>(
      `SELECT id, routine_id, step_order, step_name, description, duration_seconds,
              product_category, product_recommendation, tips, is_optional, created_at
       FROM template_routine_steps WHERE routine_id = $1 ORDER BY step_order ASC`,
      [id]
    );
    res.status(200).json({
      success: true,
      data: { template, steps: stepsList },
    } as ApiResponse);
  } catch (error) {
    console.error('Error updating template routine:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template routine',
    } as ApiResponse);
  }
});

/**
 * DELETE /admin/template-routines/:id
 * Delete a template routine and its steps
 */
router.delete('/template-routines/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existing = await queryOne<TemplateRoutineTemplateRow>(
      `SELECT id FROM template_routine_templates WHERE id = $1`,
      [id]
    );
    if (!existing) {
      res.status(404).json({ success: false, error: 'Template routine not found' } as ApiResponse);
      return;
    }

    await query(`DELETE FROM template_routine_steps WHERE routine_id = $1`, [id]);
    await query(`DELETE FROM template_routine_templates WHERE id = $1 RETURNING id`, [id]);

    res.status(200).json({
      success: true,
      message: 'Template routine deleted successfully',
    } as ApiResponse);
  } catch (error) {
    console.error('Error deleting template routine:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template routine',
    } as ApiResponse);
  }
});

// ============================================================================
// PROGRESS PHOTOS MANAGEMENT ENDPOINTS
// ============================================================================

interface ProgressPhotoData {
  id: string;
  client_id: string;
  photo_url: string;
  thumbnail_url: string | null;
  photo_type: string | null;
  title: string | null;
  notes: string | null;
  tags: string[] | null;
  skin_analysis: Record<string, unknown> | null;
  taken_at: string | null;
  created_at: string;
  updated_at: string;
  comments_count?: number;
  annotations_count?: number;
}

interface PhotoUserInfo {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
}

/**
 * GET /admin/progress-photos
 * Get paginated progress photos with filters, user info, and counts
 */
router.get('/progress-photos', async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '12', photo_type, client_id } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    console.log(`📸 Fetching progress photos: page=${pageNum}, limit=${limitNum}`);

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (photo_type) {
      conditions.push(`pp.photo_type = $${paramIndex}`);
      params.push(photo_type as string);
      paramIndex++;
    }

    if (client_id) {
      conditions.push(`pp.client_id = $${paramIndex}`);
      params.push(client_id as string);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM progress_photos pp ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult[0]?.count || '0', 10);

    // Get photos with counts via subqueries
    params.push(limitNum, offset);
    const photos = await query<ProgressPhotoData>(
      `SELECT 
        pp.id, pp.client_id, pp.photo_url, pp.thumbnail_url, pp.photo_type,
        pp.title, pp.notes, pp.tags, pp.skin_analysis, pp.taken_at, 
        pp.created_at, pp.updated_at,
        COALESCE(
          (SELECT COUNT(*) FROM photo_comments pc WHERE pc.photo_id = pp.id),
          0
        )::int as comments_count,
        COALESCE(
          (SELECT COUNT(*) FROM photo_annotations pa WHERE pa.photo_id = pp.id),
          0
        )::int as annotations_count
       FROM progress_photos pp
       ${whereClause}
       ORDER BY pp.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    // Get unique user IDs and fetch user info
    const userIds = [...new Set(photos.map(p => p.client_id))];
    let users: PhotoUserInfo[] = [];

    if (userIds.length > 0) {
      users = await query<PhotoUserInfo>(
        `SELECT id, full_name, email, avatar_url, role 
         FROM user_profiles 
         WHERE id = ANY($1)`,
        [userIds]
      );
    }

    console.log(`✅ Found ${photos.length} photos (total: ${totalCount})`);

    res.status(200).json({
      success: true,
      data: {
        photos,
        users,
        totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching progress photos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch progress photos',
    } as ApiResponse);
  }
});

/**
 * GET /admin/progress-photos/stats
 * Get progress photos statistics
 */
router.get('/progress-photos/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`📊 Fetching progress photos stats`);

    // Run all stat queries in parallel
    const [
      photoStats,
      commentsStats,
      annotationsStats,
    ] = await Promise.all([
      // Get counts by type and unique users
      query<{ photo_type: string | null; count: string; client_id: string }>(
        `SELECT photo_type, COUNT(*) as count, client_id FROM progress_photos GROUP BY photo_type, client_id`
      ),
      // Get unique photos with comments
      query<{ photo_id: string }>(
        `SELECT DISTINCT photo_id FROM photo_comments`
      ),
      // Get unique photos with annotations
      query<{ photo_id: string }>(
        `SELECT DISTINCT photo_id FROM photo_annotations`
      ),
    ]);

    // Calculate stats
    let total = 0;
    let before = 0;
    let after = 0;
    let progress = 0;
    const uniqueUsers = new Set<string>();

    photoStats.forEach(row => {
      const count = parseInt(row.count, 10);
      total += count;
      uniqueUsers.add(row.client_id);
      
      if (row.photo_type === 'before') {
        before += count;
      } else if (row.photo_type === 'after') {
        after += count;
      } else {
        progress += count;
      }
    });

    const stats = {
      total,
      before,
      after,
      progress,
      usersWithPhotos: uniqueUsers.size,
      withComments: commentsStats.length,
      withAnnotations: annotationsStats.length,
    };

    console.log(`✅ Stats calculated:`, stats);

    res.status(200).json({
      success: true,
      data: stats,
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching progress photos stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
    } as ApiResponse);
  }
});

/**
 * GET /admin/progress-photos/users
 * Get all users who have progress photos
 */
router.get('/progress-photos/users', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log(`👥 Fetching users with progress photos`);

    // Get unique user IDs from progress photos
    const photoUsers = await query<{ client_id: string }>(
      `SELECT DISTINCT client_id FROM progress_photos`
    );

    const userIds = photoUsers.map(p => p.client_id);

    if (userIds.length === 0) {
      res.status(200).json({
        success: true,
        data: { users: [] },
      } as ApiResponse);
      return;
    }

    // Fetch user info
    const users = await query<PhotoUserInfo>(
      `SELECT id, full_name, email, avatar_url, role 
       FROM user_profiles 
       WHERE id = ANY($1)
       ORDER BY full_name ASC NULLS LAST`,
      [userIds]
    );

    console.log(`✅ Found ${users.length} users with photos`);

    res.status(200).json({
      success: true,
      data: { users },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching users with photos:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    } as ApiResponse);
  }
});

interface PhotoComment {
  id: string;
  photo_id: string;
  professional_id: string;
  content: string;
  created_at: string;
  professional_name: string | null;
  professional_avatar: string | null;
}

interface PhotoAnnotation {
  id: string;
  photo_id: string;
  professional_id: string;
  markup_image: string;
  created_at: string;
  professional_name: string | null;
}

/**
 * GET /admin/progress-photos/:photoId/details
 * Get photo comments and annotations with professional info
 */
router.get('/progress-photos/:photoId/details', async (req: Request, res: Response): Promise<void> => {
  try {
    const { photoId } = req.params;

    console.log(`📸 Fetching details for photo: ${photoId}`);

    // Fetch comments with professional info via join
    const comments = await query<PhotoComment>(
      `SELECT 
        pc.id, pc.photo_id, pc.professional_id, pc.content, pc.created_at,
        up.full_name as professional_name,
        up.avatar_url as professional_avatar
       FROM photo_comments pc
       LEFT JOIN user_profiles up ON pc.professional_id = up.id
       WHERE pc.photo_id = $1
       ORDER BY pc.created_at ASC`,
      [photoId]
    );

    // Fetch annotations with professional info via join
    const annotations = await query<PhotoAnnotation>(
      `SELECT 
        pa.id, pa.photo_id, pa.professional_id, pa.markup_image, pa.created_at,
        up.full_name as professional_name
       FROM photo_annotations pa
       LEFT JOIN user_profiles up ON pa.professional_id = up.id
       WHERE pa.photo_id = $1
       ORDER BY pa.created_at DESC`,
      [photoId]
    );

    console.log(`✅ Found ${comments.length} comments and ${annotations.length} annotations`);

    res.status(200).json({
      success: true,
      data: {
        comments,
        annotations,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching photo details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch photo details',
    } as ApiResponse);
  }
});

// ============================================================================
// ROUTINE STEPS ENDPOINTS
// ============================================================================

interface RoutineStepData {
  id: string;
  routine_id: string;
  step_order: number;
  step_name: string;
  description: string | null;
  product_category: string | null;
  product_recommendation: string | null;
  tips: string | null;
  duration_seconds: number | null;
  is_optional: boolean;
  created_at: string;
  updated_at: string | null;
}

interface LinkedProduct {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
}

interface RoutineStepProduct {
  routine_step_id: string;
  product_id: string;
  product_name: string;
  product_brand: string | null;
  product_image_url: string | null;
}

/**
 * GET /admin/routines/:routineId/steps
 * Get routine steps with linked products
 */
router.get('/routines/:routineId/steps', async (req: Request, res: Response): Promise<void> => {
  try {
    const { routineId } = req.params;

    console.log(`📋 Fetching steps for routine: ${routineId}`);

    // Fetch steps
    const steps = await query<RoutineStepData>(
      `SELECT id, routine_id, step_order, step_name, description, 
              product_category, product_recommendation, tips, 
              duration_seconds, is_optional, created_at
       FROM routine_steps
       WHERE routine_id = $1
       ORDER BY step_order ASC`,
      [routineId]
    );

    // Fetch linked products for steps
    let stepsWithProducts: (RoutineStepData & { linked_product: LinkedProduct | null })[] = steps.map(s => ({
      ...s,
      linked_product: null,
    }));

    if (steps.length > 0) {
      const stepIds = steps.map(s => s.id);
      
      const linkedProducts = await query<RoutineStepProduct>(
        `SELECT 
          rsp.routine_step_id,
          p.id as product_id,
          p.name as product_name,
          p.brand as product_brand,
          p.image_url as product_image_url
         FROM routine_step_products rsp
         JOIN products p ON rsp.product_id = p.id
         WHERE rsp.routine_step_id = ANY($1)`,
        [stepIds]
      );

      // Map linked products to steps
      stepsWithProducts = steps.map(step => {
        const linkedProduct = linkedProducts.find(lp => lp.routine_step_id === step.id);
        return {
          ...step,
          linked_product: linkedProduct ? {
            id: linkedProduct.product_id,
            name: linkedProduct.product_name,
            brand: linkedProduct.product_brand,
            image_url: linkedProduct.product_image_url,
          } : null,
        };
      });
    }

    console.log(`✅ Found ${stepsWithProducts.length} steps`);

    res.status(200).json({
      success: true,
      data: { steps: stepsWithProducts },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching routine steps:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch routine steps',
    } as ApiResponse);
  }
});

// ============================================================================
// AUDIT LOG ENDPOINTS (HIPAA Compliance)
// ============================================================================

/**
 * GET /admin/audit-logs
 * Query audit logs with filtering options
 */
router.get('/audit-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminEmail = (req as any).userEmail;

    // Note: Admin role is already verified by authMiddleware

    // Parse query parameters
    const params: AuditLogQueryParams = {
      userId: req.query.userId as string,
      userEmail: req.query.userEmail as string,
      resourceType: req.query.resourceType as string,
      action: req.query.action as string,
      status: req.query.status as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      ipAddress: req.query.ipAddress as string,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
    };

    console.log(`📋 Admin ${adminEmail} querying audit logs`);

    const { logs, total } = await queryAuditLogs(params);

    // Log that admin accessed audit logs (meta-audit)
    await logAuditFromRequest(req, 'VIEW_LIST', 'system', undefined, {
      query_params: params,
      results_count: logs.length,
      total_matching: total,
    });

    res.status(200).json({
      success: true,
      data: {
        logs,
        total,
        limit: params.limit,
        offset: params.offset,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
    } as ApiResponse);
  }
});

/**
 * GET /admin/audit-logs/stats
 * Get audit log statistics for dashboard
 */
router.get('/audit-logs/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminEmail = (req as any).userEmail;

    // Note: Admin role is already verified by authMiddleware

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    console.log(`📊 Admin ${adminEmail} fetching audit stats`);

    const stats = await getAuditStats(startDate, endDate);

    // Log access to audit stats
    await logAuditFromRequest(req, 'VIEW', 'system', undefined, {
      report_type: 'audit_stats',
      date_range: { startDate, endDate },
    });

    res.status(200).json({
      success: true,
      data: { stats },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching audit stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit statistics',
    } as ApiResponse);
  }
});

/**
 * GET /admin/audit-logs/user/:userId
 * Get audit logs for a specific user
 */
router.get('/audit-logs/user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminEmail = (req as any).userEmail;
    const targetUserId = req.params.userId;

    // Note: Admin role is already verified by authMiddleware

    console.log(`📋 Admin ${adminEmail} querying audit logs for user: ${targetUserId}`);

    const { logs, total } = await queryAuditLogs({
      userId: targetUserId,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0,
    });

    // Get user info
    const userProfile = await queryOne<{ email: string; full_name: string; role: string }>(
      `SELECT email, full_name, role FROM user_profiles WHERE id = $1`,
      [targetUserId]
    );

    // Log that admin investigated a specific user's activity
    await logAuditFromRequest(req, 'VIEW', 'system', targetUserId, {
      action_type: 'user_activity_investigation',
      target_user_email: userProfile?.email,
      target_user_role: userProfile?.role,
      results_count: logs.length,
    });

    res.status(200).json({
      success: true,
      data: {
        user: userProfile,
        logs,
        total,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching user audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user audit logs',
    } as ApiResponse);
  }
});

/**
 * GET /admin/audit-logs/security-events
 * Get security-related events (failed logins, permission denied, etc.)
 */
router.get('/audit-logs/security-events', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminEmail = (req as any).userEmail;

    // Note: Admin role is already verified by authMiddleware

    console.log(`🔒 Admin ${adminEmail} fetching security events`);

    // Query for security-related events
    const securityLogs = await query<{
      id: string;
      user_id: string;
      user_email: string;
      action: string;
      resource_type: string;
      ip_address: string;
      user_agent: string;
      details: Record<string, unknown>;
      status: string;
      error_message: string;
      created_at: Date;
    }>(
      `SELECT * FROM audit_logs 
       WHERE action IN ('LOGIN_FAILED', 'PERMISSION_DENIED', 'PASSWORD_RESET', 'PASSWORD_CHANGE')
          OR status IN ('failure', 'denied')
       ORDER BY created_at DESC
       LIMIT 200`
    );

    // Log that admin accessed security report
    await logAuditFromRequest(req, 'VIEW', 'system', undefined, {
      report_type: 'security_events',
      results_count: securityLogs.length,
    });

    res.status(200).json({
      success: true,
      data: { logs: securityLogs },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching security events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security events',
    } as ApiResponse);
  }
});

// ============================================================================
// ACCOUNT LOCKOUT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /admin/locked-accounts
 * Get list of currently locked accounts
 */
router.get('/locked-accounts', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminEmail = (req as any).userEmail;

    console.log(`🔒 Admin ${adminEmail} fetching locked accounts`);

    // Find accounts with recent failed login attempts that exceed the threshold
    const lockedAccounts = await query<{
      email: string;
      failed_count: string;
      last_attempt: Date;
    }>(
      `SELECT 
        email,
        COUNT(*) as failed_count,
        MAX(created_at) as last_attempt
       FROM login_attempts
       WHERE success = false
         AND created_at > NOW() - INTERVAL '${ATTEMPT_WINDOW_MINUTES} minutes'
       GROUP BY email
       HAVING COUNT(*) >= $1
       ORDER BY MAX(created_at) DESC`,
      [MAX_FAILED_ATTEMPTS]
    );

    // Enrich with lockout status details
    const accountsWithStatus = await Promise.all(
      lockedAccounts.map(async (account) => {
        const status = await checkAccountLockStatus(account.email);
        
        // Get user profile if exists
        const userProfile = await queryOne<{ id: string; full_name: string; role: string }>(
          `SELECT id, full_name, role FROM user_profiles WHERE LOWER(email) = LOWER($1)`,
          [account.email]
        );

        return {
          email: account.email,
          userId: userProfile?.id || null,
          fullName: userProfile?.full_name || null,
          role: userProfile?.role || null,
          failedAttempts: parseInt(account.failed_count, 10),
          isLocked: status.isLocked,
          lockoutExpiresAt: status.lockoutExpiresAt?.toISOString() || null,
          remainingMinutes: status.remainingMinutes,
          lastAttempt: account.last_attempt,
        };
      })
    );

    // Filter to only currently locked accounts
    const currentlyLocked = accountsWithStatus.filter(a => a.isLocked);

    // Log access
    await logAuditFromRequest(req, 'VIEW', 'system', undefined, {
      report_type: 'locked_accounts',
      locked_count: currentlyLocked.length,
    });

    res.status(200).json({
      success: true,
      data: {
        lockedAccounts: currentlyLocked,
        config: {
          maxFailedAttempts: MAX_FAILED_ATTEMPTS,
          lockoutDurationMinutes: LOCKOUT_DURATION_MINUTES,
          attemptWindowMinutes: ATTEMPT_WINDOW_MINUTES,
        },
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching locked accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locked accounts',
    } as ApiResponse);
  }
});

/**
 * GET /admin/login-attempts/:email
 * Get login attempt history for a specific email
 */
router.get('/login-attempts/:email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.params;
    const adminEmail = (req as any).userEmail;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      } as ApiResponse);
      return;
    }

    console.log(`📋 Admin ${adminEmail} fetching login attempts for: ${email}`);

    // Get login attempt history
    const attempts = await getLoginAttemptHistory(email, limit);

    // Get current lockout status
    const status = await checkAccountLockStatus(email);
    const failedCount = await getFailedAttemptCount(email);

    // Get user profile if exists
    const userProfile = await queryOne<{ id: string; full_name: string; role: string }>(
      `SELECT id, full_name, role FROM user_profiles WHERE LOWER(email) = LOWER($1)`,
      [email]
    );

    // Log access
    await logAuditFromRequest(req, 'VIEW', 'user_profile', userProfile?.id, {
      action_type: 'view_login_attempts',
      target_email: email,
      attempts_count: attempts.length,
    });

    res.status(200).json({
      success: true,
      data: {
        email,
        user: userProfile ? {
          id: userProfile.id,
          fullName: userProfile.full_name,
          role: userProfile.role,
        } : null,
        lockoutStatus: {
          isLocked: status.isLocked,
          failedAttempts: failedCount,
          lockoutExpiresAt: status.lockoutExpiresAt?.toISOString() || null,
          remainingMinutes: status.remainingMinutes,
        },
        attempts: attempts.map(a => ({
          id: a.id,
          success: a.success,
          failureReason: a.failure_reason,
          ipAddress: a.ip_address,
          userAgent: a.user_agent,
          createdAt: a.created_at,
        })),
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching login attempts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch login attempts',
    } as ApiResponse);
  }
});

/**
 * POST /admin/unlock-account
 * Unlock a locked account
 */
router.post('/unlock-account', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const adminEmail = (req as any).userEmail;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required',
      } as ApiResponse);
      return;
    }

    console.log(`🔓 Admin ${adminEmail} unlocking account: ${email}`);

    // Check current status before unlocking
    const statusBefore = await checkAccountLockStatus(email);

    if (!statusBefore.isLocked && statusBefore.failedAttempts === 0) {
      res.status(400).json({
        success: false,
        error: 'Account is not locked',
      } as ApiResponse);
      return;
    }

    // Unlock the account
    const result = await adminUnlockAccount(email, adminEmail, req);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.message,
      } as ApiResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        email,
        previousStatus: {
          isLocked: statusBefore.isLocked,
          failedAttempts: statusBefore.failedAttempts,
        },
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error unlocking account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlock account',
    } as ApiResponse);
  }
});

/**
 * GET /admin/lockout-stats
 * Get overall account lockout statistics
 */
router.get('/lockout-stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const adminEmail = (req as any).userEmail;

    console.log(`📊 Admin ${adminEmail} fetching lockout stats`);

    // Get various lockout statistics
    const [
      currentlyLockedResult,
      recentFailuresResult,
      topOffendersResult,
      successRateResult,
    ] = await Promise.all([
      // Currently locked accounts count
      query<{ count: string }>(
        `SELECT COUNT(DISTINCT email) as count FROM (
          SELECT email, COUNT(*) as failed_count
          FROM login_attempts
          WHERE success = false
            AND created_at > NOW() - INTERVAL '${ATTEMPT_WINDOW_MINUTES} minutes'
          GROUP BY email
          HAVING COUNT(*) >= $1
        ) locked`,
        [MAX_FAILED_ATTEMPTS]
      ),

      // Total failed attempts in last 24 hours
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM login_attempts
         WHERE success = false AND created_at > NOW() - INTERVAL '24 hours'`
      ),

      // Top 10 emails with most failed attempts (last 7 days)
      query<{ email: string; count: string }>(
        `SELECT email, COUNT(*) as count
         FROM login_attempts
         WHERE success = false AND created_at > NOW() - INTERVAL '7 days'
         GROUP BY email
         ORDER BY COUNT(*) DESC
         LIMIT 10`
      ),

      // Success rate in last 24 hours
      queryOne<{ total: string; successful: string }>(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful
         FROM login_attempts
         WHERE created_at > NOW() - INTERVAL '24 hours'`
      ),
    ]);

    const total = parseInt(successRateResult?.total || '0', 10);
    const successful = parseInt(successRateResult?.successful || '0', 10);
    const successRate = total > 0 ? ((successful / total) * 100).toFixed(1) : '0';

    res.status(200).json({
      success: true,
      data: {
        currentlyLocked: parseInt(currentlyLockedResult[0]?.count || '0', 10),
        failedAttemptsLast24h: parseInt(recentFailuresResult?.count || '0', 10),
        successRateLast24h: `${successRate}%`,
        totalAttemptsLast24h: total,
        topOffenders: topOffendersResult.map(r => ({
          email: r.email,
          failedAttempts: parseInt(r.count, 10),
        })),
        config: {
          maxFailedAttempts: MAX_FAILED_ATTEMPTS,
          lockoutDurationMinutes: LOCKOUT_DURATION_MINUTES,
          attemptWindowMinutes: ATTEMPT_WINDOW_MINUTES,
        },
      },
    } as ApiResponse);

  } catch (error) {
    console.error('❌ Error fetching lockout stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lockout statistics',
    } as ApiResponse);
  }
});

export default router;
