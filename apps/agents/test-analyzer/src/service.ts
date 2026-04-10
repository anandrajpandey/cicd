import { randomUUID } from "node:crypto";

import { chat } from "@packages/llm-client";
import {
  agentFindingSchema,
  type AgentFinding,
  type Challenge,
  type Rebuttal
} from "@packages/shared-types";

import {
  createChallenge,
  createRebuttal,
  type ChallengeRequest,
  type EnrichedPipelineEvent,
  type RebuttalRequest
} from "./schemas.js";

type DetectionType = "flaky_test" | "regression" | "new_failure" | "unknown_test_failure";

type Detection = {
  type: DetectionType;
  evidence: string[];
  hypothesis: string;
  remediation: string;
  baseConfidence: number;
};

const extractEvidence = (event: EnrichedPipelineEvent): string[] => {
  const reportLines = (event.context.rawTestReport ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  const failingTestLines = (event.context.failingTests ?? []).map(
    (test) =>
      `${test.name} failureRate=${test.historicalFailureRate ?? "unknown"} neverFailedBefore=${test.hasNeverFailedBefore ?? false}`
  );

  const rawExcerpt = event.context.rawLogExcerpt ? [event.context.rawLogExcerpt] : [];

  return [...failingTestLines, ...reportLines, ...rawExcerpt];
};

const detectTestIssue = (event: EnrichedPipelineEvent): Detection => {
  const failingTests = event.context.failingTests ?? [];
  const evidence = extractEvidence(event);
  const flaky = failingTests.find((test) => (test.historicalFailureRate ?? 0) > 0.3);

  if (flaky) {
    return {
      type: "flaky_test",
      evidence: [
        `${flaky.name} failureRate=${flaky.historicalFailureRate}`,
        ...evidence.slice(0, 2)
      ].filter(Boolean),
      hypothesis: "The failing test pattern looks flaky because the same test has been failing intermittently in recent runs.",
      remediation: "Quarantine or stabilize the flaky test before treating the incident as a product regression.",
      baseConfidence: 0.62
    };
  }

  const neverFailedBefore = failingTests.find((test) => test.hasNeverFailedBefore);
  if (neverFailedBefore) {
    return {
      type: "new_failure",
      evidence: [
        `${neverFailedBefore.name} neverFailedBefore=true`,
        ...evidence.slice(0, 2)
      ].filter(Boolean),
      hypothesis: "The failing test appears to be a new failure because it has not failed in recent history.",
      remediation: "Inspect the changed code path covered by the test and treat the failure as a likely new defect.",
      baseConfidence: 0.58
    };
  }

  if (failingTests.length > 0) {
    return {
      type: "regression",
      evidence: evidence.slice(0, 3),
      hypothesis: "The failing test set looks like a regression rather than infrastructure noise.",
      remediation: "Review the changed logic and add targeted assertions for the broken behavior before rerunning CI.",
      baseConfidence: 0.54
    };
  }

  return {
    type: "unknown_test_failure",
    evidence: evidence.slice(0, 3),
    hypothesis: "Tests are failing, but the available report data is too sparse for a precise classification.",
    remediation: "Collect the complete test report and compare the current failures against recent build history.",
    baseConfidence: 0.3
  };
};

export const scoreTestConfidence = (event: EnrichedPipelineEvent, detection: Detection): number => {
  let score = detection.baseConfidence;

  if ((event.context.failingTests ?? []).some((test) => test.hasNeverFailedBefore)) {
    score += 0.15;
  }

  if ((event.context.changedLineCoverage ?? 1) < 0.5) {
    score += 0.1;
  }

  return Math.min(1, Number(score.toFixed(2)));
};

const maybeAskLlmForSummary = async (event: EnrichedPipelineEvent, detection: Detection): Promise<string | null> => {
  const evidence = detection.evidence.join("\n") || "No strong test evidence provided.";

  try {
    const response = await chat(
      [
        {
          role: "system",
          content:
            "You summarize CI test failures. Answer in one sentence with clear QA language and no markdown."
        },
        {
          role: "user",
          content: [
            `Repository: ${event.repository}`,
            `Failure type: ${event.failureType}`,
            `Detected class: ${detection.type}`,
            "Evidence:",
            evidence
          ].join("\n")
        }
      ],
      {
        temperature: 0,
        maxTokens: 120,
        timeoutMs: 4_000
      }
    );

    return response.trim() || null;
  } catch {
    return null;
  }
};

export const analyzeTests = async (event: EnrichedPipelineEvent): Promise<AgentFinding> => {
  const detection = detectTestIssue(event);
  const confidence = scoreTestConfidence(event, detection);
  const llmSummary = await maybeAskLlmForSummary(event, detection);

  return agentFindingSchema.parse({
    findingId: randomUUID(),
    agentId: "test_analyzer",
    eventId: event.eventId,
    hypothesis: llmSummary ?? detection.hypothesis,
    evidence:
      detection.evidence.length > 0
        ? detection.evidence
        : ["No high-signal test classification evidence was found in the supplied report."],
    confidence,
    proposedRemediation: detection.remediation,
    createdAt: new Date()
  });
};

export const issueChallenges = async ({ findings }: ChallengeRequest): Promise<Challenge[]> => {
  const testFinding = findings.find((finding) => finding.agentId === "test_analyzer");

  if (!testFinding) {
    return [];
  }

  return findings
    .filter((finding) => finding.agentId !== "test_analyzer")
    .filter((finding) => testFinding.confidence >= finding.confidence)
    .filter((finding) => testFinding.evidence.length > 0)
    .map((finding) =>
      createChallenge({
        challengerAgentId: "test_analyzer",
        targetAgentId: finding.agentId,
        counterHypothesis: `The failing test history more strongly supports a test-level issue than ${finding.agentId}'s hypothesis.`,
        evidence: testFinding.evidence.slice(0, 2),
        confidence: Math.min(1, Number((testFinding.confidence - finding.confidence + 0.55).toFixed(2)))
      })
    );
};

export const createTestRebuttal = async ({
  challenge,
  currentFinding
}: RebuttalRequest): Promise<Rebuttal> => {
  const mentionsTests = /test|coverage|flaky|regression|suite/i.test(challenge.counterHypothesis);
  const position = mentionsTests && currentFinding ? "DEFEND" : "CONCEDE";
  const rebuttalFactor = position === "DEFEND" ? 0.85 : 0.7;
  const baseConfidence = currentFinding?.confidence ?? 0.4;
  const updatedConfidence =
    position === "DEFEND"
      ? Math.max(0, Number((baseConfidence * 0.97).toFixed(2)))
      : Math.max(0, Number((baseConfidence * 0.82).toFixed(2)));

  return createRebuttal({
    respondingAgentId: "test_analyzer",
    challengeId: challenge.challengeId,
    position,
    updatedConfidence,
    rebuttalFactor
  });
};
