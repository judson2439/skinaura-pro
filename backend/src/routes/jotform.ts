/**
 * JotForm webhook endpoint.
 * Receives form submission data from JotForm via webhook.
 *
 * Configure in JotForm: Form Settings → Integrations → Webhooks
 * Webhook URL: https://your-api-domain/api/webhooks/jotform
 */

import { Request, Response } from 'express';
import { Router } from 'express';

const router = Router();

/**
 * POST /webhooks/jotform
 * JotForm sends submission data here (typically application/x-www-form-urlencoded).
 * Payload may include: rawRequest, submissionId, formID, formTitle, and field answers.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  // Blank handler – process req.body as needed later
  const _payload = req.body;

  console.log('JotForm webhook received', _payload);

  res.status(200).json({ received: true });
});

export default router;
