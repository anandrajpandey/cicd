import { randomUUID } from "node:crypto";

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

export type OrchestratorDependencies = {
  agents: Record<SpecialistAgentId, AgentClient>;
  judge: JudgeClient;
  notifications: NotificationClient;
  remediation: RemediationClient;
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

export const enrichPipelineEvent = async (event: PipelineEvent): Promise<EnrichedPipelineEvent> => {
  // TODO: replace placeholder enrichment with GitHub, Jenkins, CloudWatch, and X-Ray integrations.
  return enrichedPipelineEventSchema.parse({
    ...event,
    context: {
      gitDiff: `diff --git a/${event.repository} b/${event.repository}`,
      jenkinsLogLines: [`Build failed for ${event.repository}`],
      changedFiles: ["package.json", "src/index.ts"],
      touchedFiles: ["package.json", "src/index.ts"],
      failingTests: [],
      dependencies: [],
      rawLogExcerpt: `Failure type: ${event.failureType}`
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

export const orchestrateIncident = async (
  event: PipelineEvent,
  dependencies: OrchestratorDependencies
): Promise<OrchestrationResult> => {
  const enrichedEvent = await enrichPipelineEvent(event);
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

  return {
    enrichedEvent,
    findings,
    challenges,
    rebuttals,
    decision,
    routing
  };
};
