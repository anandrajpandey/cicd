import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "@packages/db";
import { TOPICS, publishMessage } from "@packages/kafka-client";
import {
  agentFindingSchema,
  challengeSchema,
  decisionSchema,
  pipelineEventSchema,
  rebuttalSchema,
  type AgentFinding,
  type Challenge,
  type Decision,
  type PipelineEvent,
  type Rebuttal
} from "@packages/shared-types";
import { z } from "zod";

const SPECIALIST_AGENT_IDS = [
  "build_analyzer",
  "code_reviewer",
  "test_analyzer",
  "dependency_checker"
] as const;

type SpecialistAgentId = (typeof SPECIALIST_AGENT_IDS)[number];

const enrichedPipelineEventSchema = pipelineEventSchema.extend({
  context: z.record(z.string(), z.unknown()).default({})
});

const synthesizeRequestSchema = z.object({
  event: pipelineEventSchema,
  findings: z.array(agentFindingSchema).min(1),
  rebuttals: z.array(rebuttalSchema).default([]),
  weights: z
    .object({
      build_analyzer: z.number().positive().default(0.3),
      code_reviewer: z.number().positive().default(0.25),
      test_analyzer: z.number().positive().default(0.25),
      dependency_checker: z.number().positive().default(0.2)
    })
    .default({
      build_analyzer: 0.3,
      code_reviewer: 0.25,
      test_analyzer: 0.25,
      dependency_checker: 0.2
    })
});

export type EnrichedPipelineEvent = z.infer<typeof enrichedPipelineEventSchema>;
export type SynthesizeRequest = z.infer<typeof synthesizeRequestSchema>;

type AgentClient = {
  analyze: (event: EnrichedPipelineEvent) => Promise<AgentFinding>;
  challenge: (input: { event: EnrichedPipelineEvent; findings: AgentFinding[] }) => Promise<Challenge[]>;
  rebuttal: (input: {
    event: EnrichedPipelineEvent;
    challenge: Challenge;
    currentFinding?: AgentFinding;
  }) => Promise<Rebuttal>;
};

type JudgeClient = {
  synthesize: (input: SynthesizeRequest) => Promise<Decision>;
};

type EnrichmentClient = {
  fetchGitHubContext: (event: PipelineEvent) => Promise<Record<string, unknown>>;
  fetchJenkinsContext: (event: PipelineEvent) => Promise<Record<string, unknown>>;
};

type NotificationClient = {
  sendSlack: (decision: Decision) => Promise<void>;
  sendPagerDuty: (decision: Decision) => Promise<void>;
  createGitHubIssue: (decision: Decision) => Promise<void>;
};

type RemediationClient = {
  createSkipPullRequest: (event: PipelineEvent, finding: AgentFinding) => Promise<string>;
  createDependencyPinPullRequest: (event: PipelineEvent, finding: AgentFinding) => Promise<string>;
  createLintFixPullRequest: (event: PipelineEvent, finding: AgentFinding) => Promise<string>;
  retryPipeline: (event: PipelineEvent) => Promise<string>;
};

type PersistenceClient = {
  persist: (input: {
    event: PipelineEvent;
    findings: AgentFinding[];
    challenges: Challenge[];
    rebuttals: Rebuttal[];
    decision: Decision;
    routing: OrchestrationResult["routing"];
  }) => Promise<void>;
};

export type OrchestratorDependencies = {
  agents: Record<SpecialistAgentId, AgentClient>;
  judge: JudgeClient;
  notifications: NotificationClient;
  remediation: RemediationClient;
  enrichment?: EnrichmentClient;
  persistence?: PersistenceClient;
  publishEvent?: typeof publishMessage;
};

export type OrchestrationResult = {
  enrichedEvent: EnrichedPipelineEvent;
  findings: AgentFinding[];
  challenges: Challenge[];
  rebuttals: Rebuttal[];
  decision: Decision;
  routing: {
    mode: "AUTO_REMEDIATE" | "APPROVAL_QUEUE" | "ESCALATE";
    remediationResult?: string;
  };
};

const timeoutFinding = (event: PipelineEvent, agentId: SpecialistAgentId): AgentFinding =>
  agentFindingSchema.parse({
    findingId: randomUUID(),
    agentId,
    eventId: event.eventId,
    hypothesis: `${agentId} timed out before completing analysis.`,
    evidence: ["TIMEOUT"],
    confidence: 0,
    proposedRemediation: "Retry the agent analysis request and inspect the raw context manually.",
    createdAt: new Date()
  });

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, fallback: () => T): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallback()), timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const parseRepository = (repository: string): { owner: string; repo: string } | null => {
  const [owner, repo] = repository.split("/");
  return owner && repo ? { owner, repo } : null;
};

const fetchGitHubContext = async (event: PipelineEvent): Promise<Record<string, unknown>> => {
  const parsedRepository = parseRepository(event.repository);

  if (!parsedRepository || !event.commitSha) {
    return {};
  }

  const headers = new Headers({
    accept: "application/vnd.github+json"
  });
  const token =
    typeof event.metadata.githubToken === "string" && event.metadata.githubToken.length > 0
      ? event.metadata.githubToken
      : process.env.GITHUB_TOKEN;

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(
    `https://api.github.com/repos/${parsedRepository.owner}/${parsedRepository.repo}/commits/${event.commitSha}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub commit context with status ${response.status}.`);
  }

  const commit = (await response.json()) as {
    html_url?: string;
    files?: Array<{
      filename: string;
      patch?: string;
      status?: string;
    }>;
  };

  const files = commit.files ?? [];
  const changedFiles = files.map((file: { filename: string }) => file.filename);
  const gitDiff = files
    .map((file: { filename: string; patch?: string; status?: string }) => {
      const patchBody = file.patch ?? `${file.status ?? "modified"} ${file.filename}`;
      return `diff --git a/${file.filename} b/${file.filename}\n${patchBody}`;
    })
    .join("\n\n");

  return {
    gitDiff,
    changedFiles,
    touchedFiles: changedFiles,
    githubCommitUrl: commit.html_url ?? null
  };
};

const fetchJenkinsContext = async (event: PipelineEvent): Promise<Record<string, unknown>> => {
  const looksLikeJenkins =
    event.sourceTool === "jenkins" ||
    event.rawLogsRef.toLowerCase().includes("jenkins") ||
    event.rawLogsRef.toLowerCase().includes("/console");

  if (!looksLikeJenkins) {
    return {};
  }

  const headers = new Headers();
  const user = process.env.JENKINS_USER;
  const token = process.env.JENKINS_TOKEN;

  if (user && token) {
    headers.set("authorization", `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`);
  }

  const response = await fetch(event.rawLogsRef, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch Jenkins logs with status ${response.status}.`);
  }

  const lines = (await response.text())
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(-500);

  return {
    jenkinsLogLines: lines,
    rawLogExcerpt: lines.slice(-25).join("\n")
  };
};

const defaultEnrichmentClient: EnrichmentClient = {
  fetchGitHubContext,
  fetchJenkinsContext
};

export const enrichPipelineEvent = async (
  event: PipelineEvent,
  enrichment: EnrichmentClient = defaultEnrichmentClient
): Promise<EnrichedPipelineEvent> => {
  const [gitHubResult, jenkinsResult] = await Promise.allSettled([
    enrichment.fetchGitHubContext(event),
    enrichment.fetchJenkinsContext(event)
  ]);

  const errors: string[] = [];
  const gitHubContext = gitHubResult.status === "fulfilled" ? gitHubResult.value : {};
  const jenkinsContext = jenkinsResult.status === "fulfilled" ? jenkinsResult.value : {};

  if (gitHubResult.status === "rejected") {
    errors.push(`github:${gitHubResult.reason instanceof Error ? gitHubResult.reason.message : "unknown error"}`);
  }

  if (jenkinsResult.status === "rejected") {
    errors.push(`jenkins:${jenkinsResult.reason instanceof Error ? jenkinsResult.reason.message : "unknown error"}`);
  }

  return enrichedPipelineEventSchema.parse({
    ...event,
    context: {
      gitDiff:
        typeof gitHubContext.gitDiff === "string" && gitHubContext.gitDiff.length > 0
          ? gitHubContext.gitDiff
          : `diff --git a/${event.repository} b/${event.repository}`,
      jenkinsLogLines:
        Array.isArray(jenkinsContext.jenkinsLogLines) && jenkinsContext.jenkinsLogLines.length > 0
          ? jenkinsContext.jenkinsLogLines
          : [`Build failed for ${event.repository}`],
      changedFiles:
        Array.isArray(gitHubContext.changedFiles) && gitHubContext.changedFiles.length > 0
          ? gitHubContext.changedFiles
          : ["package.json", "src/index.ts"],
      touchedFiles:
        Array.isArray(gitHubContext.touchedFiles) && gitHubContext.touchedFiles.length > 0
          ? gitHubContext.touchedFiles
          : ["package.json", "src/index.ts"],
      failingTests: [],
      dependencies: [],
      rawLogExcerpt:
        typeof jenkinsContext.rawLogExcerpt === "string" && jenkinsContext.rawLogExcerpt.length > 0
          ? jenkinsContext.rawLogExcerpt
          : `Failure type: ${event.failureType}`,
      githubCommitUrl: gitHubContext.githubCommitUrl ?? null,
      enrichmentErrors: errors
    }
  });
};

export const dispatchAgentFindings = async (
  event: EnrichedPipelineEvent,
  agents: Record<SpecialistAgentId, AgentClient>
): Promise<AgentFinding[]> => {
  const results = await Promise.all(
    SPECIALIST_AGENT_IDS.map(async (agentId) =>
      withTimeout(agents[agentId].analyze(event), 30_000, () => timeoutFinding(event, agentId))
    )
  );

  return results.map((finding) => agentFindingSchema.parse(finding));
};

export const runDebate = async (
  event: EnrichedPipelineEvent,
  findings: AgentFinding[],
  agents: Record<SpecialistAgentId, AgentClient>
): Promise<{ challenges: Challenge[]; rebuttals: Rebuttal[] }> => {
  const challengesPerAgent = await Promise.all(
    SPECIALIST_AGENT_IDS.map(async (agentId) => agents[agentId].challenge({ event, findings }))
  );

  const challenges = challengesPerAgent
    .flat()
    .map((challenge) => challengeSchema.parse(challenge))
    .filter((challenge) => challenge.evidence.length > 0)
    .filter((challenge): challenge is Challenge & { targetAgentId: SpecialistAgentId } =>
      SPECIALIST_AGENT_IDS.includes(challenge.targetAgentId as SpecialistAgentId)
    );

  const rebuttals = await Promise.all(
    challenges.map(async (challenge) => {
      const currentFinding = findings.find((finding) => finding.agentId === challenge.targetAgentId);
      return withTimeout(
        agents[challenge.targetAgentId].rebuttal({
          event,
          challenge,
          currentFinding
        }),
        20_000,
        () =>
          rebuttalSchema.parse({
            rebuttalId: randomUUID(),
            respondingAgentId: challenge.targetAgentId,
            challengeId: challenge.challengeId,
            position: "CONCEDE",
            updatedConfidence: currentFinding?.confidence ?? 0,
            rebuttalFactor: 0.7
          })
      );
    })
  );

  return {
    challenges,
    rebuttals: rebuttals.map((rebuttal) => rebuttalSchema.parse(rebuttal))
  };
};

export const routeDecision = async (
  event: PipelineEvent,
  decision: Decision,
  findings: AgentFinding[],
  dependencies: OrchestratorDependencies
): Promise<OrchestrationResult["routing"]> => {
  if (decision.riskTier === "LOW") {
    const topFinding = [...findings].sort((left, right) => right.confidence - left.confidence)[0];
    const remediationResult = await executeRemediation(event, topFinding, dependencies.remediation);
    return {
      mode: "AUTO_REMEDIATE",
      remediationResult
    };
  }

  await (dependencies.publishEvent ?? publishMessage)({
    topic: TOPICS.approvalQueue,
    repository: event.repository,
    payload: decision
  });

  if (decision.riskTier === "MEDIUM") {
    await dependencies.notifications.sendSlack(decision);
    return {
      mode: "APPROVAL_QUEUE"
    };
  }

  await Promise.all([
    dependencies.notifications.sendPagerDuty(decision),
    dependencies.notifications.createGitHubIssue(decision)
  ]);

  return {
    mode: "ESCALATE"
  };
};

const executeRemediation = async (
  event: PipelineEvent,
  finding: AgentFinding | undefined,
  remediation: RemediationClient
): Promise<string> => {
  if (!finding) {
    return remediation.retryPipeline(event);
  }

  const hypothesis = `${finding.hypothesis} ${finding.proposedRemediation}`.toLowerCase();

  if (hypothesis.includes("flaky")) {
    return remediation.createSkipPullRequest(event, finding);
  }

  if (hypothesis.includes("dependenc")) {
    return remediation.createDependencyPinPullRequest(event, finding);
  }

  if (hypothesis.includes("lint") || hypothesis.includes("prettier") || hypothesis.includes("format")) {
    return remediation.createLintFixPullRequest(event, finding);
  }

  return remediation.retryPipeline(event);
};

export const createDatabasePersistence = (
  database: DatabaseClient,
  helpers: {
    persistPipelineEvent: typeof import("@packages/db").persistPipelineEvent;
    persistAgentFindings: typeof import("@packages/db").persistAgentFindings;
    persistChallenges: typeof import("@packages/db").persistChallenges;
    persistRebuttals: typeof import("@packages/db").persistRebuttals;
    persistDecision: typeof import("@packages/db").persistDecision;
    persistAuditEntries: typeof import("@packages/db").persistAuditEntries;
  }
): PersistenceClient => ({
  persist: async ({ event, findings, challenges, rebuttals, decision, routing }) => {
    await helpers.persistPipelineEvent(database, event);
    await helpers.persistAgentFindings(database, findings);
    await helpers.persistChallenges(database, event.eventId, challenges);
    await helpers.persistRebuttals(database, rebuttals);
    await helpers.persistDecision(database, decision);
    await helpers.persistAuditEntries(database, [
      {
        entryId: randomUUID(),
        eventId: event.eventId,
        stepType: "event.received",
        actor: "orchestrator",
        payload: {
          sourceTool: event.sourceTool,
          repository: event.repository
        },
        timestamp: new Date()
      },
      ...findings.map((finding) => ({
        entryId: randomUUID(),
        eventId: event.eventId,
        stepType: "finding.submitted",
        actor: finding.agentId,
        payload: finding,
        timestamp: new Date()
      })),
      ...challenges.map((challenge) => ({
        entryId: randomUUID(),
        eventId: event.eventId,
        stepType: "challenge.issued",
        actor: challenge.challengerAgentId,
        payload: challenge,
        timestamp: new Date()
      })),
      ...rebuttals.map((rebuttal) => ({
        entryId: randomUUID(),
        eventId: event.eventId,
        stepType: "rebuttal.submitted",
        actor: rebuttal.respondingAgentId,
        payload: rebuttal,
        timestamp: new Date()
      })),
      {
        entryId: randomUUID(),
        eventId: event.eventId,
        stepType: "decision.produced",
        actor: "judge",
        payload: decision,
        timestamp: new Date()
      },
      {
        entryId: randomUUID(),
        eventId: event.eventId,
        stepType: routing.mode === "AUTO_REMEDIATE" ? "remediation.executed" : "routing.completed",
        actor: "orchestrator",
        payload: routing,
        timestamp: new Date()
      }
    ]);
  }
});

export const orchestrateIncident = async (
  event: PipelineEvent,
  dependencies: OrchestratorDependencies
): Promise<OrchestrationResult> => {
  const enrichedEvent = await enrichPipelineEvent(event, dependencies.enrichment);
  const findings = await dispatchAgentFindings(enrichedEvent, dependencies.agents);

  await (dependencies.publishEvent ?? publishMessage)({
    topic: TOPICS.agentFindings,
    repository: event.repository,
    payload: findings
  });

  const { challenges, rebuttals } = await runDebate(enrichedEvent, findings, dependencies.agents);

  const decision = decisionSchema.parse(
    await dependencies.judge.synthesize(
      synthesizeRequestSchema.parse({
        event,
        findings,
        rebuttals
      })
    )
  );

  await (dependencies.publishEvent ?? publishMessage)({
    topic: TOPICS.decisions,
    repository: event.repository,
    payload: decision
  });

  const routing = await routeDecision(event, decision, findings, dependencies);

  if (dependencies.persistence) {
    await dependencies.persistence.persist({
      event,
      findings,
      challenges,
      rebuttals,
      decision,
      routing
    });
  }

  return {
    enrichedEvent,
    findings,
    challenges,
    rebuttals,
    decision,
    routing
  };
};
