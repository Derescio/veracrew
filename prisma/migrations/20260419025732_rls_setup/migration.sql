-- Partial unique index: only one pending invite per email per org
CREATE UNIQUE INDEX invite_pending_unique
ON "Invite" ("organizationId", "email")
WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

-- ─── Row Level Security setup ─────────────────────────────────────────────────
-- All tenant-scoped tables: only rows whose organizationId matches the
-- session-local setting app.current_org_id are visible. Tables without an
-- organizationId column are protected via their parent table's RLS cascade.

-- Organization (uses id, not organizationId)
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_tenant_isolation ON "Organization"
  USING (id = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK (id = current_setting('app.current_org_id', TRUE)::text);

-- Membership
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_tenant_isolation ON "Membership"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- Invite
ALTER TABLE "Invite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invite" FORCE ROW LEVEL SECURITY;
CREATE POLICY invite_tenant_isolation ON "Invite"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- JobRole
ALTER TABLE "JobRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobRole" FORCE ROW LEVEL SECURITY;
CREATE POLICY jobrole_tenant_isolation ON "JobRole"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- Location
ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location" FORCE ROW LEVEL SECURITY;
CREATE POLICY location_tenant_isolation ON "Location"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- Shift
ALTER TABLE "Shift" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shift" FORCE ROW LEVEL SECURITY;
CREATE POLICY shift_tenant_isolation ON "Shift"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- ShiftAssignment
ALTER TABLE "ShiftAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY shiftassignment_tenant_isolation ON "ShiftAssignment"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- Team
ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" FORCE ROW LEVEL SECURITY;
CREATE POLICY team_tenant_isolation ON "Team"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- TeamMember
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamMember" FORCE ROW LEVEL SECURITY;
CREATE POLICY teammember_tenant_isolation ON "TeamMember"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- Client
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" FORCE ROW LEVEL SECURITY;
CREATE POLICY client_tenant_isolation ON "Client"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- Project
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" FORCE ROW LEVEL SECURITY;
CREATE POLICY project_tenant_isolation ON "Project"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- Job
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" FORCE ROW LEVEL SECURITY;
CREATE POLICY job_tenant_isolation ON "Job"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- JobAssignment
ALTER TABLE "JobAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobAssignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY jobassignment_tenant_isolation ON "JobAssignment"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- JobActivity
ALTER TABLE "JobActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobActivity" FORCE ROW LEVEL SECURITY;
CREATE POLICY jobactivity_tenant_isolation ON "JobActivity"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- DocumentTemplate
ALTER TABLE "DocumentTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY documenttemplate_tenant_isolation ON "DocumentTemplate"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- UserDocument
ALTER TABLE "UserDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserDocument" FORCE ROW LEVEL SECURITY;
CREATE POLICY userdocument_tenant_isolation ON "UserDocument"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- JobRequiredDocument
ALTER TABLE "JobRequiredDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobRequiredDocument" FORCE ROW LEVEL SECURITY;
CREATE POLICY jobrequireddocument_tenant_isolation ON "JobRequiredDocument"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- TimeEntry
ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY timeentry_tenant_isolation ON "TimeEntry"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- PayRule
ALTER TABLE "PayRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayRule" FORCE ROW LEVEL SECURITY;
CREATE POLICY payrule_tenant_isolation ON "PayRule"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- Holiday
ALTER TABLE "Holiday" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Holiday" FORCE ROW LEVEL SECURITY;
CREATE POLICY holiday_tenant_isolation ON "Holiday"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- PayrollExport
ALTER TABLE "PayrollExport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollExport" FORCE ROW LEVEL SECURITY;
CREATE POLICY payrollexport_tenant_isolation ON "PayrollExport"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- TimeOffRequest
ALTER TABLE "TimeOffRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeOffRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY timeoffrequest_tenant_isolation ON "TimeOffRequest"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- Invoice
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_tenant_isolation ON "Invoice"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- OrgSubscription
ALTER TABLE "OrgSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrgSubscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY orgsubscription_tenant_isolation ON "OrgSubscription"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- ActivityEvent
ALTER TABLE "ActivityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY activityevent_tenant_isolation ON "ActivityEvent"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- Notification
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_tenant_isolation ON "Notification"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- MessageThread
ALTER TABLE "MessageThread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageThread" FORCE ROW LEVEL SECURITY;
CREATE POLICY messagethread_tenant_isolation ON "MessageThread"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);

-- AuditEvent
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY auditevent_tenant_isolation ON "AuditEvent"
  USING ("organizationId" = current_setting('app.current_org_id', TRUE)::text)
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', TRUE)::text);
