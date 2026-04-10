CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "pipeline_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL UNIQUE,
  "source_tool" text NOT NULL,
  "repository" text NOT NULL,
  "commit_sha" text NOT NULL,
  "branch" text NOT NULL,
  "failure_type" text NOT NULL,
  "raw_logs_ref" text NOT NULL,
  "metadata" jsonb NOT NULL,
  "timestamp" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "agent_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "finding_id" uuid NOT NULL UNIQUE,
  "event_id" uuid NOT NULL,
  "agent_id" text NOT NULL,
  "hypothesis" text NOT NULL,
  "evidence" jsonb NOT NULL,
  "confidence" numeric(4, 3) NOT NULL,
  "proposed_remediation" text NOT NULL,
  "created_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "challenge_id" uuid NOT NULL UNIQUE,
  "event_id" uuid NOT NULL,
  "challenger_agent_id" text NOT NULL,
  "target_agent_id" text NOT NULL,
  "counter_hypothesis" text NOT NULL,
  "evidence" jsonb NOT NULL,
  "confidence" numeric(4, 3) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "rebuttals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rebuttal_id" uuid NOT NULL UNIQUE,
  "challenge_id" uuid NOT NULL,
  "responding_agent_id" text NOT NULL,
  "position" text NOT NULL,
  "updated_confidence" numeric(4, 3) NOT NULL,
  "rebuttal_factor" numeric(4, 2) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "decision_id" uuid NOT NULL UNIQUE,
  "event_id" uuid NOT NULL,
  "composite_score" numeric(5, 4) NOT NULL,
  "risk_tier" text NOT NULL,
  "reasoning" text NOT NULL,
  "recommended_action" text NOT NULL,
  "agent_weights" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "approval_id" uuid NOT NULL UNIQUE,
  "decision_id" uuid NOT NULL,
  "approver_id" text NOT NULL,
  "action" text NOT NULL,
  "justification" text NOT NULL,
  "created_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_id" uuid NOT NULL UNIQUE,
  "event_id" uuid NOT NULL,
  "step_type" text NOT NULL,
  "actor" text NOT NULL,
  "payload" jsonb NOT NULL,
  "timestamp" timestamptz NOT NULL
);

CREATE OR REPLACE FUNCTION deny_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "audit_log";
DROP TRIGGER IF EXISTS audit_log_no_delete ON "audit_log";

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON "audit_log"
FOR EACH ROW EXECUTE FUNCTION deny_audit_log_mutation();

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON "audit_log"
FOR EACH ROW EXECUTE FUNCTION deny_audit_log_mutation();
