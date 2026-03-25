# SkinAura PRO – Product Spec Guidance (Code-Aligned)

This document is the **code-checked reference** for the SkinAura PRO product spec. Use it to correct or update your main product spec (e.g. `SkinAura_PRO_Product_Spec.docx`). The original .docx was not in the repository; this content is derived from a full codebase review.

---

## 1. Project Overview (Code-Aligned)

Use this table and paragraph in your spec doc. It corrects common mistakes (tech stack, AI wording).

| Field | Correct value |
|-------|----------------|
| **Product Name** | SkinAura PRO |
| **Platform** | Web Application (skinaura.pro) |
| **Tech Stack** | Node.js, Express, PostgreSQL, Vite, React, TypeScript. Supabase client used in **frontend only** (e.g. storage); backend uses **PostgreSQL + custom auth**, not Supabase server-side. Optional: AWS EC2 (hosting). |
| **Project Started** | December 15, 2025 |
| **Target Users** | Estheticians, Dermatologists, Medspas (B2B) + Their Clients (B2C) |
| **Business Model** | B2B2C — SkinAura PRO as a value-add for professionals |
| **Tagline** | Scan. Plan. Track. Adjust. |

**Overview paragraph (use this; fixes “Al” → “AI”):**  
SkinAura PRO is a client accountability platform built specifically for licensed skincare professionals. Professionals use it to assign skincare routines, track client follow-through, recommend products, manage treatment plans, and share **AI** skin scan data — all within a HIPAA-conscious, multi-tenant environment.

---

## 2. Corrections / Common Spec Mistakes

Apply these corrections when updating the spec document:

| If the spec says… | Correct to… |
|-------------------|-------------|
| **Order** or e-commerce / checkout | **No Order entity.** The app does not have orders, checkout, or e-commerce. Products are “recommended” or “linked” to routines/treatment plans; there is no purchase flow in-app. |
| **Consultation** as a first-class entity/table | **Consultation** is implemented as: (1) client `POST /api/client/submit-consultation`, (2) JotForm webhook `POST /api/webhooks/jotform`. There is no single “Consultation” table; document it as “consultation flow” / “virtual consult” (professional section: **consult**). |
| **Routine** vs **Template routine** | **Routine** = professional-owned routine templates + steps + client assignments + completions. **Template routine** = admin-only, platform-wide templates that professionals can “apply” to create their own routines. Use both terms distinctly. |
| Notification “read all” API naming | Backend uses both `read-all` and `mark-all-read` depending on route (e.g. professional vs client). Document the actual endpoint names per route group. |
| CORS / dev port | Backend allows `http://localhost:8000` (and optionally `CORS_ORIGIN`). Frontend dev typically runs on a different port (e.g. Vite default). Align spec with `CORS_ORIGIN` and frontend `VITE_API_BASE_URL`. |
| Auth library | **Custom auth** (bcrypt + JWT-style HMAC tokens in `lib/auth.ts`), **not** Passport or a third-party JWT library. Supabase client exists in **frontend** only (e.g. storage); backend uses PostgreSQL + custom auth. |
| Database | **PostgreSQL** only. No Supabase server-side in backend routes. |
| Client “Face” section | Client nav section is **face-analysis** (label: “Face Analysis”), not “Facial Scan”. Professional side has **facial-scan-reports** (“Facial Scan”) for viewing client facial scan results. |

---

## 3. Platform Architecture & Tech Stack (Code-Aligned)

Use this to correct **Section 2** of your spec doc (Hosting & Infrastructure, Integrations table).

### 3.1 Hosting & Infrastructure — corrections

- **Database:** Describe as **PostgreSQL**. The app connects via the `pg` driver and `DB_*` env vars. The database may be **hosted by Supabase** (or any Postgres host), but the backend does **not** use Supabase for Auth or server-side APIs — only raw PostgreSQL. So write: "Database: PostgreSQL (e.g. Supabase-hosted or self-hosted). Backend uses `pg` + custom auth; Supabase is not used for Auth in PRO."
- **Frontend build:** Vite; serve production from `dist/` (not `vite preview`) — correct as-is.
- Production / Dev/Staging URLs and GoDaddy — keep as documented if accurate for your deployment.

### 3.2 Integrations & Third-Party Services — corrections

| Service | Purpose | Notes |
|---------|---------|-------|
| **Supabase** | Database & frontend storage | Hosted PostgreSQL; frontend storage (e.g. images). Backend auth is custom (bcrypt + JWT in `lib/auth.ts`) — do not list "Auth" under Supabase for PRO. |
| **Mailgun** | Transactional Email (SMTP) | Account confirmation, password reset, invitations, etc. |
| **SimpleTexting** | SMS Verification & Notifications | Implemented in `backend/src/lib/sms.ts` (`SIMPLETEXTING_API_KEY`, `SIMPLETEXTING_FROM_NUMBER`). Use SimpleTexting in doc; Twilio is not used in this codebase. |
| **FaceAge** | AI Skin / Facial Analysis | FaceAge (getfaceage.com) is primary; @vladmandic/face-api also used for in-app analysis. FaceAge uses Klavivo for emailing reports from mobile. Photo upload required for laptop users. "Powered by FaceAge" link removed from UI. |
| **Stripe** | Payments | Configured on skinaura.ai (landing/funnel). PRO is app only; payment flow lives on skinaura.ai, not skinaura.pro. |
| **Agentli.ai (GoHighLevel)** | CRM, Automations, Video Check-ins | Handles 1:1 follow-up video check-ins (Zoom links auto-generated), scheduling reminders, welcome email triggers. PRO links out to Agentli; does NOT host video. |
| **JotForm** | Client Intake Forms | HIPAA-compliant forms. Intake form embedded/linked in client profile. Webhook `POST /api/webhooks/jotform`. Completed form routes to professional (email + in-app record). Form auto-opens on invitation accept. |
| **Shopify / WooCommerce** | Product Import | Professionals import product inventory via Shopify (OAuth, `professional.ts`). WooCommerce has no implementation in this repo — remove or mark as optional/future. Product Type dropdown must include Nutrition and Vitamins. |
| **Constant Contact** | Email Marketing | Triggered welcome emails for new signups. Links to skinaura.pro must use production build to avoid Vite blocked-host errors. |
| **Asana** | Project Management | Developer and team tasks tracked here. GHL team also has access. |

---

## 4. User Roles & Entry Points

| Role | Sign-in endpoint | Default redirect |
|------|------------------|------------------|
| **Client** | `POST /api/auth/client/signin` or `POST /api/auth/signin` (with role) | `/client/dashboard` |
| **Professional** | `POST /api/auth/professional/signin` or `POST /api/auth/signin` | `/professional/dashboard` |
| **Admin** | `POST /api/auth/admin/signin` | `/admin` |

Roles are stored in `user_profiles.role` (`client` | `professional` | `admin`).

---

## 5. User Roles & Access (Code-Aligned)

Use this to correct **Section 3 (User Roles & Access)** of your spec doc. The structure below matches your doc (3.1, 3.2, 3.3); content is aligned to the codebase.

### 5.1 Three-Role Architecture

SkinAura PRO operates across three distinct roles, each with isolated access:

| Role | Who | Key Access |
|------|-----|------------|
| **Admin** | SkinAura team | Full platform visibility, routine template creation, user management, mock/demo data. Cannot see professional or client passwords (auth is custom; passwords in app DB only). |
| **Professional** | Estheticians, dermatologists, medspas | Own tenant — sees ONLY their clients. Invite clients, assign routines, recommend products, create treatment plans, manage profile, view notifications, upload onboarding docs, add NCEA certification # and license #. |
| **Client** | End consumers / patients | View and complete daily AM/PM/weekly routines, track progress, run AI skin scans, view assigned products, complete intake forms, message professional via notes, access resources/PDFs. |

### 5.2 Tenant Partitioning Model (B2B2C)

**CRITICAL DECISION:** Each professional operates as an independent tenant. The global client list is never exposed to any professional. Data model (as in code):

- **`user_profiles`** (`id`, `email`, `full_name`, `role`, …) — all users (clients, professionals, admins). Role = `client` \| `professional` \| `admin`. There is no separate `practices` or `providers` table; professionals are rows with `role = 'professional'`.
- **`client_professional_relationships`** (`client_id`, `professional_id`, `status`, `created_at`, `updated_at`) — links clients to professionals. Status e.g. `active`. Professionals query clients **only** via `professional_id` (their own `user_profiles.id`).
- **`client_invitations`** (`email`, `professional_id`, `status`, `token`, `expires_at`, …) — pending invites before the client has an account or has accepted.
- New professionals see zero clients on Day 1; they must invite clients to populate their list.

**Spec doc correction:** If your doc mentions `practices(id, name)`, `providers(id, practice_id, role)`, or `client_practice_memberships(..., practice_id)`, replace with the above. The codebase uses **professional_id** (the professional’s user id) for tenancy, not a separate practice/tenant table.

### 5.3 Client Onboarding Flow

Two supported paths for adding clients to a professional’s roster:

- **Path 1 — New client:** Professional sends invite by email → client receives invite link → client signs up (e.g. via invite token) → auto-linked to that professional (`client_professional_relationships` created).
- **Path 2 — Existing client:** Professional enters client email → system detects existing account → client receives invitation notification (e.g. `professional_invitation_notifications`) → client accepts in their portal → link is established.

Additional points:

- Professional is notified when the client accepts or when a new client registers (per app notification flow).
- Admin can create accounts manually (e.g. via database or support tooling) when needed for edge-case onboarding support. **Do not say “in Supabase” for Auth:** PRO uses **PostgreSQL + custom auth**; accounts are not created in Supabase Auth.

---

## 6. Core Features & Functional Requirements (Code-Aligned)

Use this to correct **Section 4 (Core Features & Functional Requirements)** of your spec doc. Structure and style match the spec (4.1–4.9); content is aligned to the codebase. Copy or adapt the text below into your product spec.

---

### 6.1 Routine Management

- **Routine types:** AM (morning), PM (evening), Weekly, and Custom. In code, schedule types are `morning`, `evening`, `weekly`, and `daily`/custom. There is no "Monthly" schedule type; use Custom for other cadences.
- **Daily routines:** Reset each day; completed status reflects compliance tracking. Client marks steps or full routine complete per day; professional dashboard shows today’s completion.
- **Weekly routines:** Once completed within the current week (Monday–Sunday), the routine shows as complete for the remainder of that week and does not reset daily. Backend treats weekly completions separately from daily (morning/evening) for compliance logic.
- **Professionals create Routine Templates:** These are reusable across multiple clients. Stored as professional-owned `routine_templates` with steps and optional product links.
- **Admin can create global Routine Templates:** Platform-wide templates live in `template_routine_templates` and `template_routine_steps`. Professionals can apply them via "Use Templates" to create their own routines, then edit steps and products.
- **A Professional assigns a Routine Template** to one or more clients via client routine assignments. Only assigned routines appear on the client side.
- **Routine steps must be added** to each routine for it to appear and be completable on the client side; empty routines are not shown.
- **Client can complete routine steps:** Completion is recorded per day (or per week for weekly routines). Completion status is visible on the professional’s dashboard and in analytics.
- **Routine Completion Trend:** Compliance can be tracked over 7-day, 30-day, and 90-day windows in the analytics area.
- **Notes / feedback field:** Clients can leave messages for their professional in the routine section. The professional receives an in-app notification when a client sends a note.

---

### 6.2 AI Skin Scanner

- **Primary technology:** FaceAge is integrated (getfaceage.com); FaceAPI (@vladmandic/face-api) is also used for in-app analysis (e.g. face-age, expressions). FaceAge is primary for the full scan flow.
- **Photo upload supported:** For laptop users without a webcam, photo upload is supported so they can run the analysis.
- **Scan history saved:** Per client. The app stores FaceAge V2 analysis records; clients can view history and optionally share reports with their professional.
- **Scan results displayed:** With detailed analysis (e.g. concern areas, overlays). A reference URL such as skinaura.vip/pages/ai-skin-analysis may be used for external or marketing reference; in-app results are shown in the Face Analysis section.
- **'Powered by FaceAge' branding removed** from the in-app UI.
- **Client facial scan reports shareable with professionals:** Implemented. The client voluntarily taps a "Send to provider" (or equivalent) action; the app marks the analysis as sent (e.g. PATCH `faceage-analysis/:id/sent`). This voluntary submit creates a consent record for biometric privacy (BIPA and state equivalents). Do not document as "DECISION PENDING"; the feature is live.
- **Professional side:** A dedicated section **Facial Scan** (section ID `facial-scan-reports`) receives and displays submitted client scan reports. The professional can open a report and mark it as reviewed/checked so they can track what has been seen.

---

### 6.3 Product Management

- **Professionals maintain a product library:** Searchable by brand, category, and ingredient. Products are stored per professional and can be linked to routine steps.
- **Products can be imported** via Shopify bulk import (OAuth flow in the professional area). When Shopify is connected, professionals can pull in product inventory.
- **WooCommerce:** Not implemented in this codebase. If the spec mentions WooCommerce, either remove it or mark it as optional/future. If retained, note that product linking may require manual image upload (no bulk image import from WooCommerce in repo).
- **Product photos:** Multiple uploads or single product image are supported; images can be stored encrypted depending on configuration.
- **Allergen field:** Not present in the current product schema in code. If the product spec requires an allergen field, add it as a requirement and specify that it must include a "No Allergy" / "None" option.
- **Product Type dropdown must include:** Nutrition and Vitamins in addition to existing skincare categories. This is implemented in the code (e.g. `routineTypes.ts`, `AddProductModal.tsx`).
- **Professionals recommend products** to clients by linking products to routine steps when building or editing routines. Clients see recommended products in My Routine and in their product list.
- **Clients have their own product list** (home-use products). They can add products manually or use AI Photo Scan to add products. This list is for tracking and recommendations, not in-app purchase.
- **Copy for Professional Products page:** e.g. "How it works: Build your product list fast. Scan, add, or import — then find products by brand, category, or ingredient in seconds."
- **Copy for Client Products page:** e.g. "How it works: Add the products you use at home. Use AI Photo Scan or Add Product, then search by name or category anytime."

---

### 6.4 Treatment Plans

- **Professionals create detailed treatment plans** per client. Plans include title, description, goals, start/end date, milestones, appointments, linked products and routines, and PDF attachments.
- **Plans save in real time** (or on blur/submit depending on the UI); no separate manual "Save" button is required for core fields in the current implementation.
- **Appointments within a plan** have a **Mark Complete** option. When marked complete, the appointment no longer shows as overdue or non-compliant. This is implemented in the treatment plan detail UI (toggle `completed` on appointments).
- **'Schedule Follow-Up' button within Treatment Plans:** Can link to the provider’s external booking (e.g. Agentli/GoHighLevel) booking calendar URL when configured. Video check-ins are handled externally (e.g. via Agentli); SkinAura PRO surfaces the CTA and tracks status only — no Zoom SDK or video hosting in-app.

---

### 6.5 Client Intake Forms (JotForm Integration)

- **JotForm is the selected form platform:** Described as HIPAA-compliant for intake and sensitive data.
- **Form automatically opens for client** upon accepting a professional’s invitation (or is linked from the client profile). The client can complete the form in that flow.
- **Completed form data routes** to the professional’s client profile. Data is not emailed in clear text; the professional logs in to view responses, which supports HIPAA compliance.
- **Professional receives email notification** prompting them to check the new or updated profile in SkinAura PRO.
- **Completed form responses are accessible** within the client’s profile on the professional side (e.g. via JotForm webhook and in-app record so the professional sees submissions in context).

---

### 6.6 Resources / PDF Uploads

- **Professionals can upload PDFs** and educational documents via the PDF Upload area. Uploads are stored in `professional_pdf_uploads`.
- **Resources are attached to treatment plans** in the current implementation. PDFs are linked to plans via `treatment_plan_pdfs`; there is no separate "assign to a specific client" or "assign to a routine" in code — only attachment to a treatment plan. Update the spec to state that PDFs are attached to treatment plans and clients access them from their Treatment Plans section.
- **Clients can view and download** assigned resources (PDFs) within their portal under Treatment Plans for the relevant plan.
- **Professional dashboard** shows which resources (PDFs) are attached to which treatment plans and clients through the plan detail view.

---

### 6.7 Notifications

- **In-app notification bell** in the Professional dashboard header; **Notifications** sidebar is accessible from the left nav. Professionals can see unread count and open the list.
- **Professional is notified when:** a client sends a note, a new client registers (e.g. after accepting an invite), a client accepts an invitation, or a client submits a scan report (marks a FaceAge analysis as sent). Notifications are in-app; email may also be sent for key events (e.g. new client, form submission).
- **HIPAA compliance:** A 10-minute inactivity auto-logout is implemented for both Professional and Client apps. After 10 minutes of no activity (mouse, keyboard, scroll, etc.), the user is logged out and redirected to the landing page with a session-expired message. This reduces the risk of unattended sessions exposing PHI.

---

### 6.8 Admin Panel

- **Mockup admin credentials** can be established during development for testing the admin experience.
- **Admin can create global Routine Templates** via the admin Routine Templates area (`template_routine_templates`).
- **Admin can view all users and professionals** platform-wide (e.g. users tab with role and profile info). Admin cannot see user passwords; auth is custom and passwords are stored only in the application database.
- **Admin can assist with manual account setup** for edge cases (e.g. onboarding support). This is done via database or support tooling, not "in Supabase" Auth — PRO uses PostgreSQL and custom auth.
- **Logo branding** appears in professional invitation emails when the professional has uploaded a logo (e.g. custom logo from Upload Logo); otherwise a default may be used.

---

### 6.9 Professional Profile & Onboarding

- **Profile includes:** name, photo, practice details (e.g. business name), and contact-related fields as configured.
- **Two credential fields added:** (1) Esthetics License Number, (2) NCEA Certified Profile Number. Both are optional in the schema (e.g. `license_number`, `ncea_certified_profile_number` in `user_profiles`); not required for signup or daily use.
- **First-login welcome video:** Plays on first Professional login; video is hosted externally and linked in-app.
- **Onboarding guide / Quick Start** is accessible from the left navigation (labeled **Onboarding** or **Quick Start**). It walks the professional through initial setup (e.g. profile, clients, routines, product library).
- **Onboarding documentation** may be hosted at onboard.skinaura.pro and linked from the FAQ or Help section; keep as documented if that is your deployment.
- **First-time user modal** for both client and professional flows can point users to the Guide or Onboarding section so new users know where to start; document as implemented if present in the UI.

---

## 7. Frontend Routes (Exact)

| Path | Purpose |
|------|--------|
| `/` | Landing |
| `/confirm-email` | Email confirmation |
| `/reset-password` | Password reset |
| `/client-confirm` | Client invitation confirmation |
| `/privacy`, `/terms` | Privacy Policy, Terms and Conditions |
| `/complete-client-profile` | Complete profile (invited clients) |
| `/admin` | Admin app (single route; tabs inside) |
| `/client` | Redirects to `/client/dashboard` |
| `/client/submitting` | Client submission (e.g. consultation) |
| `/client/:section` | Client app; `section` = one of the client nav IDs below |
| `/professional` | Redirects to `/professional/dashboard` |
| `/professional/:section` | Professional app; `section` = one of the professional nav IDs below |

---

## 8. Professional App – Section IDs (Nav)

These are the **exact** section IDs used in the URL (`/professional/:section`) and in code. Use these in the spec.

| Section ID | Label (UI) |
|------------|------------|
| `dashboard` | Dashboard |
| `onboarding` | Onboarding |
| `clients` | My Clients |
| `photos` | Client Photos |
| `facial-scan-reports` | Facial Scan |
| `routines` | Manage Routines |
| `treatments` | Treatment Plans |
| `analytics` | Analytics |
| `products` | Product Library |
| `consult` | Virtual Consult |
| `upload-logo` | Upload Logo |
| `pdf-upload` | PDF Upload |
| `notifications` | Notifications |
| `help` | Help & FAQ |

---

## 9. Client App – Section IDs (Nav)

Use these **exact** section IDs for the client app.

| Section ID | Label (UI) |
|------------|------------|
| `dashboard` | Dashboard |
| `guide` | Guide |
| `routine` | My Routine |
| `products` | My Products |
| `photos` | Progress Photos |
| `face-analysis` | Face Analysis |
| `treatments` | Treatment Plans |
| `notifications` | Notifications |
| `achievements` | Achievements |
| `leaderboard` | Leaderboard |
| `help` | Help & FAQ |

---

## 10. Admin App – Tabs

Admin is a single route with tabs. Tab types in code: **overview**, **users**, **products**, **routines**, **progress-photos**, **audit-logs**. (Routine templates are part of routines management.)

---

## 11. Main Backend API Mounts

All API routes are under **`/api`** with rate limiting. Optional request decryption via `decryptRequestMiddleware` (payloads with `data`, `iv`, `timestamp`).

| Mount | Purpose |
|-------|--------|
| `/api/auth` | Signup, signin (client/professional/admin), verification, password reset, profile, invitations |
| `/api/images` | Image upload/serve (avatars, products, photos, treatments, logos) |
| `/api/professional` | Dashboard, clients, notifications, chat, client photos, facial scan reports, routines, treatment plans, analytics, products, Shopify, logo/PDFs, template routines, step–product linking, etc. |
| `/api/client` | Gamification, routines/completions, notifications, invitations, chat, products, progress photos, treatment plans, skin/face analysis, achievements, leaderboard |
| `/api/routines` | CRUD routines, steps, assignments |
| `/api/treatment-plans` | CRUD plans, milestones, products, routines, appointments, PDFs |
| `/api/products` | Product CRUD, upload-image, bulk-import |
| `/api/ai` | Product recognition (e.g. `POST /api/ai/product-recognition`) |
| `/api/admin` | Overview, users, products, routines, template routines, progress photos, audit logs, locked accounts |
| `/api/webhooks/jotform` | JotForm webhook |
| `/health` | Health check (not under `/api`) |

---

## 12. Main Data Entities (As in Code)

- **User**: `auth` + `user_profiles` (email, full_name, phone, role, avatar_url, skin_type, concerns, business_name, etc.).
- **Product**: `products` (professional library); `client_products` (client’s products); no Order/purchase entity.
- **Routine**: `routine_templates`, `routine_steps`, `routine_step_products`, `client_routine_assignments`, `routine_completions`, `routine_step_completions`; admin: `template_routine_templates`, `template_routine_steps`.
- **Treatment plan**: `treatment_plans`, milestones, products, routines, appointments, PDFs.
- **Progress photo**: `progress_photos`, `photo_comments`, `photo_annotations`.
- **Consultation**: No single table; use “consultation flow” (submit-consultation + JotForm webhook).
- **Notification / chat**: `notification`, `professional_invitation_notifications`; conversations/messages between professional and client.
- **Gamification**: `user_gamification`, `user_badges` (points, levels, streaks, badges, leaderboard).
- **Skin / facial**: `client_skin_analysis`, `skin_analysis` (face-age/facial scan).

---

## 13. Tech Stack (Verified)

**Backend**

- Node, Express 4.x, TypeScript.
- PostgreSQL (`pg`); no ORM (raw queries via `config/database.ts`).
- Auth: custom (bcrypt, JWT-style tokens in `lib/auth.ts`).
- Email: Mailgun. File upload: multer; encrypted image storage.
- Security: helmet, cors, express-rate-limit, optional request decryption, account lockout, audit logging.

**Frontend**

- Vite 7, React 18, TypeScript, react-router-dom 6.
- UI: Radix UI, Tailwind, tailwindcss-animate, cva, clsx, tailwind-merge, lucide-react, recharts, sonner.
- Data: TanStack React Query. Forms: react-hook-form, @hookform/resolvers, zod.
- Auth: custom (authStorage, apiClient with Bearer); Supabase client used in frontend (e.g. storage) only.
- Other: jspdf, marked, highlight.js, date-fns, uuid, face-age, @vladmandic/face-api.

---

## 14. Optional Spec Add-Ons

- **Encryption**: Document which APIs support encrypted request bodies (e.g. `X-Encrypted` and payload shape).
- **Routine terminology**: In the spec, clearly separate “professional routine template”, “client routine assignment”, and “admin template routine”.
- **Consultation**: Describe as “Virtual Consult” (professional) and “submit consultation” (client) + JotForm integration, not as a single “Consultation” entity.

---

## 15. Security & Compliance (Code-Aligned)

Use this to correct **Section 5 (Security & Compliance)** of your spec doc. Structure matches your doc; content is aligned to the codebase.

- **HIPAA-compliant architecture:** 10-minute session timeout for inactive users (Professional and Client apps; `INACTIVITY_TIMEOUT_MS` in `authStorage.ts`).
- **Tenant isolation:** Row-level access — professional queries are filtered by **professional_id** (the professional's user id). There is no `practice_id` in the codebase; tenancy is enforced via `client_professional_relationships` and all professional-scoped queries use `professional_id`. Update the spec to say "professional_id" not "practice_id."
- **Biometric data (facial scan):** Client voluntary submit creates a consent record (BIPA compliance). The client marks a scan as "sent" (PATCH `faceage-analysis/:id/sent`); the professional sees it in the Facial Scan section. Implemented.
- **Client data not emailed in cleartext** — professionals log in to view intake/scan data. Form and scan data are accessed in-app.
- **SMS consent copy (approved):** The app uses **SimpleTexting** for SMS, not Twilio. Use this wording (or adapt for your provider): "By checking this box, I agree to receive informational/transactional SMS text messages from SkinAura PRO in regards to product usage reminders and general customer inquiries, at the phone number provided. Message & data rates may apply. Message frequency varies. Reply STOP to opt out. See our Privacy Policy."
- **NDA executed** between founder and developer at project start — keep as documented if accurate.

---

## 16. Open Questions & Pending Decisions (Code-Aligned)

Use this to correct **Section 6 (Open Questions & Pending Decisions)** of your spec doc. Same table structure; status updated where the codebase has resolved an item.

| Open Question | Context | Status |
|---------------|---------|--------|
| System documentation of all platforms/logins | Requested 3/5/26 to support sales automation setup | In Progress |
| GHL (GoHighLevel) CRM automation setup | Separate team handling GHL; Judson needs coordination with them via Asana | In Progress |
| **Client scan report sharing to Professional** | **Implemented.** Professional-side section: Facial Scan (`facial-scan-reports`). Voluntary submit button for client consent (BIPA). Client marks analysis as "sent"; professional sees in Facial Scan. | **Decided** |
| Payment/subscription integration in PRO app | Payment handled on skinaura.ai (Stripe). PRO is app-only; no payment UI in PRO. | Decided |
| Welcome video link for Professional first login | Founder to record welcome video; dev will implement modal trigger | In Progress |
| NCEA partnership — 3 AI + Esthetics courses | NCEA (14,000 estheticians) to certify SkinAura PRO as vendor; courses required first | In Progress |

**Spec doc correction:** In your Open Questions table, change the row "Client scan report sharing to Professional" from **Not Started** to **Decided** (or **Implemented**). The feature is live in code.

---

## Next steps

1. Open your `SkinAura_PRO_Product_Spec.docx` and copy the **Project Overview** from **Section 1** and apply the corrections in **Section 2**.
2. Update **Section 2 (Platform Architecture & Tech Stack)** in your spec using **Section 3** of this doc (database/auth, Supabase, SimpleTexting vs Twilio, WooCommerce).
3. Update **Section 3 (User Roles & Access)** in your spec using **Section 5** of this doc (tenant model; admin accounts not "in Supabase").
4. Update **Section 4 (Core Features & Functional Requirements)** in your spec using **Section 6** of this doc (routine types no Monthly, scan share implemented, PDFs treatment-plan-only, 10-min logout, etc.).
5. Align all route and section names with **Sections 8–10**.
6. Replace any “Order” or e-commerce wording with “product recommendations / linking” (no in-app purchase).
7. Update tech stack and entity list to match **Sections 12–13**.
8. Update **Section 5 (Security & Compliance)** and **Section 6 (Open Questions)** in your spec using **Sections 15–16** of this doc (professional_id not practice_id; SimpleTexting not Twilio; Client scan sharing = Decided).
9. Keep this file in the repo and update it when the codebase changes so the spec stays in sync.
