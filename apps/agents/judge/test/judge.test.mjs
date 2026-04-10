import test from "node:test";
import assert from "node:assert/strict";

import {
  buildServer,
  classifyRiskTier,
  computeCompositeScore,
  createJudgeAdkAgent,
  recommendedActionForRisk,
  synthesizeDecision
} from "../dist/index.js";

const eventId = "17171717-1717-4171-8171-171717171717";

const requestPayload = {
  event: {
    eventId,
    sourceTool: "github_actions",
    repository: "acme/api",
    commitSha: "abc123",
    branch: "main",
    failureType: "pipeline_failure",
    rawLogsRef: "https://github.com/acme/api/actions/runs/111",
    metadata: {},
    timestamp: new Date("2026-04-10T14:00:00.000Z")
  },
  findings: [
    {
      findingId: "18181818-1818-4181-8181-181818181818",
      agentId: "build_analyzer",
      eventId,
      hypothesis: "Build tooling failed.",
      evidence: ["docker build failed"],
      confidence: 0.8,
      proposedRemediation: "Fix Dockerfile.",
      createdAt: new Date("2026-04-10T14:01:00.000Z")
    },
    {
      findingId: "19191919-1919-4191-8191-191919191919",
      agentId: "code_reviewer",
      eventId,
      hypothesis: "Code diff is risky.",
      evidence: ["eval(userInput)"],
      confidence: 0.7,
      proposedRemediation: "Remove eval.",
      createdAt: new Date("2026-04-10T14:02:00.000Z")
    },
    {
      findingId: "20202020-2020-4202-8202-202020202020",
      agentId: "test_analyzer",
      eventId,
      hypothesis: "The suite regressed.",
      evidence: ["checkout succeeds neverFailedBefore=true"],
      confidence: 0.6,
      proposedRemediation: "Inspect regression.",
      createdAt: new Date("2026-04-10T14:03:00.000Z")
    },
    {
      findingId: "21212121-2121-4212-8212-212121212121",
      agentId: "dependency_checker",
      eventId,
      hypothesis: "A package is vulnerable.",
      evidence: ["axios@0.27.0 cvss=7.5"],
      confidence: 0.75,
      proposedRemediation: "Upgrade axios.",
      createdAt: new Date("2026-04-10T14:04:00.000Z")
    }
  ],
  rebuttals: [
    {
      rebuttalId: "22222222-2222-4222-8222-222222222222",
      respondingAgentId: "build_analyzer",
      challengeId: "23232323-2323-4232-8232-232323232323",
      position: "DEFEND",
      updatedConfidence: 0.77,
      rebuttalFactor: 0.85
    }
  ],
  weights: {
    build_analyzer: 0.3,
    code_reviewer: 0.25,
    test_analyzer: 0.25,
    dependency_checker: 0.2
  }
};

test("createJudgeAdkAgent exposes the judge runtime", async () => {
  const agent = createJudgeAdkAgent();

  assert.equal(agent.name, "judge");
  assert.ok(agent.runtime);
});

test("computeCompositeScore applies the weighted rebuttal formula", async () => {
  const score = computeCompositeScore(
    requestPayload.findings,
    requestPayload.rebuttals,
    requestPayload.weights
  );

  assert.equal(score, 0.679);
});

test("classifyRiskTier respects LOW, MEDIUM, and HIGH boundaries", async () => {
  assert.equal(classifyRiskTier(0.34), "LOW");
  assert.equal(classifyRiskTier(0.35), "MEDIUM");
  assert.equal(classifyRiskTier(0.7), "MEDIUM");
  assert.equal(classifyRiskTier(0.71), "HIGH");
});

test("recommendedActionForRisk returns the expected routing action", async () => {
  assert.match(recommendedActionForRisk("LOW"), /automated remediation/i);
  assert.match(recommendedActionForRisk("MEDIUM"), /approval queue/i);
  assert.match(recommendedActionForRisk("HIGH"), /Escalate/i);
});

test("synthesizeDecision returns a valid decision object", async () => {
  const decision = await synthesizeDecision(requestPayload);

  assert.equal(decision.eventId, eventId);
  assert.equal(decision.riskTier, "MEDIUM");
  assert.equal(decision.compositeScore, 0.679);
});

test("POST /synthesize returns a structured decision", async () => {
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/synthesize",
    payload: requestPayload
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.eventId, eventId);
  assert.equal(body.riskTier, "MEDIUM");

  await app.close();
});
