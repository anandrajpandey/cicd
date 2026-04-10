import { customType, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

type AppendOnlyAuditPayload = unknown;
type AuditUpdateAttempt = {
  __auditMutationOperation: "update";
};

export const assertAuditPayloadInsertOnly = (
  value: AppendOnlyAuditPayload | AuditUpdateAttempt
): AppendOnlyAuditPayload => {
  if (
    typeof value === "object" &&
    value !== null &&
    "__auditMutationOperation" in value &&
    value.__auditMutationOperation === "update"
  ) {
    throw new Error("audit_log is append-only; update operations are forbidden.");
  }

  return value;
};

export const appendOnlyAuditPayloadType = customType<{
  data: AppendOnlyAuditPayload | AuditUpdateAttempt;
  driverData: unknown;
}>({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    return assertAuditPayloadInsertOnly(value);
  }
});

export const createAuditUpdateAttempt = (): AuditUpdateAttempt => ({
  __auditMutationOperation: "update"
});

export const pipelineEventsTable = pgTable("pipeline_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").notNull().unique(),
  sourceTool: text("source_tool").notNull(),
  repository: text("repository").notNull(),
  commitSha: text("commit_sha").notNull(),
  branch: text("branch").notNull(),
  failureType: text("failure_type").notNull(),
  rawLogsRef: text("raw_logs_ref").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const agentFindingsTable = pgTable("agent_findings", {
  id: uuid("id").defaultRandom().primaryKey(),
  findingId: uuid("finding_id").notNull().unique(),
  eventId: uuid("event_id").notNull(),
  agentId: text("agent_id").notNull(),
  hypothesis: text("hypothesis").notNull(),
  evidence: jsonb("evidence").$type<string[]>().notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
  proposedRemediation: text("proposed_remediation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const challengesTable = pgTable("challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  challengeId: uuid("challenge_id").notNull().unique(),
  eventId: uuid("event_id").notNull(),
  challengerAgentId: text("challenger_agent_id").notNull(),
  targetAgentId: text("target_agent_id").notNull(),
  counterHypothesis: text("counter_hypothesis").notNull(),
  evidence: jsonb("evidence").$type<string[]>().notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const rebuttalsTable = pgTable("rebuttals", {
  id: uuid("id").defaultRandom().primaryKey(),
  rebuttalId: uuid("rebuttal_id").notNull().unique(),
  challengeId: uuid("challenge_id").notNull(),
  respondingAgentId: text("responding_agent_id").notNull(),
  position: text("position").notNull(),
  updatedConfidence: numeric("updated_confidence", { precision: 4, scale: 3 }).notNull(),
  rebuttalFactor: numeric("rebuttal_factor", { precision: 4, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const decisionsTable = pgTable("decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  decisionId: uuid("decision_id").notNull().unique(),
  eventId: uuid("event_id").notNull(),
  compositeScore: numeric("composite_score", { precision: 5, scale: 4 }).notNull(),
  riskTier: text("risk_tier").notNull(),
  reasoning: text("reasoning").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  agentWeights: jsonb("agent_weights").$type<Record<string, number>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const approvalsTable = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  approvalId: uuid("approval_id").notNull().unique(),
  decisionId: uuid("decision_id").notNull(),
  approverId: text("approver_id").notNull(),
  action: text("action").notNull(),
  justification: text("justification").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const auditLogTable = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  entryId: uuid("entry_id").notNull().unique(),
  eventId: uuid("event_id").notNull(),
  stepType: text("step_type").notNull(),
  actor: text("actor").notNull(),
  payload: appendOnlyAuditPayloadType("payload").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull()
});
