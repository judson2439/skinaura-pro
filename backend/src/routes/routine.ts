import { Router, Request, Response } from "express";
import { query, queryOne } from "../config/database.js";
import { verifyToken } from "../lib/auth.js";

const router = Router();

interface ApiResponse<T = unknown> { success: boolean; message?: string; data?: T; error?: string; }
interface RoutineTemplate { id: string; professional_id: string; name: string; description: string | null; schedule_type: string; schedule_days: string[] | null; is_active: boolean; created_at: string; updated_at: string; }
interface RoutineStep { id: string; routine_id: string; step_order: number; step_name: string; description: string | null; duration_seconds: number | null; product_category: string | null; product_recommendation: string | null; tips: string | null; is_optional: boolean; created_at: string; }
interface ClientRoutineAssignment { id: string; routine_id: string; client_id: string; professional_id: string; is_active: boolean; assigned_at: string; notes: string | null; created_at: string; updated_at: string; }
interface UserProfile { id: string; email: string; full_name: string | null; avatar_url: string | null; phone: string | null; skin_type: string | null; concerns: string[] | null; role: string; }

const authMiddleware = async (req: Request, res: Response, next: () => void): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) { res.status(401).json({ success: false, error: "Authorization token required" }); return; }
    const token = authHeader.split(" ")[1];
    const result = verifyToken(token);
    if (!result.valid || !result.payload) { res.status(401).json({ success: false, error: "Invalid or expired token" }); return; }
    (req as any).userId = result.payload.sub as string;
    (req as any).userEmail = result.payload.email as string;
    next();
  } catch (error) { console.error("Auth middleware error:", error); res.status(401).json({ success: false, error: "Authentication failed" }); }
};

router.use(authMiddleware);


router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const includeInactive = req.query.includeInactive === "true";
    const routinesQuery = includeInactive ? "SELECT * FROM routine_templates WHERE professional_id = $1 ORDER BY created_at DESC" : "SELECT * FROM routine_templates WHERE professional_id = $1 AND is_active = true ORDER BY created_at DESC";
    const routines = await query<RoutineTemplate>(routinesQuery, [professionalId]);
    if (routines.length === 0) { res.status(200).json({ success: true, data: { routines: [], steps: [] } }); return; }
    const routineIds = routines.map(r => r.id);
    const steps = await query<RoutineStep>("SELECT * FROM routine_steps WHERE routine_id = ANY($1) ORDER BY step_order ASC", [routineIds]);
    res.status(200).json({ success: true, data: { routines, steps } });
  } catch (error) { console.error("Error fetching routines:", error); res.status(500).json({ success: false, error: "Failed to fetch routines" }); }
});

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { name, description, schedule_type, schedule_days } = req.body;
    if (!name || !schedule_type) { res.status(400).json({ success: false, error: "Name and schedule_type are required" }); return; }
    const routine = await queryOne<RoutineTemplate>("INSERT INTO routine_templates (professional_id, name, description, schedule_type, schedule_days, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW()) RETURNING *", [professionalId, name.trim(), description?.trim() || null, schedule_type, schedule_days || null]);
    res.status(201).json({ success: true, data: { routine } });
  } catch (error) { console.error("Error creating routine:", error); res.status(500).json({ success: false, error: "Failed to create routine" }); }
});

router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const routineId = req.params.id;
    await query("UPDATE routine_templates SET is_active = false, updated_at = NOW() WHERE id = $1 AND professional_id = $2", [routineId, professionalId]);
    await query("UPDATE client_routine_assignments SET is_active = false, updated_at = NOW() WHERE routine_id = $1", [routineId]);
    res.status(200).json({ success: true, message: "Routine deleted successfully" });
  } catch (error) { console.error("Error deleting routine:", error); res.status(500).json({ success: false, error: "Failed to delete routine" }); }
});


router.post("/:routineId/steps", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const routineId = req.params.routineId;
    const { step_name, description, duration_seconds, product_category, product_recommendation, tips, is_optional } = req.body;
    const routine = await queryOne<RoutineTemplate>("SELECT id FROM routine_templates WHERE id = $1 AND professional_id = $2", [routineId, professionalId]);
    if (!routine) { res.status(404).json({ success: false, error: "Routine not found" }); return; }
    const maxOrderResult = await queryOne<{ max_order: number }>("SELECT COALESCE(MAX(step_order), 0) as max_order FROM routine_steps WHERE routine_id = $1", [routineId]);
    const newStepOrder = (maxOrderResult?.max_order || 0) + 1;
    const step = await queryOne<RoutineStep>("INSERT INTO routine_steps (routine_id, step_order, step_name, description, duration_seconds, product_category, product_recommendation, tips, is_optional, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING *", [routineId, newStepOrder, step_name || "New Step", description || null, duration_seconds || null, product_category || null, product_recommendation || null, tips || null, is_optional || false]);
    await query("UPDATE routine_templates SET updated_at = NOW() WHERE id = $1", [routineId]);
    res.status(201).json({ success: true, data: { step } });
  } catch (error) { console.error("Error adding step:", error); res.status(500).json({ success: false, error: "Failed to add step" }); }
});

router.delete("/:routineId/steps/:stepId", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { routineId, stepId } = req.params;
    const routine = await queryOne<RoutineTemplate>("SELECT id FROM routine_templates WHERE id = $1 AND professional_id = $2", [routineId, professionalId]);
    if (!routine) { res.status(404).json({ success: false, error: "Routine not found" }); return; }
    const stepToDelete = await queryOne<{ step_order: number }>("SELECT step_order FROM routine_steps WHERE id = $1 AND routine_id = $2", [stepId, routineId]);
    if (!stepToDelete) { res.status(404).json({ success: false, error: "Step not found" }); return; }
    await query("DELETE FROM routine_step_products WHERE routine_step_id = $1", [stepId]);
    await query("DELETE FROM routine_steps WHERE id = $1 AND routine_id = $2", [stepId, routineId]);
    await query("UPDATE routine_steps SET step_order = step_order - 1 WHERE routine_id = $1 AND step_order > $2", [routineId, stepToDelete.step_order]);
    await query("UPDATE routine_templates SET updated_at = NOW() WHERE id = $1", [routineId]);
    res.status(200).json({ success: true, message: "Step deleted successfully" });
  } catch (error) { console.error("Error deleting step:", error); res.status(500).json({ success: false, error: "Failed to delete step" }); }
});


router.get("/clients/list", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const relationships = await query<{ client_id: string }>("SELECT client_id FROM client_professional_relationships WHERE professional_id = $1 AND status = 'active'", [professionalId]);
    const clientIds = relationships.map(r => r.client_id);
    if (clientIds.length === 0) { res.status(200).json({ success: true, data: { clients: [] } }); return; }
    const clients = await query<UserProfile>("SELECT id, email, full_name, avatar_url, phone, skin_type, concerns, role FROM user_profiles WHERE id = ANY($1) ORDER BY full_name ASC", [clientIds]);
    res.status(200).json({ success: true, data: { clients } });
  } catch (error) { console.error("Error fetching clients:", error); res.status(500).json({ success: false, error: "Failed to fetch clients" }); }
});

router.get("/assignments", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const routineId = req.query.routine_id as string;
    let assignmentsQuery = "SELECT * FROM client_routine_assignments WHERE professional_id = $1 AND is_active = true";
    const params: unknown[] = [professionalId];
    if (routineId) { assignmentsQuery += " AND routine_id = $2"; params.push(routineId); }
    assignmentsQuery += " ORDER BY assigned_at DESC";
    const assignments = await query<ClientRoutineAssignment>(assignmentsQuery, params);
    res.status(200).json({ success: true, data: { assignments } });
  } catch (error) { console.error("Error fetching assignments:", error); res.status(500).json({ success: false, error: "Failed to fetch assignments" }); }
});


router.post("/assignments", async (req: Request, res: Response): Promise<void> => {
  try {
    const professionalId = (req as any).userId;
    const { routine_id, client_id, notes } = req.body;
    if (!routine_id || !client_id) { res.status(400).json({ success: false, error: "routine_id and client_id are required" }); return; }
    const routine = await queryOne<RoutineTemplate>("SELECT id FROM routine_templates WHERE id = $1 AND professional_id = $2", [routine_id, professionalId]);
    if (!routine) { res.status(404).json({ success: false, error: "Routine not found" }); return; }
    const existingAssignment = await queryOne<ClientRoutineAssignment>("SELECT * FROM client_routine_assignments WHERE routine_id = $1 AND client_id = $2 AND professional_id = $3", [routine_id, client_id, professionalId]);
    let assignment: ClientRoutineAssignment | null;
    if (existingAssignment) {
      if (existingAssignment.is_active) { res.status(200).json({ success: true, data: { assignment: existingAssignment }, message: "Routine is already assigned to this client" }); return; }
      assignment = await queryOne<ClientRoutineAssignment>("UPDATE client_routine_assignments SET is_active = true, notes = $1, assigned_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *", [notes?.trim() || null, existingAssignment.id]);
    } else {
      assignment = await queryOne<ClientRoutineAssignment>("INSERT INTO client_routine_assignments (routine_id, client_id, professional_id, is_active, notes, assigned_at, created_at, updated_at) VALUES ($1, $2, $3, true, $4, NOW(), NOW(), NOW()) RETURNING *", [routine_id, client_id, professionalId, notes?.trim() || null]);
    }
    res.status(201).json({ success: true, data: { assignment } });
  } catch (error) { console.error("Error assigning routine:", error); res.status(500).json({ success: false, error: "Failed to assign routine" }); }
});

export default router;

