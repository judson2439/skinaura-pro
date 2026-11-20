#!/usr/bin/env python3
"""Generate SkinAura PRO × Vagaro Workload Scope PDF."""

from pathlib import Path
from fpdf import FPDF

OUT = Path(__file__).resolve().parent / "SkinAura_Vagaro_Workload_Scope.pdf"

# Brand-neutral professional palette
INK = (28, 28, 30)
MUTED = (90, 90, 95)
RULE = (210, 210, 214)
ACCENT = (45, 90, 100)  # restrained teal — not purple
LIGHT = (245, 247, 248)
WHITE = (255, 255, 255)


class WorkloadPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.set_auto_page_break(auto=True, margin=22)
        self.set_margins(18, 18, 18)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 6, "SkinAura PRO  |  Vagaro Integration Workload Scope", align="L")
        self.ln(2)
        self.set_draw_color(*RULE)
        self.set_line_width(0.2)
        self.line(18, self.get_y(), 192, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(*RULE)
        self.line(18, self.get_y(), 192, self.get_y())
        self.ln(3)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 5, f"Page {self.page_no()} of {{nb}}", align="C")

    def body(self, text):
        self.set_x(18)
        self.set_font("Helvetica", "", 9.5)
        self.set_text_color(*INK)
        self.multi_cell(174, 5.2, text)
        self.ln(1.5)

    def muted(self, text):
        self.set_x(18)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*MUTED)
        self.multi_cell(174, 5, text)
        self.ln(1)

    def bullet(self, text, indent=0):
        x0 = 18 + indent
        self.set_x(x0)
        self.set_font("Helvetica", "", 9.5)
        self.set_text_color(*INK)
        bullet_w = 5
        self.cell(bullet_w, 5.2, "-")
        self.multi_cell(174 - indent - bullet_w, 5.2, text)

    def numbered(self, n, text, indent=0):
        x0 = 18 + indent
        self.set_x(x0)
        self.set_font("Helvetica", "", 9.5)
        self.set_text_color(*INK)
        label = f"{n}."
        self.cell(7, 5.2, label)
        self.multi_cell(174 - indent - 7, 5.2, text)

    def h1(self, text):
        self.set_x(18)
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(*INK)
        self.multi_cell(174, 8, text)
        self.ln(2)

    def h2(self, text):
        self.ln(3)
        if self.get_y() > 255:
            self.add_page()
        self.set_x(18)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*ACCENT)
        self.multi_cell(174, 7, text)
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.4)
        self.line(18, self.get_y(), 70, self.get_y())
        self.ln(4)

    def h3(self, text):
        self.ln(1)
        self.set_x(18)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*INK)
        self.multi_cell(174, 6, text)
        self.ln(1)

    def callout(self, title, body):
        self.ln(1)
        x = 18
        start_y = self.get_y()
        pad = 3.5
        self.set_xy(x + pad, start_y + pad)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*ACCENT)
        self.multi_cell(174 - 2 * pad, 5, title)
        self.set_x(x + pad)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*INK)
        self.multi_cell(174 - 2 * pad, 5, body)
        end_y = self.get_y() + pad
        # Fill behind by redrawing: capture content height then paint
        # Simpler approach: draw border only (clean professional look)
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.35)
        self.rect(x, start_y, 174, end_y - start_y)
        # left accent bar
        self.set_fill_color(*ACCENT)
        self.rect(x, start_y, 1.2, end_y - start_y, style="F")
        self.set_y(end_y + 4)

    def table(self, headers, rows, col_widths):
        self.ln(1)
        line_h = 6.5
        usable = sum(col_widths)

        def ensure_space(needed):
            if self.get_y() + needed > 275:
                self.add_page()

        ensure_space(line_h + 8)
        self.set_fill_color(*ACCENT)
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "B", 8.5)
        x = 18
        y = self.get_y()
        for i, h in enumerate(headers):
            self.set_xy(x, y)
            self.cell(col_widths[i], line_h, f"  {h}", border=0, fill=True)
            x += col_widths[i]
        self.set_y(y + line_h)

        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(*INK)
        fill = False
        for row in rows:
            heights = []
            for i, cell in enumerate(row):
                lines = self.multi_cell(
                    col_widths[i] - 4, 4.4, str(cell), dry_run=True, output="LINES"
                )
                heights.append(max(len(lines) * 4.4 + 2.2, line_h))
            rh = max(heights)
            ensure_space(rh)
            y0 = self.get_y()
            x0 = 18
            bg = LIGHT if fill else WHITE
            for i, cell in enumerate(row):
                self.set_fill_color(*bg)
                self.set_xy(x0, y0)
                self.rect(x0, y0, col_widths[i], rh, style="FD")
                self.set_draw_color(*RULE)
                self.set_xy(x0 + 2, y0 + 1.1)
                self.multi_cell(col_widths[i] - 4, 4.4, str(cell))
                x0 += col_widths[i]
            self.set_y(y0 + rh)
            fill = not fill
        self.ln(2.5)

    def kv_row(self, key, value):
        from fpdf.enums import XPos, YPos
        self.set_x(18)
        self.set_font("Helvetica", "B", 9.5)
        self.set_text_color(*MUTED)
        self.cell(42, 6, key, border=0)
        self.set_font("Helvetica", "", 9.5)
        self.set_text_color(*INK)
        self.cell(132, 6, value, border=0, new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def build():
    pdf = WorkloadPDF()
    pdf.alias_nb_pages()
    pdf.add_page()

    # ---- Cover / title ----
    pdf.set_fill_color(*ACCENT)
    pdf.rect(0, 0, 210, 48, style="F")
    pdf.set_xy(18, 14)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*WHITE)
    pdf.cell(174, 5, "SkinAura PRO", align="L")
    pdf.set_xy(18, 22)
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(174, 9, "Vagaro Integration", align="L")
    pdf.set_xy(18, 33)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(174, 7, "Workload Scope of Work", align="L")

    pdf.set_xy(18, 56)
    pdf.set_text_color(*MUTED)
    pdf.set_font("Helvetica", "", 9)
    pdf.kv_row("Document type", "Workload & delivery scope")
    pdf.kv_row("Project", "SkinAura PRO x Vagaro webhook integration")
    pdf.kv_row("Version", "1.0")
    pdf.kv_row("Focus", "Work required to fulfill client requirements (MVP)")
    pdf.ln(2)
    pdf.set_draw_color(*RULE)
    pdf.line(18, pdf.get_y(), 192, pdf.get_y())
    pdf.ln(5)

    pdf.callout(
        "Document purpose",
        "This document describes only the workload required to implement the client's "
        "Vagaro on-site integration requirements. It defines what will be built, how work "
        "is structured, acceptance criteria, and delivery phases. Pricing is excluded.",
    )

    # ---- 1. Overview ----
    pdf.h2("1. Project Overview")
    pdf.body(
        "The client requires SkinAura PRO to connect with Vagaro so that scheduling and "
        "payment activity in Vagaro automatically drives SkinAura's skincare workflow "
        "(scan, plan, track, rebook), without replacing Vagaro as the booking platform."
    )
    pdf.h3("Integration principle")
    pdf.bullet("Vagaro remains the system of record for scheduling and payments.")
    pdf.bullet("SkinAura PRO remains the intelligence and care layer.")
    pdf.bullet("Data flow for MVP is primarily Vagaro to SkinAura via webhooks.")
    pdf.bullet("In-app Vagaro calendar booking or modification is not included in MVP.")

    # ---- 2. Objectives ----
    pdf.h2("2. Workload Objectives")
    pdf.numbered(1, "Eliminate duplicate manual client entry when customers book in Vagaro.")
    pdf.numbered(2, "Automatically surface upcoming Vagaro appointments inside SkinAura PRO.")
    pdf.numbered(3, "Trigger SkinAura workflows (client invite, scan, treatment history) from Vagaro events.")
    pdf.numbered(4, "Provide a rebooking path that returns the customer to the provider's Vagaro booking URL.")
    pdf.numbered(5, "Deliver a reusable product feature under Settings > Integrations > Vagaro, not a one-off custom script.")

    # ---- 3. In scope ----
    pdf.h2("3. In-Scope Workload (MVP)")

    pdf.h3("3.1 Integration settings (Professional UI)")
    pdf.body(
        "Build a Vagaro panel under SkinAura PRO Settings > Integrations with connection "
        "status, location label, last sync time, sync toggles, connect/setup instructions, "
        "verification token entry, public booking URL field, disconnect control, and last-error display."
    )
    pdf.bullet("Sync toggles: Clients, Appointments, Treatments, Transactions (enabled).")
    pdf.bullet("Intake Forms toggle present but disabled / off for MVP.")
    pdf.bullet("Expose webhook URL for the professional to paste into Vagaro.")
    pdf.bullet("Support Vagaro Test Webhook verification for connection health.")

    pdf.h3("3.2 Webhook infrastructure (Backend)")
    pdf.body(
        "Implement a public webhook endpoint that accepts Vagaro POST events, validates "
        "the verification token, identifies the professional tenant, stores the event, and "
        "returns HTTP 2xx within 20 seconds. Processing continues asynchronously."
    )
    pdf.bullet("Endpoint pattern: /api/integrations/vagaro/webhook (final path aligned to API conventions).")
    pdf.bullet("Idempotency using Vagaro webhook event ID (retries must not duplicate records).")
    pdf.bullet("Event queue with statuses: received, processed, failed.")
    pdf.bullet("Respect per-connection sync toggles.")
    pdf.bullet("Structured audit logging with PHI-conscious redaction.")

    pdf.h3("3.3 Data model & identity mapping")
    pdf.body("Create and migrate database structures required for durable sync:")
    pdf.bullet("vagaro_connections (per professional): business/location IDs, token, booking URL, sync flags, health fields.")
    pdf.bullet("vagaro_webhook_events: raw/redacted payload, event type, event ID, status, attempts, errors.")
    pdf.bullet("External ID maps: business, location, customer, employee, appointment, transaction IDs.")
    pdf.bullet("Visit/appointment records linked to SkinAura clients (even when no treatment plan exists yet).")
    pdf.bullet("Client origin marker for Vagaro-sourced records.")

    pdf.h3("3.4 Event processing (MVP subscriptions)")
    pdf.body("Subscribe to and implement handlers for the three highest-value event families:")
    pdf.table(
        ["Vagaro event", "SkinAura workload action"],
        [
            ["Customer created / updated", "Create or update client under the correct professional tenant; upsert by vagaro_customer_id."],
            ["Appointment booked", "Create visit; associate client and provider; notify professional."],
            ["Appointment updated / cancelled", "Update status, time, or cancellation state; retain history."],
            ["Service / treatment booked", "Capture service title/category; tag visit for workflow use."],
            ["Transaction completed", "Store transaction against client lifecycle; link to appointment when available."],
        ],
        [55, 119],
    )

    pdf.h3("3.5 Client matching & invite workflow")
    pdf.numbered(1, "Match by permanent vagaro_customer_id within the professional tenant.")
    pdf.numbered(2, "Fallback to email (case-insensitive), then normalized phone.")
    pdf.numbered(3, "If unmatched: create pending client shell and trigger existing invite flow.")
    pdf.numbered(4, "Existing SkinAura client: attach appointment to treatment / visit history.")
    pdf.numbered(5, "New client: prompt invite to SkinAura consultation / Skin Age scan.")
    pdf.bullet("Enforce strict tenant isolation (Professional A never receives Professional B data).")

    pdf.h3("3.6 Professional in-app experience")
    pdf.bullet("Upcoming Treatment view (dashboard and/or client profile) showing date, service, provider, and Vagaro source.")
    pdf.bullet("Client profile indicators for Vagaro sync and appointment/transaction history.")
    pdf.bullet("In-app notifications for new bookings, cancellations, and new Vagaro clients requiring invite/scan.")
    pdf.bullet("Rebook CTA opening the professional's configured Vagaro booking URL.")
    pdf.bullet("Optional: Treatment Plan follow-up action uses the same Vagaro booking URL when connected.")

    pdf.h3("3.7 Treatments & transactions (MVP depth)")
    pdf.bullet("Treatments: persist service title/category; support simple category tagging (deep auto-plan rules optional later).")
    pdf.bullet("Transactions: persist transaction ID, summary fields provided by Vagaro, timestamps, and client linkage.")
    pdf.bullet("No in-app checkout or e-commerce; display and workflow context only.")

    pdf.h3("3.8 Security, compliance & operations")
    pdf.bullet("Hash or encrypt verification tokens at rest; never return secrets on GET APIs.")
    pdf.bullet("Tenant-scoped queries on every read/write.")
    pdf.bullet("Webhook payload size limits and basic abuse protection.")
    pdf.bullet("No automatic import of Vagaro intake form Q&A / PHI in MVP.")

    pdf.h3("3.9 Documentation & handoff")
    pdf.bullet("Professional setup guide (enable Vagaro API/webhooks, create webhook, token, booking URL, test).")
    pdf.bullet("Internal technical notes (event types, ID maps, idempotency, retry behavior).")
    pdf.bullet("Support runbook for common connection failures.")

    # ---- 4. Out of scope ----
    pdf.h2("4. Out of Scope (MVP)")
    pdf.bullet("Booking or modifying the Vagaro calendar from inside SkinAura PRO.")
    pdf.bullet("Full two-way appointment synchronization.")
    pdf.bullet("Automatic import of Vagaro Form Responses / intake questionnaires.")
    pdf.bullet("Employee roster sync and multi-location synchronization.")
    pdf.bullet("Replacing Agentli, GoHighLevel, JotForm, or other existing integrations.")
    pdf.bullet("Native mobile applications.")
    pdf.bullet("Guaranteed Vagaro write-API capabilities without discovery validation.")

    # ---- 5. Work packages ----
    pdf.h2("5. Work Packages & Effort Structure")
    pdf.body(
        "Workload is organized into sequential packages. Estimated effort is approximately "
        "128 to 196 engineering hours for MVP, typically delivered over 5 to 7 calendar weeks "
        "including Vagaro access lead time."
    )
    pdf.table(
        ["Package", "Workload summary", "Est. hours"],
        [
            ["0. Discovery", "Confirm live webhook payloads, verification method, event names, URL strategy; short design note.", "8-16"],
            ["1A. Data model", "Migrations for connections, events, ID maps, visits, transactions; indexes and helpers.", "8-12"],
            ["1B. Webhook core", "Public endpoint, verification, fast 2xx, queue, idempotency, health updates.", "16-24"],
            ["1C. Customer sync", "Create/update mapper, matching rules, invite linkage, match-case tests.", "12-16"],
            ["1D. Appointment sync", "Booked/updated/cancelled handlers, upcoming appointments API, notifications.", "16-24"],
            ["1E. Transaction sync", "Completed-transaction handler, client linkage, basic history.", "8-12"],
            ["1F. Settings UI", "Integrations > Vagaro panel: connect, disconnect, toggles, token, booking URL, status.", "16-24"],
            ["1G. Workflow UI", "Upcoming treatment views, client Vagaro section, rebook CTA, follow-up link wiring.", "12-16"],
            ["1H. QA & launch", "Test matrix, isolation tests, staging/production deploy, first-client go-live support.", "16-24"],
            ["1I. Documentation", "Professional setup guide and internal support runbook.", "4-8"],
        ],
        [38, 108, 28],
    )

    # ---- 6. Architecture ----
    pdf.h2("6. Technical Workload Architecture")
    pdf.body("Processing pipeline to be implemented:")
    pdf.bullet("Vagaro POSTs selected events to SkinAura webhook URL.")
    pdf.bullet("Endpoint verifies token, identifies business/connection, stores event, returns 2xx.")
    pdf.bullet("Queue deduplicates by Vagaro event ID.")
    pdf.bullet("Mappers upsert customers, appointments, and transactions into SkinAura records.")
    pdf.bullet("UI and notifications surface upcoming care workflow; rebook returns user to Vagaro.")

    pdf.h3("Identifiers retained in SkinAura")
    pdf.bullet("vagaro_business_id, vagaro_location_id, vagaro_customer_id")
    pdf.bullet("vagaro_employee_id, vagaro_appointment_id, vagaro_transaction_id")
    pdf.bullet("Vagaro webhook event ID (idempotency)")

    # ---- 7. Acceptance ----
    pdf.h2("7. Acceptance Criteria")
    pdf.numbered(1, "Professional can connect Vagaro under Settings > Integrations and see status, last sync, and disconnect.")
    pdf.numbered(2, "Customer, appointment, and transaction webhooks are accepted, verified, queued, and processed idempotently.")
    pdf.numbered(3, "New Vagaro customers become SkinAura clients or receive an invite under the correct tenant.")
    pdf.numbered(4, "Upcoming Vagaro appointments appear in SkinAura without manual recreation.")
    pdf.numbered(5, "Appointment updates and cancellations in Vagaro update SkinAura status.")
    pdf.numbered(6, "Rebook CTA opens the configured Vagaro booking URL.")
    pdf.numbered(7, "Duplicate webhook retries do not create duplicate clients or appointments.")
    pdf.numbered(8, "Tenant isolation is verified (no cross-professional data leakage).")
    pdf.numbered(9, "Staging validated with Vagaro Test Webhook and a real/test business.")
    pdf.numbered(10, "Setup guide delivered and first go-live support completed.")

    # ---- 8. Timeline ----
    pdf.h2("8. Delivery Timeline (Workload Phasing)")
    pdf.table(
        ["Week", "Workload milestone"],
        [
            ["Week 1", "Discovery complete; design confirmed; migrations started; Vagaro API/webhook access requested."],
            ["Week 2", "Webhook core and customer sync available on staging."],
            ["Week 3", "Appointment sync and upcoming appointment UI."],
            ["Week 4", "Transaction sync, settings UI, invite and rebook flows."],
            ["Week 5", "End-to-end QA with Test Webhook and test business."],
            ["Week 6", "Production deployment, setup guide, first-client go-live support."],
        ],
        [28, 146],
    )
    pdf.muted(
        "Calendar duration may extend if Vagaro webhook activation requires additional business days "
        "(Vagaro may take up to approximately seven business days after access request)."
    )

    # ---- 9. Dependencies ----
    pdf.h2("9. Dependencies & Responsibilities")
    pdf.h3("Delivery team workload")
    pdf.bullet("Engineering, testing, deployment, documentation, and go-live support.")
    pdf.h3("Client / professional responsibilities (required for completion)")
    pdf.bullet("Active Vagaro account eligible for Webhooks & APIs (not free trial).")
    pdf.bullet("Enable Vagaro Webhooks & APIs subscription and request activation.")
    pdf.bullet("Create webhook in Vagaro, select events and locations, provide verification token.")
    pdf.bullet("Provide public Vagaro booking URL for rebook CTA.")
    pdf.bullet("Perform test bookings during UAT.")

    # ---- 10. Deliverables ----
    pdf.h2("10. Deliverables Checklist")
    items = [
        "Database migrations for Vagaro connection, events, maps, visits, and transactions",
        "Webhook API and asynchronous event processor",
        "Customer, appointment, and transaction sync handlers",
        "Professional Integrations > Vagaro settings UI",
        "Upcoming appointments and rebook CTA in professional experience",
        "Notifications for key Vagaro-driven events",
        "Professional setup guide and internal runbook",
        "Staging and production deployment",
        "First-client go-live support",
    ]
    for item in items:
        pdf.bullet(item)

    # ---- 11. Phase 2 note ----
    pdf.h2("11. Related Work Explicitly Deferred")
    pdf.body(
        "The following items are related to the client's broader Vagaro discussion but are "
        "not part of the MVP workload in this document. They may be scoped separately later:"
    )
    pdf.bullet("Employee / provider synchronization")
    pdf.bullet("Multi-location synchronization and management")
    pdf.bullet("Selective Vagaro intake form field import")
    pdf.bullet("Historical backfill via Vagaro API on first connect")
    pdf.bullet("Advanced treatment-plan automation by service category")

    # ---- Closing ----
    pdf.ln(6)
    pdf.set_draw_color(*RULE)
    pdf.line(18, pdf.get_y(), 192, pdf.get_y())
    pdf.ln(5)
    pdf.set_x(18)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*INK)
    pdf.multi_cell(174, 6, "End of Workload Scope")
    pdf.set_x(18)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        174,
        5,
        "This document is limited to describing the work required to complete the client's "
        "stated Vagaro integration requirements for SkinAura PRO MVP delivery.",
    )

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    build()
