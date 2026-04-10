export { createDatabaseClient } from "./client.js";
export type { DatabaseClient } from "./client.js";
export {
  agentFindingsTable,
  approvalsTable,
  auditLogTable,
  assertAuditPayloadInsertOnly,
  challengesTable,
  createAuditUpdateAttempt,
  decisionsTable,
  pipelineEventsTable,
  repositoriesTable,
  rebuttalsTable
} from "./schema.js";
export {
  getAnalyticsSnapshot,
  getApprovalById,
  getIncidentById,
  getRepositoryByFullName,
  listApprovals,
  listIncidents,
  listRepositories,
  persistAgentFindings,
  persistApproval,
  persistAuditEntries,
  persistChallenges,
  persistDecision,
  persistPipelineEvent,
  persistRebuttals,
  upsertRepositories
} from "./models.js";
export type {
  AnalyticsSnapshot,
  ApprovalDetail,
  ApprovalListItem,
  ConnectedRepository,
  IncidentDetail,
  IncidentListItem
} from "./models.js";
