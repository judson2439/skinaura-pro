/**
 * JotForm webhook endpoint.
 * Receives form submission data from JotForm via webhook.
 *
 * Configure in JotForm: Form Settings → Integrations → Webhooks
 * Webhook URL: https://your-api-domain/api/webhooks/jotform
 */

import { Request, Response } from 'express';
import { Router } from 'express';
import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { env } from '../config/env.js';
import { query, queryOne } from '../config/database.js';

const router = Router();

// Initialize Mailgun client
const mailgun = new Mailgun(formData);
const mg = env.MAILGUN_API_KEY ? mailgun.client({
  username: 'api',
  key: env.MAILGUN_API_KEY,
}) : null;

interface Label {
  qid: string;
  text: string;
}

interface JotFormPayload {
  labels?: Label[];
  request?: Record<string, any>;
}

interface InlineImage {
  filename: string;
  data: Buffer;
}

/**
 * Extract question ID from request key (e.g., "q3_name" -> "3", "q8_date" -> "8")
 */
const extractQid = (key: string): string | null => {
  const match = key.match(/^q(\d+)/);
  return match ? match[1] : null;
};

/**
 * Check if value is a base64 image
 */
const isBase64Image = (value: any): boolean => {
  if (typeof value !== 'string') return false;
  return value.startsWith('data:image/') && value.includes('base64,');
};

/**
 * Parse a data URI and return a Buffer + extension
 */
const parseBase64Image = (dataUri: string): { buffer: Buffer; ext: string } | null => {
  const match = dataUri.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
  if (!match) return null;
  return { buffer: Buffer.from(match[2], 'base64'), ext: match[1] };
};

/**
 * Format value for display (handle objects, arrays, etc.)
 */
const formatValue = (value: any): string => {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    const entries = Object.entries(value).filter(([_, v]) => v != null && v !== '');
    if (entries.length === 0) return '';
    if ('first' in value || 'last' in value) {
      return [value.first, value.last].filter(Boolean).join(' ');
    }
    if ('month' in value && 'day' in value && 'year' in value) {
      return `${value.month}-${value.day}-${value.year}`;
    }
    if ('addr_line1' in value || 'city' in value) {
      const parts = [
        value.addr_line1,
        value.addr_line2,
        [value.city, value.state, value.postal].filter(Boolean).join(', '),
        value.country
      ].filter(Boolean);
      return parts.join('\n');
    }
    return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
  }
  return String(value);
};

// System keys to skip
const SKIP_KEYS = new Set([
  'slug', 'jsExecutionTracker', 'submitSource', 'submitDate', 'buildDate',
  'uploadServerUrl', 'eventObserver', 'formOpenId_V5', 'timeToSubmit',
  'preview', 'validatedNewRequiredFieldIDs', 'path',
]);

interface MatchedField {
  label: string;
  value: string;
  /** CID filename for inline image, or null */
  cidFilename: string | null;
}

/**
 * Match labels with request values, returning fields + inline image attachments
 */
const matchFields = (
  labels: Label[],
  request: Record<string, any>
): { fields: MatchedField[]; inlineImages: InlineImage[] } => {
  const fields: MatchedField[] = [];
  const inlineImages: InlineImage[] = [];

  const labelMap = new Map<string, string>();
  labels.forEach(l => labelMap.set(l.qid, l.text));

  Object.entries(request).forEach(([key, value]) => {
    if (!key.startsWith('q')) return;

    const qid = extractQid(key);
    if (!qid) return;

    const label = labelMap.get(qid);
    if (!label) return;

    if (SKIP_KEYS.has(key)) return;

    // Handle base64 images (signature)
    if (isBase64Image(value)) {
      const parsed = parseBase64Image(value);
      if (parsed) {
        const filename = `signature_${qid}.${parsed.ext}`;
        inlineImages.push({ filename, data: parsed.buffer });
        fields.push({
          label,
          value: '', // not used for images
          cidFilename: filename,
        });
        console.log(`📝 Signature image found (qid ${qid}): ${parsed.buffer.length} bytes`);
      }
      return;
    }

    const formatted = formatValue(value);
    if (!formatted) return;

    fields.push({ label, value: formatted, cidFilename: null });
  });

  return { fields, inlineImages };
};

/**
 * Build HTML email from matched fields
 */
const buildHtmlEmail = (fields: MatchedField[]): string => {
  // Separate signature field from other fields
  const regularFields = fields.filter(f => !f.cidFilename);
  const signatureField = fields.find(f => f.cidFilename);

  // Extract client name and date from fields for the header
  const nameField = regularFields.find(f => f.label.replace(/<[^>]*>/g, '').trim().toLowerCase() === 'name');
  const dateField = regularFields.find(f => f.label.replace(/<[^>]*>/g, '').trim().toLowerCase() === 'date');
  const clientName = nameField?.value || 'Client';
  const submissionDate = dateField?.value || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Build alternating-row table
  const rows = regularFields.map(({ label, value }, idx) => {
    const cleanLabel = label.replace(/<[^>]*>/g, '').trim();
    const bgColor = idx % 2 === 0 ? '#ffffff' : '#fafaf8';

    return `
              <tr>
                <td style="padding: 14px 20px; background-color: ${bgColor}; font-size: 13px; font-weight: 600; color: #6b5e57; width: 220px; vertical-align: top; letter-spacing: 0.3px; border-bottom: 1px solid #f0ebe8;">
                  ${cleanLabel}
                </td>
                <td style="padding: 14px 20px; background-color: ${bgColor}; font-size: 14px; color: #2D2A3E; vertical-align: top; border-bottom: 1px solid #f0ebe8; line-height: 1.6;">
                  ${value.replace(/\n/g, '<br>')}
                </td>
              </tr>`;
  }).join('');

  // Signature section
  const signatureHtml = signatureField ? `
          <!-- Signature -->
          <tr>
            <td style="padding: 30px 40px 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding-bottom: 10px;">
                    <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #b8a99e; font-weight: 600;">Client Signature</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0;">
                    <div style="border: 2px solid #f0ebe8; border-radius: 12px; padding: 20px; background-color: #fdfcfb; display: inline-block;">
                      <img src="cid:${signatureField.cidFilename}" alt="Client Signature" style="max-width: 280px; max-height: 120px; display: block;" />
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Skin Care Consultation Form</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f0ed;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 680px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 30px rgba(45, 42, 62, 0.08);">
          
          <!-- Top accent bar -->
          <tr>
            <td style="height: 5px; background: linear-gradient(90deg, #CFAFA3 0%, #e8c4b8 35%, #f2d9cf 65%, #CFAFA3 100%);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 10px; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <img src="https://emqiscdnvmjjrqapccib.supabase.co/storage/v1/object/public/progress-photos/logo.png" alt="SkinAura PRO" style="width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 18px; display: block; object-fit: cover;" />
                    <h1 style="margin: 0 0 6px; color: #2D2A3E; font-size: 26px; font-weight: 700; letter-spacing: -0.3px;">Skin Care Consultation</h1>
                    <p style="margin: 0; color: #b8a99e; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 500;">New Form Submission</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Client badge -->
          <tr>
            <td style="padding: 20px 40px 10px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #fdfcfb 0%, #f8f4f1 100%); border-radius: 14px; border: 1px solid #f0ebe8;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <p style="margin: 0 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #b8a99e; font-weight: 600;">Client</p>
                          <p style="margin: 0; font-size: 20px; font-weight: 700; color: #2D2A3E;">${clientName}</p>
                        </td>
                        <td style="vertical-align: middle; text-align: right;">
                          <p style="margin: 0 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: #b8a99e; font-weight: 600;">Date</p>
                          <p style="margin: 0; font-size: 14px; color: #6b5e57; font-weight: 500;">${submissionDate}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 10px 40px 0;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, #e8ddd6, transparent);"></div>
            </td>
          </tr>

          <!-- Section label -->
          <tr>
            <td style="padding: 24px 40px 12px;">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #b8a99e; font-weight: 600;">Form Details</p>
            </td>
          </tr>

          <!-- Data table -->
          <tr>
            <td style="padding: 0 40px;">
              <table style="width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; border: 1px solid #f0ebe8;">
                ${rows}
              </table>
            </td>
          </tr>

          ${signatureHtml}

          <!-- Divider -->
          <tr>
            <td style="padding: 20px 40px 0;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, #e8ddd6, transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 30px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #CFAFA3;">SkinAura PRO</p>
              <p style="margin: 0; color: #c4b5ae; font-size: 11px;">
                Professional Skincare Management &bull; ${new Date().getFullYear()}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * POST /webhooks/jotform
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body as JotFormPayload;

    console.log('JotForm webhook received', payload);

    const labels = payload.labels || [];
    const request = payload.request || {};

    if (labels.length === 0 || Object.keys(request).length === 0) {
      console.warn('⚠️ Missing labels or request data in JotForm webhook');
      res.status(200).json({ received: true, warning: 'Missing data' });
      return;
    }

    // Match labels with request values
    const { fields, inlineImages } = matchFields(labels, request);

    // Extract client email from fields
    const emailField = fields.find(f => {
      const cleanLabel = f.label.replace(/<[^>]*>/g, '').trim().toLowerCase();
      return cleanLabel === 'email' || cleanLabel.includes('mail');
    });
    const clientEmail = emailField?.value?.trim().toLowerCase();

    if (!clientEmail) {
      console.error('❌ Client email not found in form fields');
      console.log('Available fields:', fields.map(f => ({ label: f.label.replace(/<[^>]*>/g, '').trim(), value: f.value?.substring(0, 50) })));
      res.status(400).json({
        received: true,
        error: 'Client email not found in form submission',
      });
      return;
    }

    console.log(`📧 Looking up professional email for client: ${clientEmail}`);

    // Get professional email from database
    let recipientEmail: string | null = null;
    try {
      // Step 1: Get client_id from user_profiles by email
      const clientProfile = await queryOne<{ id: string }>(
        'SELECT id FROM user_profiles WHERE LOWER(email) = $1',
        [clientEmail]
      );

      if (!clientProfile) {
        console.error(`❌ Client profile not found for email: ${clientEmail}`);
        res.status(404).json({
          received: true,
          error: `Client not found with email: ${clientEmail}`,
        });
        return;
      }

      console.log(`✅ Found client profile: ${clientProfile.id}`);

      // Step 2: Get professional_id from client_professional_relationships by client_id
      const relationship = await queryOne<{ professional_id: string }>(
        'SELECT professional_id FROM client_professional_relationships WHERE client_id = $1 AND status = $2 LIMIT 1',
        [clientProfile.id, 'active']
      );

      if (!relationship) {
        console.error(`❌ No active relationship found for client_id: ${clientProfile.id}`);
        res.status(404).json({
          received: true,
          error: `No active professional relationship found for client: ${clientEmail}`,
        });
        return;
      }

      console.log(`✅ Found professional relationship: ${relationship.professional_id}`);

      // Step 3: Get professional email from user_profiles by professional_id
      const professionalProfile = await queryOne<{ email: string }>(
        'SELECT email FROM user_profiles WHERE id = $1',
        [relationship.professional_id]
      );

      if (!professionalProfile || !professionalProfile.email) {
        console.error(`❌ Professional profile not found for professional_id: ${relationship.professional_id}`);
        res.status(404).json({
          received: true,
          error: `Professional profile not found`,
        });
        return;
      }

      recipientEmail = professionalProfile.email;
      console.log(`✅ Found professional email: ${recipientEmail}`);
    } catch (error) {
      console.error('❌ Error fetching professional email:', error);
      res.status(500).json({
        received: true,
        error: 'Failed to fetch professional email',
      });
      return;
    }

    if (!recipientEmail) {
      console.error('❌ Professional email is null');
      res.status(500).json({
        received: true,
        error: 'Professional email not found',
      });
      return;
    }

    // Build email content
    const htmlContent = buildHtmlEmail(fields);

    // Plain text version
    const textContent = fields
      .map(f => {
        const cleanLabel = f.label.replace(/<[^>]*>/g, '');
        if (f.cidFilename) return `${cleanLabel}: [Signature Image]`;
        return `${cleanLabel}: ${f.value}`;
      })
      .join('\n');

    if (!mg || !env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
      console.warn('⚠️ Mailgun not configured - email not sent');
      console.log(`📧 [DEV] Form submission email would be sent to ${recipientEmail}`);
      console.log(`📧 [DEV] Inline images: ${inlineImages.length}`);
      console.log('📧 [DEV] Email content:', textContent);
      res.status(200).json({ received: true, emailSent: false, devMode: true });
      return;
    }

    // Build Mailgun message with inline attachments for signature images
    const messageData: any = {
      from: `${env.MAILGUN_FROM_NAME} <${env.MAILGUN_FROM_EMAIL}>`,
      to: [recipientEmail],
      subject: 'New Skin Care Consultation Form Submission',
      text: textContent,
      html: htmlContent,
    };

    // Add inline images (CID attachments) so email clients can render them
    if (inlineImages.length > 0) {
      messageData.inline = inlineImages.map(img => ({
        filename: img.filename,
        data: img.data,
      }));
      console.log(`📎 Attaching ${inlineImages.length} inline image(s)`);
    }

    const result = await mg.messages.create(env.MAILGUN_DOMAIN, messageData);

    console.log(`✅ Form submission email sent to ${recipientEmail}, messageId: ${result.id}`);

    res.status(200).json({
      received: true,
      emailSent: true,
      messageId: result.id,
    });
  } catch (error: any) {
    console.error('❌ Error processing JotForm webhook:', error);
    res.status(500).json({
      received: true,
      error: error.message || 'Failed to process webhook',
    });
  }
});

export default router;
