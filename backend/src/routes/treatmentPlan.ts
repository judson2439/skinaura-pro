import { Router, Request, Response } from "express";
import { query, queryOne } from "../config/database.js";
import { verifyToken } from "../lib/auth.js";

const router = Router();

interface ApiResponse<T = unknown> { success: boolean; message?: string; data?: T; error?: string; }

interface TreatmentPlan { id: string; professional_id: string; client_id: string; title: string; description: string | null; goals: string[] | null; start_date: string; end_date: string; status: string; notes: string | null; created_at: string; updated_at: string | null; }
interface TreatmentPlanMilestone { id: string; plan_id: string; title: string; description: string | null; target_date: string; completed: boolean; completed_at: string | null; order_index: number; created_at: string; }
interface TreatmentPlanProduct { id: string; plan_id: string; product_name: string; product_brand: string | null; product_category: string | null; usage_instructions: string | null; priority: string; created_at: string; }
interface TreatmentPlanRoutine { id: string; plan_id: string; routine_name: string; routine_type: string | null; notes: string | null; created_at: string; }
interface TreatmentPlanAppointment { id: string; plan_id: string; appointment_type: string; scheduled_date: string; scheduled_time: string | null; duration_minutes: number; notes: string | null; completed: boolean; created_at: string; }
interface UserProfile { id: string; full_name: string | null; avatar_url: string | null; }

const authMiddleware = async (req: Request, res: Response, next: () => void): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) { res.status(401).json({ success: false, error: "Authorization token required" }); return; }
    const token = authHeader.split(" ")[1];
    const result = verifyToken(token);
    if (!result.valid || !result.payload) { res.status(401).json({ success: false, error: "Invalid or expired token" }); return; }
    (req as any).userId = result.payload.sub as string;
    next();
  } catch (error) { console.error("Auth middleware error:", error); res.status(401).json({ success: false, error: "Authentication failed" }); }
};

router.use(authMiddleware);

// GET /treatment-plans/clients - Get clients for professional
router.get("/clients", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const relationships = await query<{ client_id: string }>("SELECT client_id FROM client_professional_relationships WHERE professional_id = $1 AND status = 'active'", [professionalId]);
    const clientIds = relationships.map(r => r.client_id);
    if (clientIds.length === 0) { res.status(200).json({ success: true, data: { clients: [] } }); return; }
    const clients = await query<UserProfile>("SELECT id, full_name, avatar_url FROM user_profiles WHERE id = ANY($1) ORDER BY full_name ASC", [clientIds]);
    res.status(200).json({ success: true, data: { clients } });
  } catch (error) { console.error("Error fetching clients:", error); res.status(500).json({ success: false, error: "Failed to fetch clients" }); }
});

// GET /treatment-plans - Get all treatment plans with related data
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const plans = await query<TreatmentPlan>("SELECT * FROM treatment_plans WHERE professional_id = $1 ORDER BY created_at DESC", [professionalId]);
    if (plans.length === 0) { res.status(200).json({ success: true, data: { plans: [], milestones: [], products: [], routines: [], appointments: [] } }); return; }
    const planIds = plans.map(p => p.id);
    const milestones = await query<TreatmentPlanMilestone>("SELECT * FROM treatment_plan_milestones WHERE plan_id = ANY($1) ORDER BY order_index ASC", [planIds]);
    const products = await query<TreatmentPlanProduct>("SELECT * FROM treatment_plan_products WHERE plan_id = ANY($1) ORDER BY created_at ASC", [planIds]);
    const routines = await query<TreatmentPlanRoutine>("SELECT * FROM treatment_plan_routines WHERE plan_id = ANY($1) ORDER BY created_at ASC", [planIds]);
    const appointments = await query<TreatmentPlanAppointment>("SELECT * FROM treatment_plan_appointments WHERE plan_id = ANY($1) ORDER BY scheduled_date ASC", [planIds]);
    res.status(200).json({ success: true, data: { plans, milestones, products, routines, appointments } });
  } catch (error) { console.error("Error fetching treatment plans:", error); res.status(500).json({ success: false, error: "Failed to fetch treatment plans" }); }
});

// POST /treatment-plans - Create treatment plan
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { client_id, title, description, goals, start_date, end_date, notes } = req.body;
    if (!client_id || !title || !start_date || !end_date) { res.status(400).json({ success: false, error: "client_id, title, start_date, and end_date are required" }); return; }
    const plan = await queryOne<TreatmentPlan>("INSERT INTO treatment_plans (professional_id, client_id, title, description, goals, start_date, end_date, status, notes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, NOW(), NOW()) RETURNING *", [professionalId, client_id, title, description || null, goals || [], start_date, end_date, notes || null]);
    res.status(201).json({ success: true, data: { plan } });
  } catch (error) { console.error("Error creating treatment plan:", error); res.status(500).json({ success: false, error: "Failed to create treatment plan" }); }
});

// PATCH /treatment-plans/:id/status - Update plan status
router.patch("/:id/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const planId = req.params.id;
    const { status } = req.body;
    if (!status) { res.status(400).json({ success: false, error: "status is required" }); return; }
    const plan = await queryOne<TreatmentPlan>("UPDATE treatment_plans SET status = $1, updated_at = NOW() WHERE id = $2 AND professional_id = $3 RETURNING *", [status, planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    res.status(200).json({ success: true, data: { plan } });
  } catch (error) { console.error("Error updating status:", error); res.status(500).json({ success: false, error: "Failed to update status" }); }
});

// DELETE /treatment-plans/:id - Delete treatment plan
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const planId = req.params.id;
    await query("DELETE FROM treatment_plan_appointments WHERE plan_id = $1", [planId]);
    await query("DELETE FROM treatment_plan_routines WHERE plan_id = $1", [planId]);
    await query("DELETE FROM treatment_plan_products WHERE plan_id = $1", [planId]);
    await query("DELETE FROM treatment_plan_milestones WHERE plan_id = $1", [planId]);
    await query("DELETE FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    res.status(200).json({ success: true, message: "Treatment plan deleted successfully" });
  } catch (error) { console.error("Error deleting treatment plan:", error); res.status(500).json({ success: false, error: "Failed to delete treatment plan" }); }
});

export default router;

// ============================================================================
// MILESTONES ENDPOINTS
// ============================================================================

// POST /treatment-plans/:planId/milestones
router.post("/:planId/milestones", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const planId = req.params.planId;
    console.log("planId", planId);
    console.log("professionalId", professionalId);
    console.log("req.body", req.body);
    const { title, description, target_date } = req.body;

    
    // Verify plan belongs to professional
    const plan = await queryOne<TreatmentPlan>("SELECT id FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    
    const maxOrder = await queryOne<{ max_order: number }>("SELECT COALESCE(MAX(order_index), -1) as max_order FROM treatment_plan_milestones WHERE plan_id = $1", [planId]);
    const orderIndex = (maxOrder?.max_order ?? -1) + 1;
    
    const milestone = await queryOne<TreatmentPlanMilestone>("INSERT INTO treatment_plan_milestones (plan_id, title, description, target_date, completed, order_index, created_at) VALUES ($1, $2, $3, $4, false, $5, NOW()) RETURNING *", [planId, title, description || null, target_date, orderIndex]);
    await query("UPDATE treatment_plans SET updated_at = NOW() WHERE id = $1", [planId]);
    
    res.status(201).json({ success: true, data: { milestone } });
  } catch (error) { console.error("Error creating milestone:", error); res.status(500).json({ success: false, error: "Failed to create milestone" }); }
});

// PATCH /treatment-plans/:planId/milestones/:milestoneId
router.patch("/:planId/milestones/:milestoneId", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { planId, milestoneId } = req.params;
    const { title, description, target_date, completed } = req.body;
    
    const plan = await queryOne<TreatmentPlan>("SELECT id FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    
    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description || null); }
    if (target_date !== undefined) { updates.push(`target_date = $${idx++}`); values.push(target_date); }
    if (completed !== undefined) { 
      updates.push(`completed = $${idx++}`); values.push(completed);
      updates.push(`completed_at = $${idx++}`); values.push(completed ? new Date().toISOString() : null);
    }
    
    if (updates.length === 0) { res.status(400).json({ success: false, error: "No fields to update" }); return; }
    
    values.push(milestoneId, planId);
    const milestone = await queryOne<TreatmentPlanMilestone>(`UPDATE treatment_plan_milestones SET ${updates.join(", ")} WHERE id = $${idx++} AND plan_id = $${idx} RETURNING *`, values);
    await query("UPDATE treatment_plans SET updated_at = NOW() WHERE id = $1", [planId]);
    
    res.status(200).json({ success: true, data: { milestone } });
  } catch (error) { console.error("Error updating milestone:", error); res.status(500).json({ success: false, error: "Failed to update milestone" }); }
});

// DELETE /treatment-plans/:planId/milestones/:milestoneId
router.delete("/:planId/milestones/:milestoneId", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { planId, milestoneId } = req.params;
    
    const plan = await queryOne<TreatmentPlan>("SELECT id FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    
    await query("DELETE FROM treatment_plan_milestones WHERE id = $1 AND plan_id = $2", [milestoneId, planId]);
    await query("UPDATE treatment_plans SET updated_at = NOW() WHERE id = $1", [planId]);
    
    res.status(200).json({ success: true, message: "Milestone deleted successfully" });
  } catch (error) { console.error("Error deleting milestone:", error); res.status(500).json({ success: false, error: "Failed to delete milestone" }); }
});

// ============================================================================
// PRODUCTS ENDPOINTS
// ============================================================================

// POST /treatment-plans/:planId/products
router.post("/:planId/products", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const planId = req.params.planId;
    const { product_name, product_brand, product_category, usage_instructions, priority } = req.body;
    
    const plan = await queryOne<TreatmentPlan>("SELECT id FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    
    const product = await queryOne<TreatmentPlanProduct>("INSERT INTO treatment_plan_products (plan_id, product_name, product_brand, product_category, usage_instructions, priority, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *", [planId, product_name, product_brand || null, product_category || null, usage_instructions || null, priority || "recommended"]);
    await query("UPDATE treatment_plans SET updated_at = NOW() WHERE id = $1", [planId]);
    
    res.status(201).json({ success: true, data: { product } });
  } catch (error) { console.error("Error creating product:", error); res.status(500).json({ success: false, error: "Failed to create product" }); }
});

// DELETE /treatment-plans/:planId/products/:productId
router.delete("/:planId/products/:productId", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { planId, productId } = req.params;
    
    const plan = await queryOne<TreatmentPlan>("SELECT id FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    
    await query("DELETE FROM treatment_plan_products WHERE id = $1 AND plan_id = $2", [productId, planId]);
    await query("UPDATE treatment_plans SET updated_at = NOW() WHERE id = $1", [planId]);
    
    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) { console.error("Error deleting product:", error); res.status(500).json({ success: false, error: "Failed to delete product" }); }
});

// ============================================================================
// ROUTINES ENDPOINTS
// ============================================================================

// POST /treatment-plans/:planId/routines
router.post("/:planId/routines", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const planId = req.params.planId;
    const { routine_name, routine_type, notes } = req.body;
    
    const plan = await queryOne<TreatmentPlan>("SELECT id FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    
    const routine = await queryOne<TreatmentPlanRoutine>("INSERT INTO treatment_plan_routines (plan_id, routine_name, routine_type, notes, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *", [planId, routine_name, routine_type || null, notes || null]);
    await query("UPDATE treatment_plans SET updated_at = NOW() WHERE id = $1", [planId]);
    
    res.status(201).json({ success: true, data: { routine } });
  } catch (error) { console.error("Error creating routine:", error); res.status(500).json({ success: false, error: "Failed to create routine" }); }
});

// DELETE /treatment-plans/:planId/routines/:routineId
router.delete("/:planId/routines/:routineId", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { planId, routineId } = req.params;
    
    const plan = await queryOne<TreatmentPlan>("SELECT id FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    
    await query("DELETE FROM treatment_plan_routines WHERE id = $1 AND plan_id = $2", [routineId, planId]);
    await query("UPDATE treatment_plans SET updated_at = NOW() WHERE id = $1", [planId]);
    
    res.status(200).json({ success: true, message: "Routine deleted successfully" });
  } catch (error) { console.error("Error deleting routine:", error); res.status(500).json({ success: false, error: "Failed to delete routine" }); }
});

// ============================================================================
// APPOINTMENTS ENDPOINTS
// ============================================================================

// POST /treatment-plans/:planId/appointments
router.post("/:planId/appointments", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const planId = req.params.planId;
    const { appointment_type, scheduled_date, scheduled_time, duration_minutes, notes } = req.body;
    
    const plan = await queryOne<TreatmentPlan>("SELECT id FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    
    const appointment = await queryOne<TreatmentPlanAppointment>("INSERT INTO treatment_plan_appointments (plan_id, appointment_type, scheduled_date, scheduled_time, duration_minutes, notes, completed, created_at) VALUES ($1, $2, $3, $4, $5, $6, false, NOW()) RETURNING *", [planId, appointment_type, scheduled_date, scheduled_time || null, duration_minutes || 60, notes || null]);
    await query("UPDATE treatment_plans SET updated_at = NOW() WHERE id = $1", [planId]);
    
    res.status(201).json({ success: true, data: { appointment } });
  } catch (error) { console.error("Error creating appointment:", error); res.status(500).json({ success: false, error: "Failed to create appointment" }); }
});

// PATCH /treatment-plans/:planId/appointments/:appointmentId
router.patch("/:planId/appointments/:appointmentId", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { planId, appointmentId } = req.params;
    const { appointment_type, scheduled_date, scheduled_time, duration_minutes, notes, completed } = req.body;
    
    const plan = await queryOne<TreatmentPlan>("SELECT id FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    
    if (appointment_type !== undefined) { updates.push(`appointment_type = $${idx++}`); values.push(appointment_type); }
    if (scheduled_date !== undefined) { updates.push(`scheduled_date = $${idx++}`); values.push(scheduled_date); }
    if (scheduled_time !== undefined) { updates.push(`scheduled_time = $${idx++}`); values.push(scheduled_time || null); }
    if (duration_minutes !== undefined) { updates.push(`duration_minutes = $${idx++}`); values.push(duration_minutes); }
    if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes || null); }
    if (completed !== undefined) { updates.push(`completed = $${idx++}`); values.push(completed); }
    
    if (updates.length === 0) { res.status(400).json({ success: false, error: "No fields to update" }); return; }
    
    values.push(appointmentId, planId);
    const appointment = await queryOne<TreatmentPlanAppointment>(`UPDATE treatment_plan_appointments SET ${updates.join(", ")} WHERE id = $${idx++} AND plan_id = $${idx} RETURNING *`, values);
    await query("UPDATE treatment_plans SET updated_at = NOW() WHERE id = $1", [planId]);
    
    res.status(200).json({ success: true, data: { appointment } });
  } catch (error) { console.error("Error updating appointment:", error); res.status(500).json({ success: false, error: "Failed to update appointment" }); }
});

// DELETE /treatment-plans/:planId/appointments/:appointmentId
router.delete("/:planId/appointments/:appointmentId", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { planId, appointmentId } = req.params;
    
    const plan = await queryOne<TreatmentPlan>("SELECT id FROM treatment_plans WHERE id = $1 AND professional_id = $2", [planId, professionalId]);
    if (!plan) { res.status(404).json({ success: false, error: "Treatment plan not found" }); return; }
    
    await query("DELETE FROM treatment_plan_appointments WHERE id = $1 AND plan_id = $2", [appointmentId, planId]);
    await query("UPDATE treatment_plans SET updated_at = NOW() WHERE id = $1", [planId]);
    
    res.status(200).json({ success: true, message: "Appointment deleted successfully" });
  } catch (error) { console.error("Error deleting appointment:", error); res.status(500).json({ success: false, error: "Failed to delete appointment" }); }
});
