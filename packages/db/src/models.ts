import { desc, eq, sql } from "drizzle-orm";

import type {
  AgentFinding,
  Approval,
  AuditEntry,
  Challenge,
  Decision,
  PipelineEvent,
  Rebuttal
} from "../../shared-types/dist/index.js";

import type { DatabaseClient } from "./client.js";
import {
  agentFindingsTable,
  approvalsTable,
  auditLogTable,
  challengesTable,
  decisionsTable,
  pipelineEventsTable,
  repositoriesTable,
  rebuttalsTable
} from "./schema.js";

const numericToNumber = (value: string | number | null | undefined): number => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number.parseFloat(value);
  }

  return 0;
};

export type IncidentListItem = {
  id: string;
  repository: string;
  riskTier: "LOW" | "MEDIUM" | "HIGH";
  failureType: string;
  updatedAt: string;
  summary: string;
};

export type IncidentDetail = IncidentListItem & {
  commitSha: string;
  branch: string;
  rawLogsRef: string;
  findings: Array<{
    agentId: string;
    hypothesis: string;
    confidence: number;
    evidence: string[];
    proposedRemediation: string;
  }>;
  decision: {
    compositeScore: number;
    reasoning: string;
    recommendedAction: string;
  } | null;
};

export type ApprovalListItem = {
  id: string;
  incidentId: string;
  repository: string;
  riskTier: "LOW" | "MEDIUM" | "HIGH";
  slaMinutesRemaining: number;
};

export type ApprovalDetail = ApprovalListItem & {
  decisionReasoning: string;
  recommendedAction: string;
};

export type AnalyticsSnapshot = {
  healthScore: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  agentAccuracy: {
    build: number;
    code: number;
    test: number;
    dependency: number;
  };
  slaCompliance: number;
};

export type ConnectedRepository = {
  id: string;
  provider: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  isActive: boolean;
  lastSyncedAt: string;
};

export const persistPipelineEvent = async (client: DatabaseClient, event: PipelineEvent): Promise<void> => {
  await client.db
    .insert(pipelineEventsTable)
    .values({
      eventId: event.eventId,
      sourceTool: event.sourceTool,
      repository: event.repository,
      commitSha: event.commitSha,
      branch: event.branch,
      failureType: event.failureType,
      rawLogsRef: event.rawLogsRef,
      metadata: event.metadata,
      timestamp: event.timestamp
    })
    .onConflictDoNothing({
      target: pipelineEventsTable.eventId
    });
};

export const persistAgentFindings = async (client: DatabaseClient, findings: AgentFinding[]): Promise<void> => {
  if (findings.length === 0) {
    return;
  }

  await client.db
    .insert(agentFindingsTable)
    .values(
      findings.map((finding) => ({
        findingId: finding.findingId,
        eventId: finding.eventId,
        agentId: finding.agentId,
        hypothesis: finding.hypothesis,
        evidence: finding.evidence,
        confidence: String(finding.confidence),
        proposedRemediation: finding.proposedRemediation,
        createdAt: finding.createdAt
      }))
    )
    .onConflictDoNothing({
      target: agentFindingsTable.findingId
    });
};

export const persistChallenges = async (
  client: DatabaseClient,
  eventId: string,
  challenges: Challenge[]
): Promise<void> => {
  if (challenges.length === 0) {
    return;
  }

  await client.db
    .insert(challengesTable)
    .values(
      challenges.map((challenge) => ({
        challengeId: challenge.challengeId,
        eventId,
        challengerAgentId: challenge.challengerAgentId,
        targetAgentId: challenge.targetAgentId,
        counterHypothesis: challenge.counterHypothesis,
        evidence: challenge.evidence,
        confidence: String(challenge.confidence)
      }))
    )
    .onConflictDoNothing({
      target: challengesTable.challengeId
    });
};

export const persistRebuttals = async (client: DatabaseClient, rebuttals: Rebuttal[]): Promise<void> => {
  if (rebuttals.length === 0) {
    return;
  }

  await client.db
    .insert(rebuttalsTable)
    .values(
      rebuttals.map((rebuttal) => ({
        rebuttalId: rebuttal.rebuttalId,
        challengeId: rebuttal.challengeId,
        respondingAgentId: rebuttal.respondingAgentId,
        position: rebuttal.position,
        updatedConfidence: String(rebuttal.updatedConfidence),
        rebuttalFactor: String(rebuttal.rebuttalFactor)
      }))
    )
    .onConflictDoNothing({
      target: rebuttalsTable.rebuttalId
    });
};

export const persistDecision = async (client: DatabaseClient, decision: Decision): Promise<void> => {
  await client.db
    .insert(decisionsTable)
    .values({
      decisionId: decision.decisionId,
      eventId: decision.eventId,
      compositeScore: String(decision.compositeScore),
      riskTier: decision.riskTier,
      reasoning: decision.reasoning,
      recommendedAction: decision.recommendedAction,
      agentWeights: decision.agentWeights,
      createdAt: decision.createdAt
    })
    .onConflictDoNothing({
      target: decisionsTable.decisionId
    });
};

export const persistApproval = async (client: DatabaseClient, approval: Approval): Promise<void> => {
  await client.db
    .insert(approvalsTable)
    .values({
      approvalId: approval.approvalId,
      decisionId: approval.decisionId,
      approverId: approval.approverId,
      action: approval.action,
      justification: approval.justification,
      createdAt: approval.createdAt
    })
    .onConflictDoNothing({
      target: approvalsTable.approvalId
    });
};

export const persistAuditEntries = async (client: DatabaseClient, entries: AuditEntry[]): Promise<void> => {
  if (entries.length === 0) {
    return;
  }

  await client.db
    .insert(auditLogTable)
    .values(
      entries.map((entry) => ({
        entryId: entry.entryId,
        eventId: entry.eventId,
        stepType: entry.stepType,
        actor: entry.actor,
        payload: entry.payload,
        timestamp: entry.timestamp
      }))
    )
    .onConflictDoNothing({
      target: auditLogTable.entryId
    });
};

export const listIncidents = async (client: DatabaseClient): Promise<IncidentListItem[]> => {
  const rows = await client.db
    .select({
      eventId: pipelineEventsTable.eventId,
      repository: pipelineEventsTable.repository,
      failureType: pipelineEventsTable.failureType,
      updatedAt: decisionsTable.createdAt,
      riskTier: decisionsTable.riskTier,
      reasoning: decisionsTable.reasoning
    })
    .from(pipelineEventsTable)
    .leftJoin(decisionsTable, eq(decisionsTable.eventId, pipelineEventsTable.eventId))
    .orderBy(desc(decisionsTable.createdAt), desc(pipelineEventsTable.timestamp))
    .limit(50);

  return rows.map((row: (typeof rows)[number]) => ({
    id: row.eventId,
    repository: row.repository,
    riskTier: (row.riskTier ?? "LOW") as "LOW" | "MEDIUM" | "HIGH",
    failureType: row.failureType,
    updatedAt: (row.updatedAt ?? new Date()).toISOString(),
    summary: row.reasoning ?? "Incident received. Awaiting a synthesized decision."
  }));
};

export const getIncidentById = async (
  client: DatabaseClient,
  eventId: string
): Promise<IncidentDetail | null> => {
  const [eventRow] = await client.db
    .select({
      eventId: pipelineEventsTable.eventId,
      repository: pipelineEventsTable.repository,
      failureType: pipelineEventsTable.failureType,
      commitSha: pipelineEventsTable.commitSha,
      branch: pipelineEventsTable.branch,
      rawLogsRef: pipelineEventsTable.rawLogsRef,
      updatedAt: decisionsTable.createdAt,
      riskTier: decisionsTable.riskTier,
      reasoning: decisionsTable.reasoning,
      compositeScore: decisionsTable.compositeScore,
      recommendedAction: decisionsTable.recommendedAction
    })
    .from(pipelineEventsTable)
    .leftJoin(decisionsTable, eq(decisionsTable.eventId, pipelineEventsTable.eventId))
    .where(eq(pipelineEventsTable.eventId, eventId))
    .limit(1);

  if (!eventRow) {
    return null;
  }

  const findings = await client.db
    .select({
      agentId: agentFindingsTable.agentId,
      hypothesis: agentFindingsTable.hypothesis,
      confidence: agentFindingsTable.confidence,
      evidence: agentFindingsTable.evidence,
      proposedRemediation: agentFindingsTable.proposedRemediation
    })
    .from(agentFindingsTable)
    .where(eq(agentFindingsTable.eventId, eventId))
    .orderBy(desc(agentFindingsTable.createdAt));

  return {
    id: eventRow.eventId,
    repository: eventRow.repository,
    riskTier: (eventRow.riskTier ?? "LOW") as "LOW" | "MEDIUM" | "HIGH",
    failureType: eventRow.failureType,
    updatedAt: (eventRow.updatedAt ?? new Date()).toISOString(),
    summary: eventRow.reasoning ?? "Incident received. Awaiting a synthesized decision.",
    commitSha: eventRow.commitSha,
    branch: eventRow.branch,
    rawLogsRef: eventRow.rawLogsRef,
    findings: findings.map((finding: (typeof findings)[number]) => ({
      agentId: finding.agentId,
      hypothesis: finding.hypothesis,
      confidence: numericToNumber(finding.confidence),
      evidence: finding.evidence,
      proposedRemediation: finding.proposedRemediation
    })),
    decision: eventRow.reasoning
      ? {
          compositeScore: numericToNumber(eventRow.compositeScore),
          reasoning: eventRow.reasoning,
          recommendedAction: eventRow.recommendedAction ?? "Awaiting routing"
        }
      : null
  };
};

export const listApprovals = async (client: DatabaseClient): Promise<ApprovalListItem[]> => {
  const rows = await client.db
    .select({
      approvalId: approvalsTable.approvalId,
      eventId: decisionsTable.eventId,
      repository: pipelineEventsTable.repository,
      riskTier: decisionsTable.riskTier,
      createdAt: approvalsTable.createdAt
    })
    .from(approvalsTable)
    .innerJoin(decisionsTable, eq(decisionsTable.decisionId, approvalsTable.decisionId))
    .innerJoin(pipelineEventsTable, eq(pipelineEventsTable.eventId, decisionsTable.eventId))
    .orderBy(desc(approvalsTable.createdAt))
    .limit(50);

  return rows.map((row: (typeof rows)[number]) => ({
    id: row.approvalId,
    incidentId: row.eventId,
    repository: row.repository,
    riskTier: row.riskTier as "LOW" | "MEDIUM" | "HIGH",
    slaMinutesRemaining: Math.max(0, 60 - Math.floor((Date.now() - row.createdAt.getTime()) / 60000))
  }));
};

export const getApprovalById = async (
  client: DatabaseClient,
  approvalId: string
): Promise<ApprovalDetail | null> => {
  const [row] = await client.db
    .select({
      approvalId: approvalsTable.approvalId,
      eventId: decisionsTable.eventId,
      repository: pipelineEventsTable.repository,
      riskTier: decisionsTable.riskTier,
      createdAt: approvalsTable.createdAt,
      reasoning: decisionsTable.reasoning,
      recommendedAction: decisionsTable.recommendedAction
    })
    .from(approvalsTable)
    .innerJoin(decisionsTable, eq(decisionsTable.decisionId, approvalsTable.decisionId))
    .innerJoin(pipelineEventsTable, eq(pipelineEventsTable.eventId, decisionsTable.eventId))
    .where(eq(approvalsTable.approvalId, approvalId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.approvalId,
    incidentId: row.eventId,
    repository: row.repository,
    riskTier: row.riskTier as "LOW" | "MEDIUM" | "HIGH",
    slaMinutesRemaining: Math.max(0, 60 - Math.floor((Date.now() - row.createdAt.getTime()) / 60000)),
    decisionReasoning: row.reasoning,
    recommendedAction: row.recommendedAction
  };
};

export const getAnalyticsSnapshot = async (client: DatabaseClient): Promise<AnalyticsSnapshot> => {
  const [riskDistribution] = await client.db
    .select({
      low: sql<number>`coalesce(sum(case when ${decisionsTable.riskTier} = 'LOW' then 1 else 0 end), 0)`,
      medium: sql<number>`coalesce(sum(case when ${decisionsTable.riskTier} = 'MEDIUM' then 1 else 0 end), 0)`,
      high: sql<number>`coalesce(sum(case when ${decisionsTable.riskTier} = 'HIGH' then 1 else 0 end), 0)`,
      averageScore: sql<number>`coalesce(avg(${decisionsTable.compositeScore}), 0)`
    })
    .from(decisionsTable);

  const [agentAccuracyRow] = await client.db
    .select({
      build: sql<number>`coalesce(avg(case when ${agentFindingsTable.agentId} = 'build_analyzer' then ${agentFindingsTable.confidence}::numeric end), 0)`,
      code: sql<number>`coalesce(avg(case when ${agentFindingsTable.agentId} = 'code_reviewer' then ${agentFindingsTable.confidence}::numeric end), 0)`,
      test: sql<number>`coalesce(avg(case when ${agentFindingsTable.agentId} = 'test_analyzer' then ${agentFindingsTable.confidence}::numeric end), 0)`,
      dependency: sql<number>`coalesce(avg(case when ${agentFindingsTable.agentId} = 'dependency_checker' then ${agentFindingsTable.confidence}::numeric end), 0)`
    })
    .from(agentFindingsTable);

  const [approvalStats] = await client.db
    .select({
      compliance: sql<number>`coalesce(avg(case when ${approvalsTable.createdAt} >= now() - interval '60 minutes' then 1 else 0 end), 1)`
    })
    .from(approvalsTable);

  const averageScore = Number(riskDistribution?.averageScore ?? 0);
  const healthScore = Math.max(0, Math.min(100, Math.round((1 - averageScore) * 100)));

  return {
    healthScore,
    riskDistribution: {
      low: Number(riskDistribution?.low ?? 0),
      medium: Number(riskDistribution?.medium ?? 0),
      high: Number(riskDistribution?.high ?? 0)
    },
    agentAccuracy: {
      build: Number(agentAccuracyRow?.build ?? 0),
      code: Number(agentAccuracyRow?.code ?? 0),
      test: Number(agentAccuracyRow?.test ?? 0),
      dependency: Number(agentAccuracyRow?.dependency ?? 0)
    },
    slaCompliance: Number(approvalStats?.compliance ?? 1)
  };
};

export const listRepositories = async (client: DatabaseClient): Promise<ConnectedRepository[]> => {
  const rows = await client.db
    .select({
      id: repositoriesTable.id,
      provider: repositoriesTable.provider,
      owner: repositoriesTable.owner,
      name: repositoriesTable.name,
      fullName: repositoriesTable.fullName,
      defaultBranch: repositoriesTable.defaultBranch,
      isPrivate: repositoriesTable.isPrivate,
      isActive: repositoriesTable.isActive,
      lastSyncedAt: repositoriesTable.lastSyncedAt
    })
    .from(repositoriesTable)
    .orderBy(desc(repositoriesTable.lastSyncedAt), repositoriesTable.fullName);

  return rows.map((row) => ({
    ...row,
    lastSyncedAt: row.lastSyncedAt.toISOString()
  }));
};

export const getRepositoryByFullName = async (
  client: DatabaseClient,
  fullName: string
): Promise<ConnectedRepository | null> => {
  const [row] = await client.db
    .select({
      id: repositoriesTable.id,
      provider: repositoriesTable.provider,
      owner: repositoriesTable.owner,
      name: repositoriesTable.name,
      fullName: repositoriesTable.fullName,
      defaultBranch: repositoriesTable.defaultBranch,
      isPrivate: repositoriesTable.isPrivate,
      isActive: repositoriesTable.isActive,
      lastSyncedAt: repositoriesTable.lastSyncedAt
    })
    .from(repositoriesTable)
    .where(eq(repositoriesTable.fullName, fullName))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    ...row,
    lastSyncedAt: row.lastSyncedAt.toISOString()
  };
};

export const upsertRepositories = async (
  client: DatabaseClient,
  repositories: Array<{
    provider: string;
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    isPrivate: boolean;
    isActive?: boolean;
    metadata?: Record<string, unknown>;
  }>
): Promise<void> => {
  if (repositories.length === 0) {
    return;
  }

  await client.db
    .insert(repositoriesTable)
    .values(
      repositories.map((repository) => ({
        provider: repository.provider,
        owner: repository.owner,
        name: repository.name,
        fullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
        isPrivate: repository.isPrivate,
        isActive: repository.isActive ?? true,
        metadata: repository.metadata ?? {},
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      }))
    )
    .onConflictDoUpdate({
      target: repositoriesTable.fullName,
      set: {
        provider: sql`excluded.provider`,
        owner: sql`excluded.owner`,
        name: sql`excluded.name`,
        defaultBranch: sql`excluded.default_branch`,
        isPrivate: sql`excluded.is_private`,
        isActive: sql`excluded.is_active`,
        metadata: sql`excluded.metadata`,
        lastSyncedAt: sql`excluded.last_synced_at`,
        updatedAt: sql`excluded.updated_at`
      }
    });
};
