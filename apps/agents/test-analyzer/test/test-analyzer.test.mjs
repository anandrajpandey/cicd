import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeTests,
  buildServer,
  createTestAnalyzerAdkAgent,
  createTestRebuttal,
  issueChallenges,
  scoreTestConfidence
} from "../dist/index.js";

const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const makeEvent = (overrides = {}) => ({
  eventId,
  sourceTool: "github_actions",
  repository: "acme/api",
  commitSha: "abc123",
  branch: "main",
  failureType: "test_failure",
  rawLogsRef: "https://github.com/acme/api/actions/runs/99",
  metadata: {},
  timestamp: new Date("2026-04-10T12:00:00.000Z"),
  context: {
    rawTestReport: "",
    failingTests: [],
    changedLineCoverage: 1
  },
  ...overrides
});

test("createTestAnalyzerAdkAgent exposes the test analyzer runtime", async () => {
  const agent = createTestAnalyzerAdkAgent();

  assert.equal(agent.name, "test_analyzer");
  assert.ok(agent.runtime);
});

test("scoreTestConfidence applies new-failure and coverage boosters", async () => {
  const score = scoreTestConfidence(
    makeEvent({
      context: {
        failingTests: [{ name: "checkout succeeds", hasNeverFailedBefore: true }],
        changedLineCoverage: 0.42
      }
    }),
    {
      type: "new_failure",
      evidence: ["checkout succeeds neverFailedBefore=true"],
      hypothesis: "New regression.",
      remediation: "Inspect changed logic.",
      baseConfidence: 0.58
    }
  );

  assert.equal(score, 0.83);
});

test("analyzeTests detects flaky tests from historical failure rate", async () => {
  const finding = await analyzeTests(
    makeEvent({
      context: {
        rawTestReport: "FAILED checkout retries correctly",
        failingTests: [{ name: "checkout retries correctly", historicalFailureRate: 0.41 }],
        changedLineCoverage: 0.77
      }
    })
  );

  assert.equal(finding.agentId, "test_analyzer");
  assert.match(finding.hypothesis, /flaky|test/i);
  assert.ok(finding.confidence >= 0.62);
});

test("issueChallenges challenges weaker non-test findings", async () => {
  const findings = [
    {
      findingId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      agentId: "test_analyzer",
      eventId,
      hypothesis: "This looks flaky.",
      evidence: ["checkout retries correctly failureRate=0.41"],
      confidence: 0.8,
      proposedRemediation: "Quarantine the test.",
      createdAt: new Date("2026-04-10T12:01:00.000Z")
    },
    {
      findingId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      agentId: "build_analyzer",
      eventId,
      hypothesis: "Docker build issue.",
      evidence: ["docker build failed"],
      confidence: 0.3,
      proposedRemediation: "Retry build.",
      createdAt: new Date("2026-04-10T12:02:00.000Z")
    }
  ];

  const challenges = await issueChallenges({
    event: makeEvent(),
    findings
  });

  assert.equal(challenges.length, 1);
  assert.equal(challenges[0].challengerAgentId, "test_analyzer");
  assert.equal(challenges[0].targetAgentId, "build_analyzer");
});

test("createTestRebuttal defends test-specific challenges", async () => {
  const rebuttal = await createTestRebuttal({
    event: makeEvent(),
    challenge: {
      challengeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      challengerAgentId: "code_reviewer",
      targetAgentId: "test_analyzer",
      counterHypothesis: "The failure still looks like a flaky test with poor coverage.",
      evidence: ["failureRate=0.41"],
      confidence: 0.7
    },
    currentFinding: {
      findingId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      agentId: "test_analyzer",
      eventId,
      hypothesis: "Flaky suite.",
      evidence: ["failureRate=0.41"],
      confidence: 0.76,
      proposedRemediation: "Stabilize the test.",
      createdAt: new Date("2026-04-10T12:03:00.000Z")
    }
  });

  assert.equal(rebuttal.position, "DEFEND");
  assert.equal(rebuttal.rebuttalFactor, 0.85);
});

test("POST /analyze returns a structured test finding", async () => {
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/analyze",
    payload: makeEvent({
      context: {
        rawTestReport: "FAILED checkout succeeds",
        failingTests: [{ name: "checkout succeeds", hasNeverFailedBefore: true }],
        changedLineCoverage: 0.4
      }
    })
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.agentId, "test_analyzer");
  assert.ok(body.confidence >= 0.8);

  await app.close();
});
