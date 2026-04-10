import test from "node:test";
import assert from "node:assert/strict";

import {
  agentFindingSchema,
  approvalSchema,
  auditEntrySchema,
  challengeSchema,
  decisionSchema,
  pipelineEventSchema,
  rebuttalSchema
} from "../dist/index.js";

const sampleId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";

test("pipelineEventSchema coerces timestamps into Date instances", () => {
  const parsed = pipelineEventSchema.parse({
    eventId: sampleId,
    sourceTool: "github_actions",
    repository: "acme/api",
    commitSha: "abc123",
    branch: "main",
    failureType: "test_failure",
    rawLogsRef: "s3://logs/run-1",
    metadata: { runId: 42 },
    timestamp: "2026-04-10T09:00:00.000Z"
  });

  assert.equal(parsed.timestamp instanceof Date, true);
});

test("agentFindingSchema rejects confidence values above 1", () => {
  assert.throws(() =>
    agentFindingSchema.parse({
      findingId: sampleId,
      agentId: "build_analyzer",
      eventId: secondId,
      hypothesis: "Build failed because dependencies are missing.",
      evidence: ["npm ERR! not found"],
      confidence: 1.2,
      proposedRemediation: "Pin the missing package version.",
      createdAt: new Date()
    })
  );
});

test("challenge, rebuttal, decision, approval, and audit schemas parse valid payloads", () => {
  const challenge = challengeSchema.parse({
    challengeId: sampleId,
    challengerAgentId: "code_reviewer",
    targetAgentId: "build_analyzer",
    counterHypothesis: "The failure is caused by unsafe auth changes.",
    evidence: ["auth.ts was modified"],
    confidence: 0.72
  });

  const rebuttal = rebuttalSchema.parse({
    rebuttalId: secondId,
    respondingAgentId: "build_analyzer",
    challengeId: challenge.challengeId,
    position: "DEFEND",
    updatedConfidence: 0.8,
    rebuttalFactor: 0.85
  });

  const decision = decisionSchema.parse({
    decisionId: sampleId,
    eventId: secondId,
    compositeScore: 0.42,
    riskTier: "MEDIUM",
    reasoning: "Build and test signals disagree, so human approval is required.",
    recommendedAction: "Request review from an approver.",
    agentWeights: {
      build: 0.3,
      code: 0.25,
      test: 0.25,
      dependency: 0.2
    },
    createdAt: "2026-04-10T09:30:00.000Z"
  });

  const approval = approvalSchema.parse({
    approvalId: secondId,
    decisionId: decision.decisionId,
    approverId: "user-123",
    action: "APPROVE",
    justification: "The remediation is safe to run.",
    createdAt: "2026-04-10T09:45:00.000Z"
  });

  const audit = auditEntrySchema.parse({
    entryId: sampleId,
    eventId: secondId,
    stepType: "decision.produced",
    actor: "judge",
    payload: {
      rebuttalId: rebuttal.rebuttalId,
      approvalId: approval.approvalId
    },
    timestamp: new Date()
  });

  assert.equal(challenge.targetAgentId, "build_analyzer");
  assert.equal(rebuttal.position, "DEFEND");
  assert.equal(decision.riskTier, "MEDIUM");
  assert.equal(approval.action, "APPROVE");
  assert.equal(typeof audit.payload, "object");
});
